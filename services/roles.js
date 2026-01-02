const { tgbot } = require('../config');
const { Markup } = require('telegraf');

const roles = {
    NONE : {
        access : 0,
        emoji : "❌",
    },
    USER : {
        access : 1,
        emoji : "👤",
    },
    VIP : {
        access : 2,
        emoji : "💎",
    },
    ADMIN : {
        access : 4,
    },
    SUPERADMIN : {
        access : 999,
        emoji : "🛡",
    }
}

const roleGuard = (minAccess) => {
    return (ctx, next) => {
        const user = ctx.state.user;
        if(!user) return ctx.reply("❌ Пользователь не найден.");
        let role = roles[user.role] ?? roles.NONE;
        if(role.access < minAccess) return ctx.reply("🚫 Недостаточно прав для выполнения этой команды. ");
        return next();
    };
}

const subGuard = (callback) => {
    return async (ctx, next) => {
        ctx.answerCbQuery();
        if(!tgbot.group.id || !tgbot.group.username || !tgbot.group.guard) return next();
        let sub = await ctx.telegram.getChatMember(tgbot.group, ctx.from.id);
        let allowList = ['member', 'creator', 'administrator'];
        if(!allowList.includes(sub.status) && roles[ctx.state.user.role].access <= 1) {
            return ctx.reply('Вы должны подписаться',
                Markup.inlineKeyboard([
                    [Markup.button.url(`${(tgbot.group.name) ?? tgbot.group.username }`, `https://t.me/${tgbot.group.username}`)],
                    [Markup.button.callback('Продолжить', callback)]
                ])
            );
        }
        return next();
    }
}
module.exports = { roles, roleGuard, subGuard };
