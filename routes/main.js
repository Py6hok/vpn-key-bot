const { Composer, Markup } = require('telegraf');
const { roleGuard, subGuard } = require('../services/roles');
const { User, UserCache, VpnCache } = require('../database');
const { vpn, tgbot } = require('../config');
const { getUserByTG, addUser, status, deleteUser } = require('../services/vpn');
const crypto = require('crypto');

let HomePage = (ctx) => {
    try {
        const user = ctx.state.user;
        return ctx.reply(
            `=====<b>Меню</b>=====\n` +
            `🆔ID - <b>${user.userid}</b>\n` +
            `💎Баланс - ${user.balance}\n` + 
            `🔑Роль - <b>${user.role}</b>\n` +
            `/help - список команд`,
            {
                parse_mode : 'HTML',
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('🛡️VPN', 'vpn')], [Markup.button.callback('ℹ️FAQ', 'faq')],
                ])
            }
        );
    } catch (e) {
        console.log(`[Log|Error] ${e.message} (${ctx.from.id} - homepage)`);
        return ctx.reply("Произошла ошибка. Попробуйте позже.");
    }
}

module.exports = () => {
    let main = new Composer();

    main.command('start', roleGuard(1), (ctx) => HomePage(ctx));
    main.action('home', roleGuard(1), async (ctx) => {
        try {
            await ctx.deleteMessage();
        } catch (e) {
            console.log(`[Log|Error] ${e.message} (${ctx.from?.id} - DELETE)`);
        }
        return HomePage(ctx);
    });

    main.command('notify', roleGuard(0), async (ctx) => {
        let args = ctx.message.text.split(' ');
        if(args.length < 2 || args.length !== 2) {
            return ctx.reply('Использование : /notify <on|off>');
        }
        let value = args[1];
        if(value == "on" || value == "true") value = true;
        if(value == "off" || value == "false") value = false;
        let user = await User.findOne({
            where : {
                userid : ctx.from.id
            }
        });
        if(!user) return ctx.reply('Пользователь не найден');
        if(user.notify == value) return ctx.reply(`Уведомления уже ${value == true ? "включены" : "выключены"}`);
        user.notify = value;
        await user.save();
        if(UserCache.has(ctx.from.id)) UserCache.del(ctx.from.id);
        return ctx.reply(`Уведомления ${value == true ? "включены" : "выключены"}`);
    });

    main.command('help', roleGuard(0), async (ctx) => {
        const helpText = [
            '🛠 <b>Список доступных команд</b>',
            '',
            '💰 /pay - Передать баланс другому пользователю',
            '🔔 /notify - Управление уведомлениями',
            '📊 /status - Просмотр состояния сервера',
            '🎭 /roles - Список всех ролей',
        ].join('\n');

        return ctx.reply(helpText, { parse_mode: 'HTML' });
    });
    
    main.action('faq', roleGuard(0), async (ctx) => {
        try {         
            try {
                await ctx.deleteMessage();
            } catch (err) {
                console.log(`[Log|Error] ${err.message} (${ctx.from?.id} - DELETE)`);
            }

            const faqText = [
                '📖 <b>===== FAQ =====</b>',
                '🚀 <i>Временный проект для бесплатного пользования</i>',
                '🤖 Этот бот автоматически раздаёт VPN-ключи!',
                '📦 <b>Текущая версия бота:</b> 1.8.0 BETA',
                '',
                '✨ Что тебя ждёт?',
                'Твой ключ уже готов к приключениям! 🥺👉👈',
                '',
                `${(!tgbot.admin.id || !tgbot.admin.username) ? '' : `📩 <a href="https://t.me/${tgbot.admin.username}">Связаться с админом</a>`}`
            ].join('\n');

            return ctx.reply(faqText, {
                parse_mode: 'HTML',
                disable_web_page_preview: true,
                ...Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', 'home')]
                ])
            });

        } catch (err) {
            console.log(`[Log|Error] ${err.stack} (${ctx.from?.id} - ${ctx.callbackQuery?.data})`);
            return ctx.reply('⚠️ Произошла ошибка. Попробуйте позже.');
        }
    });


    //===VPN===
    main.action('vpn', roleGuard(1), subGuard('vpn'), async (ctx) => {
        try {
            try {
                await ctx.deleteMessage();
            } catch (e) {
                console.log(`[Log|Error] ${e.message} (${ctx.from?.id} - DELETE)`);
            }
            const buttons = Object.keys(vpn).map(key => {
                const locate = vpn[key];
                return [Markup.button.callback(locate.name.ru, `vpn_${key}_locate`)]; 
            });
             buttons.push([Markup.button.callback('⬅️ Назад', 'home')]);
            return ctx.reply('Выберите локацию :', Markup.inlineKeyboard(buttons));
        } catch (e) {
            console.log(`[Log|Error] ${e.message} (${ctx.from?.id} - ${ctx.callbackQuery?.data})`);
            return ctx.reply("Произошла ошибка. Попробуйте позже.");
        }
    });

    //===VPN-LOCATE===
    main.action(/vpn_(.+)_locate/, roleGuard(1), subGuard('vpn'), async (ctx) => {    
        try {
            await ctx.deleteMessage();
        } catch (err) {
            console.log(`[Log|Error] ${err.message} (${ctx.from?.id} - DELETE)`);
        }
        const locate = ctx.match[1];
        const user = ctx.state.user;
        if (!locate || !vpn[locate]) {
            return ctx.reply(
                '❌ Ошибка: локация не существует!',
                Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', 'vpn')]
                ])
            );
        }
        if(vpn[locate].status !== "active") {
            return ctx.reply(
                '❌ Ошибка: локация не активна!',
                Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', 'vpn')]
                ])
            );
        }
        let key = VpnCache.get(`${user.userid}_${locate}`);
        if(!key) {
            key = await getUserByTG(locate, ctx.state.user.userid);
            if(key) {
                key = key[0];
                key.value = `vless://${key.id}@${vpn[locate].host}:${vpn[locate].inbounds[0].port}?type=tcp&security=reality&pbk=${vpn[locate].inbounds[0].publicKey}&fp=chrome&sni=${vpn[locate].inbounds[0].sni}&sid=${vpn[locate].inbounds[0].sid}&spx=%2F&flow=xtls-rprx-vision#${vpn[locate].name.en}_${crypto.randomBytes(4).toString("hex")}`
                let time = key.expiryTime - Date.now();
                VpnCache.set(`${user.userid}_${locate}`, key, time);
            }
        }
        const buttons = [];
        if (!key) {
            buttons.push([Markup.button.callback('Создать', `vpn_${locate}_create`)]);
        } else {
            buttons.push([Markup.button.callback('Обновить', `vpn_${locate}_locate`)]);
            buttons.push([Markup.button.callback('Пересоздать', `vpn_${locate}_reload`)]);
        }
        buttons.push([Markup.button.callback('⬅️ Назад', 'vpn')]);
        const text = 
            `${vpn[locate].name.ru}\n` +
            `Описание: ${vpn[locate].desk}\n` +
            (key ? `\n🔑 <b>Ключ:</b> <code>${key.value}</code>` : '\n❗ Ключ не создан.');
        return ctx.reply(text, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard(buttons)
        });
    });

    //===VPN-CREATE===
    main.action(/vpn_(.+)_(create)/, roleGuard(1), subGuard('vpn'), async (ctx) => {     
        try {
            await ctx.deleteMessage();
        } catch (e) {
            console.log(`[Log|Error] ${e.message} (${ctx.from?.id} - DELETE)`);
        }
        const locate = ctx.match[1];
        const user = ctx.state.user;
        if (!locate || !vpn[locate]) {
            return ctx.reply(
                '❌ Ошибка: локация не существует!',
                Markup.inlineKeyboard([Markup.button.callback('⬅️ Назад', 'vpn')])
            );
        }
        if(vpn[locate].status !== "active") {
            return ctx.reply(
                '❌ Ошибка: локация не активна!',
                Markup.inlineKeyboard([
                    [Markup.button.callback('⬅️ Назад', 'vpn')]
                ])
            );
        }
        let key = VpnCache.get(`${user.userid}_${locate}`);
        if(!key) {
            key = await getUserByTG(locate, ctx.state.user.userid);
            if(key) {
                for(let i = 0; i < key.length; i++) {
                    if(key[i].enable) {
                        key = key[i];
                        break;
                    }
                }
                key.value = `vless://${key.id}@${vpn[locate].host}:${vpn[locate].inbounds[0].port}?type=tcp&security=reality&pbk=${vpn[locate].inbounds[0].publicKey}&fp=chrome&sni=${vpn[locate].inbounds[0].sni}&sid=${vpn[locate].inbounds[0].sid}&spx=%2F&flow=xtls-rprx-vision#${vpn[locate].name.en}_${crypto.randomBytes(4).toString("hex")}`
                let time = key.expiryTime - Date.now();
                VpnCache.set(`${user.userid}_${locate}`, key, time);
                return ctx.reply(
                    `${vpn[locate].name.ru}\nОписание: ${vpn[locate].desk}\n\n 🔑 <b>Ключ:</b> <code>${key.value}</code>`,
                    {
                        parse_mode: 'HTML', ...Markup.inlineKeyboard([
                            [Markup.button.callback('Обновить', `vpn_${locate}_locate`)],
                            [Markup.button.callback('Пересоздать', `vpn_${locate}_reload`)],
                            [Markup.button.callback('⬅️ Наsад', 'home')]
                        ]) 
                    }
                );
            }
        }

        const email = crypto.randomBytes(4).toString("hex");
        const uuid = crypto.randomUUID();
        const obj = {
            email: email,
            id: uuid,
            tgId: ctx.state.user.userid,
            limitIp: 0,
        };
        let ok = await addUser(locate, time=0, obj);
        key = await getUserByTG(locate, ctx.from.id);
        key.value = `vless://${key.id}@${vpn[locate].host}:${vpn[locate].inbounds[0].port}?type=tcp&security=reality&pbk=${vpn[locate].inbounds[0].publicKey}&fp=chrome&sni=${vpn[locate].inbounds[0].sni}&sid=${vpn[locate].inbounds[0].sid}&spx=%2F&flow=xtls-rprx-vision#${vpn[locate].name.en}_${crypto.randomBytes(4).toString("hex")}`;
        if (!ok) return ctx.reply('❌ Ошибка при создании пользователя VPN');
        VpnCache.set(`${ctx.state.user.userid}_${locate}`, key);
        return ctx.reply(
            `${vpn[locate].name.ru}\nОписание: ${vpn[locate].desk}\n\n 🔑 <b>Ключ:</b> <code>${key.value}</code>`,
            {
                parse_mode: 'HTML', ...Markup.inlineKeyboard([
                    [Markup.button.callback('Обновить', `vpn_${locate}_locate`)],
                    [Markup.button.callback('Пересоздать', `vpn_${locate}_reload`)],
                    [Markup.button.callback('⬅️ Наsад', 'home')]
                ]) 
               }
        );
    });

    //===CLOSE===
    main.action('close', roleGuard(1), async (ctx) => {
        try {
           await ctx.deleteMessage();  
        } catch (e) {
            console.error(`[Log|Error] ${e.message} (${ctx.from?.id} - ${ctx.callbackQuery?.data})`);
            return ctx.reply("Произошла ошибка. Невозможно закрыть");
        }
    });

    //===RULES-ACCEPT|DONTACCEPT===
    main.action(/rules_(accept|dont_accept)/, async (ctx) => {
        try {
            const action = ctx.match[1];
            const userId = ctx.from.id;
            const user = await User.findOne({ where: { userid: userId } });

            try {
                await ctx.deleteMessage();
            } catch (e) {
                console.error(`[Log|Error] ${e.message} (${ctx.from?.id} - DELETE)`);
            }

            if (!user) {
                return;
            }

            if (user.ban) {
                return;
            }

            if (action === "accept") {
                if (user.accept_rules) {
                    return ctx.answerCbQuery("Вы уже приняли правила.");
                }

                user.accept_rules = true;
                await user.save();
                UserCache.set(userId, user);

                ctx.reply("✅ Правила приняты. Добро пожаловать!");
                return HomePage(ctx);
            }

            if (user.accept_rules === true) {
                return ctx.answerCbQuery("Вы уже приняли правила и не можете отказаться.");
            }

            user.accept_rules = false;
            user.ban = true;
            user.ban_reason = "Отказ от правил.";
            await user.save();
            UserCache.del(userId);

            return ctx.reply("❌ Вы отказались от правил. Доступ к боту заблокирован.");
        } catch (e) {
            console.error(`[Log|Error] ${e.message} (${ctx.from?.id} - ${ctx.callbackQuery?.data})`);
            return ctx.reply("Произошла ошибка. Попробуйте ещё раз.");
        }
    });
    
    main.command('status', roleGuard(1), async (ctx) => {
        let locate = ctx.message.text.split(' ')[1];
        let text = Object.keys(vpn).toString();
        if(!locate) return ctx.reply(`Использования : /status <${text}>`);
        let state = VpnCache.get(`status_${locate}`);
        if(!state) {
            state = await status(locate);
            VpnCache.set(`status_${locate}`, state, 90);
        }
        
        ctx.reply(`${vpn[locate].name.en} : ${state == true ? "Активен" : "❌ Неактивен"}`);
    });

    main.action(/vpn_(.+)_reload/, async (ctx) => { 
        try {
            try {
                await ctx.deleteMessage();
            } catch (e) {
                console.error(`[Log|Error] ${e.message} (${ctx.from?.id} - DELETE)`);
            }

            const locate = ctx.match[1];
            if(vpn[locate].status !== "active") {
                return ctx.reply(
                    '❌ Ошибка: локация не активна!',
                    Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Назад', 'vpn')]
                    ])
                );
            }
            const user = ctx.state.user;
            const rate = UserCache.get(`${user.userid}_vpn_rate`);
            if (rate) {
                return ctx.reply(
                    '⏳ Вы недавно пересоздавали ключ. Подождите 30 минут перед следующим пересозданием.',
                    Markup.inlineKeyboard([Markup.button.callback('⬅️ Назад', `vpn_${locate}_locate`)])
                );
            }
            if (!locate || !vpn[locate]) {
                return ctx.reply(
                    '❌ Ошибка: локация не существует!',
                    Markup.inlineKeyboard([Markup.button.callback('⬅️ Назад', 'vpn')])
                );
            }

            let key = VpnCache.get(`${user.userid}_${locate}`);

            if (!key) {
                const keys = await getUserByTG(locate, ctx.from.id);
                if (!keys || !keys.length) {
                    return ctx.reply(
                        'Вначале нужно создать ключ!',
                        Markup.inlineKeyboard([Markup.button.callback('⬅️ Назад', 'vpn')])
                    );
                }

                for (const oldKey of keys) {
                    await deleteUser(locate, oldKey.id);
                }

                key = keys[0];
            } else {
                await deleteUser(locate, key.id);
            }

            const email = crypto.randomBytes(4).toString("hex");
            const uuid = crypto.randomUUID();
            const obj = {
                email,
                id: uuid,
                tgId: ctx.from.id,
                limitIp: 0
            };

            const newKey = await addUser(locate, 0, obj);
            if (!newKey) {
                return ctx.reply('Ошибка при создании нового ключа, попробуйте позже!');
            }

            obj.value = `vless://${obj.id}@${vpn[locate].host}:${vpn[locate].inbounds[0].port}?type=tcp&security=reality&pbk=${vpn[locate].inbounds[0].publicKey}&fp=chrome&sni=${vpn[locate].inbounds[0].sni}&sid=${vpn[locate].inbounds[0].sid}&spx=%2F&flow=xtls-rprx-vision#${vpn[locate].name.en}_${crypto.randomBytes(4).toString("hex")}`;

            VpnCache.set(`${user.userid}_${locate}`, obj);
            UserCache.set(`${user.userid}_vpn_rate`, true, 1800);
            return ctx.reply(
                `${vpn[locate].name.ru}\nОписание: ${vpn[locate].desk}\n\n🔑 <b>Ключ:</b> <code>${obj.value}</code>`,
                {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([
                        [Markup.button.callback('Обновить', `vpn_${locate}_locate`)],
                        [Markup.button.callback('Пересоздать', `vpn_${locate}_reload`)],
                        [Markup.button.callback('⬅️ Назад', 'home')]
                    ])
                }
            );
        } catch (e) {
            console.log(`[Log|Error] ${e.message} (${ctx.from?.id} - RECREATE)`);
        }
    });

    return main;
}