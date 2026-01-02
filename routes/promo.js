const { Composer } = require('telegraf');
const { roleGuard, roles } = require('../services/roles');
const { Promo, User, UserCache } = require('../database');

module.exports = () => {
  const promo = new Composer();

  promo.command('promo', roleGuard(1), async (ctx) => {
    try {
      const args = ctx.message.text.trim().split(' ');
      if (args.length < 2) return ctx.reply('Использование: /promo <code>');

      const userId = ctx.from.id;
      const key = `${userId}_promo_attempts`;

      let attempts = UserCache.get(key) || 0;

      if (attempts >= 6) {
        return ctx.reply('🚫 Слишком много попыток. Попробуйте снова через 5 минут.');
      }

      let promoData = await Promo.findOne({ where: { value: args[1] } });
      if (!promoData) {
        attempts += 1;
        UserCache.set(key, attempts, 60 * 5);
        return ctx.reply(`❌ Промокод не существует.`);
      }

      let usedBy = [];
      try {
        usedBy = promoData.usedBy && promoData.usedBy !== '' ? JSON.parse(promoData.usedBy) : [];
      } catch (e) {
        usedBy = [];
      }
      promoData.usedBy = usedBy;

      if (promoData.status !== 'active' || promoData.count === 0) {
        attempts += 1;

        if (attempts >= 5) {
          UserCache.set(key, attempts, 60 * 5);
          return ctx.reply('🚫 Превышено количество попыток. Подождите 5 минут.');
        } else {
          UserCache.set(key, attempts, 60 * 5);
          return ctx.reply(`❌ Промокод не активен или закончились использования.`);
        }
      }

      if (promoData.usedBy.includes(userId)) {
        return ctx.reply('❌ Вы уже использовали этот промокод ранее.');
      }

      UserCache.del(key);

      let user = await User.findOne({ where: { userid: userId } });
      if (!user || user.ban) return;

      const reward = promoData.reward || {};
      let res = '';

      if (reward.balance) {
        user.balance += reward.balance;
        res += `Баланс: +${reward.balance}\n`;
      }

      if (
        reward.role &&
        user.role !== reward.role &&
        roles[reward.role] &&
        roles[user.role].access < roles[reward.role].access
      ) {
        user.role = reward.role;
        res += `Роль: ${reward.role}\n`;
      }

      await user.save();

      promoData.usedBy.push(userId);
      promoData.usedBy = JSON.stringify(promoData.usedBy);
      promoData.count -= 1;
      UserCache.del(ctx.from.id);
      await promoData.save();

      await ctx.reply(
        `🎁 Промокод "${promoData.value}" успешно активирован!\n` +
          `${res ? 'Получено:\n' + res : ''}`
      );
    } catch (e) {
      console.error(`[Log|Error] ${e.message} (${ctx.from.id} - promo)`);
    }
  });

  return promo;
};

