const { Composer } = require('telegraf');
const { User, UserCache } = require('../database');
const { roleGuard, roles } = require('../services/roles');
const { tgbot } = require('../config');

module.exports = () => {
    const admin = new Composer();

    admin.command('admin', roleGuard(4), async (ctx) => {
        ctx.reply(
            'Список команд\n\n' +
            '/userdata - пользователи\n' +
            '/msg - написать сообщение\n' +
            '/set - изменить роль пользователя\n' + 
            '/get - получить данные из базы\n' +
            '/ban - заблокировать\n' +
            '/unban - разблокировать\n' +
            '/roles - все роли\n' +
            '/money - добавить/убавить деньги'
        );
    });

    admin.command('userdata', roleGuard(4), async (ctx) => {
        let userList = await User.findAll();
        if(!userList) return ctx.reply('Список пользователей пуст');
        userList = userList.map(u => {
            return `${u.id}) ${u.userid} ${roles[u.role].emoji}${u.role} ${u.ban ? '❌' : '✅'}`;
        }).join('\n');
        ctx.reply(`Список пользователей\n${userList}`);
    });

    admin.command('msg', roleGuard(4), async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) {
            return ctx.reply('Использование: /msg <userid> <text> [-notify | -all]');
        }

        const userId = args[1];
        let msg = args.slice(2).join(' ');

        const notifyOnly = msg.endsWith('-notify');
        const ignoreNotify = msg.endsWith('-all');

        if (notifyOnly || ignoreNotify) {
            msg = msg.replace(/-(notify|all)\s*$/i, '').trim();
        }

        try {
            const user = await User.findOne({ where: { userid: userId } });

            if (!user) {
                return ctx.reply(`❌ Пользователь с ID ${userId} не найден.`);
            }

            if (notifyOnly && user.notify !== true) {
                return ctx.reply(`⚠️ У пользователя уведомления выключены.`);
            }

            if (!ignoreNotify && user.notify !== true) {
                return ctx.reply(`⛔ Сообщение не отправлено: уведомления у пользователя выключены.`);
            }

            if (notifyOnly && user.notify === true) {
                msg += `\n\nℹ️ Вы видите это сообщение, потому что у вас включены уведомления (/notify)`;
            }

            await ctx.telegram.sendMessage(userId, msg);
            ctx.reply(`✅ Сообщение успешно отправлено пользователю ${userId}.`);

        } catch (e) {
            ctx.reply(`❌ Ошибка: ${e.message}`);
        }
    });

    admin.command('set', roleGuard(4), async (ctx) => {
        let args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('Использование: /set <role> <userid>');

        let user = await User.findOne({ where: { userid: args[2] } });
        if (!user) return ctx.reply('Пользователь не найден.');

        let newRole = args[1];
        if(!roles.includes(newRole.toUpperCase())) return ctx.reply("Данная роль не существует - /roles");

        if(user.role == newRole) return ctx.reply('Текущая роль является будущей!');

        user.role = newRole;
        await user.save();
        if (UserCache.has(ctx.from.id)) UserCache.del(ctx.from.id);
        ctx.reply(`Роль пользователя ${user.userid} изменена на ${user.role}`);
        try {
            ctx.telegram.sendMessage(user.chatid, `Ваша роль изменена на ${userRole[newRole]}`);
        } catch (e) {
            ctx.reply(`Не удалось уведомить пользователя о изменении роли ${e.message}`);
        }
    });

    admin.command('get', roleGuard(4), async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('Использование: /get <userid>');

        let user = await User.findOne({ where: { userid: args[1] } });
        if (!user) return ctx.reply('Пользователь не найден.');
        ctx.reply(`Данные пользователя ${args[1]}:\n${JSON.stringify(user, null, 2)}`);
    });

    admin.command('ban', roleGuard(4), async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) return ctx.reply('Использование: /ban <userid> <reason>');

        let user = await User.findOne({ where: { userid: args[1] } });
        if (!user) return ctx.reply('Пользователь не найден.');
        if(user.ban) return ctx.reply('Пользователь уже заблокирован');

        const reason = args.slice(2).join(' ');

        user.ban = true;
        user.ban_reason = reason;
        await user.save();

        if(UserCache.has(user.userid)) UserCache.del(user.userid);

        ctx.reply(`Пользователь ${user.userid} заблокирован. Причина: ${user.ban_reason}`);

        try {
            ctx.telegram.sendMessage(
                user.chatid,
                `❌ <b>Вы заблокированы и не можете больше использовать данного бота!</b>\n\n` +
                `<b>Причина:</b> ${user.ban_reason}\n\n` +
                ((!tgbot.admin.id || !tgbot.admin.username) 
                    ? '' 
                    : `Если вы считаете это ошибкой или хотите оспорить решение — напишите <a href="https://t.me/${tgbot.admin.username}">админу</a>, указав свой ID: <b>${user.userid}</b>`),
                { parse_mode: 'HTML', disable_web_page_preview: true }
    );
        } catch (e) {
            ctx.reply(`Не удалось уведомить пользователя о блокировке ${e.message}`);
        }
    });

    admin.command('unban', roleGuard(4), async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 2) return ctx.reply('Использование: /unban <userid>');

        let user = await User.findOne({ where: { userid: args[1] } });
        if (!user) return ctx.reply('Пользователь не найден.');
        if(!user.ban) return ctx.reply('Пользователь не заблокирован');

        user.ban = false;
        user.ban_reason = null;
        await user.save();
        if(UserCache.has(user.userid)) UserCache.del(user.userid);

        ctx.reply(`Пользователь ${user.userid} разблокирован`);
        try {
            ctx.telegram.sendMessage(user.chatid, `✅ Вы разблокированы!`);
        } catch (e) {
            ctx.reply(`Не удалось уведомить пользователя о разблокировке ${e.message}`);
        }
    });

    admin.command('money', roleGuard(4), async (ctx) => {
        const args = ctx.message.text.split(' ');
        if (args.length < 3) return ctx.reply('Использование: /money <userid> <amount>');

        const user = await User.findOne({ where: { userid: args[1] } });
        if (!user) return ctx.reply('Пользователь не найден.');

        let amount = args[2];
        if (amount === 'max' || amount === '-max') {
            amount = user.balance;
        } else {
            amount = parseInt(amount, 10);
            if (isNaN(amount)) return ctx.reply('Сумма должна быть числом');
        }

        if (user.balance + amount < 0) return ctx.reply('Нельзя уменьшить баланс ниже 0');

        user.balance += amount;
        await user.save();

        if (UserCache.has(user.userid)) UserCache.del(user.userid);

        if (args[1] != ctx.from.id) ctx.reply(`Баланс пользователя ${user.userid} изменён на ${amount}`);

        try {
            await ctx.telegram.sendMessage(
            user.chatid,
            `Ваш баланс ${amount > 0 ? 'увеличен' : 'уменьшен'} на ${Math.abs(amount)}`
        );
        } catch (e) {
          ctx.reply(`Не удалось уведомить пользователя о изминении баланса ${e.message}`);
        }
    });

    admin.command('roles', roleGuard(4), (ctx) => {
        const roleNames = Object.keys(roles);
        if(!roleNames) return ctx.reply('Роли отсутствуют');
        ctx.reply(`Все роли:\n${roleNames.join('\n')}`);
    });
    return admin;
}
