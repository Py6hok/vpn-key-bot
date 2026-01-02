const { User, UserCache } = require('../database');
const { tgbot } = require('../config');
const { Markup } = require('telegraf');

exports.userData = async (ctx, next) => {
    if(ctx.chat.type !== 'private') return;
    let user = await UserCache.get(ctx.from.id);

    if (!user) {
        user = await User.findOne({ where: { userid: ctx.from.id } });
        if (!user) {
            user = await User.create({
                userid: ctx.from.id,
                chatid: ctx.chat.id,
                role: (ctx.from.id === tgbot.admin) ? 'SUPERADMIN' : 'USER',
                ban: false,
                ban_reason: null
            });
            if(ctx.from.id !== tgbot.admin.id) {
                try {
                    ctx.telegram.sendMessage(tgbot.admin, `Новый пользователь @${ctx.from.username} (${ctx.from.id})`);
                } catch (e) {
                    console.log(`Ошибка ${e.message}`);
                }
            }
        }
        
        await UserCache.set(ctx.from.id, user);
    }

    if (ctx.from.id === tgbot.admin.id) {
        let needUpdate = false;
        
        if (user.role !== 'SUPERADMIN') {
            user.role = 'SUPERADMIN';
            needUpdate = true;
        }
        if(user.accept_rules !== true) {
            user.accept_rules = true;
            needUpdate = true;
        }
        if (user.ban !== false) {
            user.ban = false;
            needUpdate = true;
        }
        if (user.ban_reason !== null) {
            user.ban_reason = null;
            needUpdate = true;
        }

        if (needUpdate) {
            await user.save();
            await UserCache.set(ctx.from.id, user);
        }
    }

    ctx.state.user = user;
    return next();
}

exports.userState = async (ctx, next) => {
    if(!ctx.state.user) {
        return;
    }
    let user = await UserCache.get(ctx.from.id);
    if(user.ban && user.role !== "SUPERADMIN") {
        return ctx.reply(
            `❌ <b>Вы заблокированы и не можете больше использовать данного бота!</b>\n\n` +
            `<b>Причина:</b> ${user.ban_reason}\n\n` +
            ((!tgbot.admin.id || !tgbot.admin.username) 
                ? '' 
                : `Если вы считаете это ошибкой или хотите оспорить решение — напишите <a href="https://t.me/${tgbot.admin.username}">админу</a>, указав свой ID: <b>${user.userid}</b>`),
            { parse_mode: 'HTML', disable_web_page_preview: true }
        );
    }
    if(tgbot.rules === undefined) return next();
    if (user.accept_rules === null && (!ctx.callbackQuery || (ctx.callbackQuery.data !== "rules_accept" && ctx.callbackQuery.data !== "rules_dont_accept"))) {
      return ctx.reply(`Привет! Для продолжения вам нужно принять следущие правила\n${tgbot.rules}`, Markup.inlineKeyboard([
            [Markup.button.callback('Принимаю', 'rules_accept')],
            [Markup.button.callback('Не принимаю', 'rules_dont_accept')],
        ]));
    }
    return next();
}
