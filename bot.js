const { Telegraf } = require('telegraf');
const { tgbot } = require('./config');
const { startDatabase } = require('./database');
const { userData, userState } = require('./services/user');
const { logger } = require('./services/log');

const apikey = tgbot.apikey;
const privacy = tgbot.privacy;
const mode = tgbot.mode;

const Bot = new Telegraf(apikey);

(async () => {
    try {
        if(!privacy) {
            console.log('[Bot] Внимание! Конфиденциальный режим отключен!');
            Bot.use(logger);
        }

        Bot.use(userData, userState);

        console.log('[Bot] Запуск Бота!');
        console.log(`[Bot] Режим работы: ${mode}`);
        console.log(`[Bot] API ключ: ${apikey}`);

        const db = await startDatabase();
        if (!db) {
            console.log('[Bot] Ошибка подключения к базе данных!');
            process.exit(1);
        }

        console.log('[Bot] Подключение маршрутов...');
        const routes = require('./routes');
        Bot.use(routes());
        console.log('[Bot] Все пути загружены!');

        Bot.launch();
        console.log('[Bot] Бот запущен!');

        const BotInfo = await Bot.telegram.getMe();
        console.log('[Bot] Информация о боте:');
        console.log(`- ID: ${BotInfo.id}`);
        console.log(`- Username: @${BotInfo.username}`);
        console.log(`- Name: ${BotInfo.first_name}`);
  
        process.once('SIGINT', () => Bot.stop('SIGINT'));
        process.once('SIGTERM', () => Bot.stop('SIGTERM'));

    } catch (e) {
        console.log(`[Bot] Ошибка запуска бота: ${e.message}`);
        process.exit(1);
    }
})();

