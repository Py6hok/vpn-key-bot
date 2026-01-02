const { Composer } = require('telegraf');
const { roleGuard, roles } = require('../services/roles');
const { Log, User, UserCache } = require('../database');
const { tgbot } = require('../config');

module.exports = () => {
    let payment = new Composer();

    payment.command('pay', roleGuard(1), async (ctx) => {
        try {
            const args = ctx.message.text.split(' ');
            if (args.length < 3) return ctx.reply('Использование: /pay <userid> <amount>');
            if (String(ctx.from.id) === String(args[1])) {
                return ctx.reply('Операция отклонена системой.'); 
            }
            if(args[1] === "admin") args[1] = tgbot.admin.id;
            if(ctx.from.id == tgbot.admin.id && args[1] == tgbot.admin.id) {
                return ctx.reply('Операция отклонена системой.'); 
            }
            const senderKey = `${ctx.from.id}_pay_rate`;
            const targetKey = `${args[1]}_incoming_rate`;

            let senderLimit = UserCache.get(senderKey) || 0;
            let targetIncoming = UserCache.get(targetKey) || 0;

            if (targetIncoming >= 15) {
                return ctx.reply('Операция отклонена системой.');
            }

            if (senderLimit > 10) return ctx.reply('Операция отклонена системой.');

            const amount = parseInt(args[2], 10);
            if (isNaN(amount) || amount <= 0) {
                senderLimit++;
                const timeout = Math.min(3600, 60 * Math.pow(2, Math.max(0, senderLimit - 1)));
                UserCache.set(senderKey, senderLimit, timeout);
                return ctx.reply('Операция отклонена системой.');
            }

            if (amount > 100000) return ctx.reply('Операция отклонена системой.');

            const my = await User.findOne({ where: { userid: ctx.from.id } });
            if (!my) {
                senderLimit++;
                UserCache.set(senderKey, senderLimit, 60 * senderLimit);
                return ctx.reply('Операция отклонена системой.');
            }

            if (my.ban || my.balance < amount || !roles[my.role] || roles[my.role].access < 1) {
                senderLimit++;
                const timeout = Math.min(3600, 60 * Math.pow(2, Math.max(0, senderLimit - 1)));
                UserCache.set(senderKey, senderLimit, timeout);
                return ctx.reply('Операция отклонена системой.');
            }

            const user = await User.findOne({ where: { userid: args[1] } });
            if (!user) {
                targetIncoming++;
                UserCache.set(targetKey, targetIncoming, 3600);
                senderLimit++;
                UserCache.set(senderKey, senderLimit, 60 * senderLimit);
                return ctx.reply('Операция отклонена системой.');
            }

            if (user.ban) return ctx.reply('Операция отклонена системой.');

            if (targetIncoming > 100) {
                return ctx.reply('Операция отклонена системой.');
            }

            my.balance -= amount;
            user.balance += amount;
            await my.save();
            await user.save();

            await Log.create({
                name : "Payment",
                value : `From ${my.userid} To ${user.userid} - ${amount}`,
                status : `ok`,
            });
            
            UserCache.set(senderKey, 0, 0);
            UserCache.set(targetKey, Math.max(0, targetIncoming - 1), 3600);

            ctx.reply('Перевод успешно выполнен.');

            try {
                await ctx.telegram.sendMessage(user.chatid, `Вам поступило ${amount}.`);
            } catch (e) {}

        } catch (e) {
            console.error(`[Log|Error] ${e.message} (${ctx.from.id} - pay)`);
            ctx.reply('Операция отклонена системой.');
        }
    });
    
    return payment;
}