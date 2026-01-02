const fs = require('fs');
const moment = require('moment');
const path = require('path');
const fetch = require('node-fetch');

const baseLogDir = path.join(__dirname, '..', 'logs');
const baseUploadDir = path.join(__dirname, '..', 'uploads');

const getTimeStamp = () => {
    const time = moment().locale('ru').format('LTS');
    const date = moment().locale('ru').format('L');
    return `[${date} | ${time}]`;
};

const getUserTag = (ctx) => {
    return ctx.from?.username ? `@${ctx.from.username} | ${ctx.from.id}` : ctx.from?.id;
};

const logMessage = async (message, logDate) => {
    try {
        if (!fs.existsSync(baseLogDir)) fs.mkdirSync(baseLogDir, { recursive: true });
        const logFile = path.join(baseLogDir, `server-${logDate}.log`);
        await fs.promises.appendFile(logFile, message + '\n');
    } catch (e) {
        console.error(`${getTimeStamp()} [LOG] Ошибка записи: ${e.message}`);
    }
};

const saveFile = async (ctx, fileId, filename) => {
    try {
        const uploadDir = path.join(baseUploadDir, logDate);
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const fileLink = await ctx.telegram.getFileLink(fileId);
        const response = await fetch(fileLink.href);
        const buffer = await response.arrayBuffer();
        await fs.promises.writeFile(filename, Buffer.from(buffer));
        return true;
    } catch (e) {
        logMessage(`${getTimeStamp()} [LOG] Ошибка сохранения файла: ${e.message}`, moment().format('YYYY-MM-DD'));
        console.error(`${getTimeStamp()} [LOG] Ошибка сохранения файла: ${e.message}`);
        return false;
    }
};

exports.logger = async (ctx, next) => {
    const timestamp = getTimeStamp();
    const logDate = moment().format('YYYY-MM-DD');
    
    const userTag = getUserTag(ctx);

    // 1. Текст
    if (ctx.message?.text) {
        const message = `${timestamp} [${userTag}] Текст: ${ctx.message.text}`;
        console.log(message);
        await logMessage(message, logDate);
    }

    // 2. Фото
    if (ctx.message?.photo?.length) {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const filename = path.join(uploadDir, `${photo.file_id}.jpg`);
        if (await saveFile(ctx, photo.file_id, filename)) {
            const message = `${timestamp} [${userTag}] Фото сохранено: ${filename}`;
            console.log(message);
            await logMessage(message, logDate);
        }
    }

    // 3. Документы
    if (ctx.message?.document) {
        const doc = ctx.message.document;
        const filename = path.join(uploadDir, `${doc.file_id}-${doc.file_name}`);
        if (await saveFile(ctx, doc.file_id, filename)) {
            const message = `${timestamp} [${userTag}] Документ сохранён: ${filename}`;
            console.log(message);
            await logMessage(message, logDate);
        }
    }

    // 4. Стикеры
    if (ctx.message?.sticker) {
        const sticker = ctx.message.sticker;
        const filename = path.join(uploadDir, `${sticker.file_id}.webp`);
        if (await saveFile(ctx, sticker.file_id, filename)) {
            const message = `${timestamp} [${userTag}] Стикер сохранён: ${filename}`;
            console.log(message);
            await logMessage(message, logDate);
        }
    }

    // 5. Голосовые сообщения
    if (ctx.message?.voice) {
        const voice = ctx.message.voice;
        const filename = path.join(uploadDir, `${voice.file_id}.ogg`);
        if (await saveFile(ctx, voice.file_id, filename)) {
            const message = `${timestamp} [${userTag}] Голосовое сообщение сохранено: ${filename}`;
            console.log(message);
            await logMessage(message, logDate);
        }
    }

    // 6. Локации
    if (ctx.message?.location) {
        const loc = ctx.message.location;
        const message = `${timestamp} [${userTag}] Локация: lat=${loc.latitude}, lon=${loc.longitude}`;
        console.log(message);
        await logMessage(message, logDate);
    }

    // 7. Контакты
    if (ctx.message?.contact) {
        const contact = ctx.message.contact;
        const message = `${timestamp} [${userTag}] Контакт: ${contact.first_name} ${contact.last_name || ''} / ${contact.phone_number}`;
        console.log(message);
        await logMessage(message, logDate);
    }

    // 8. ctx.data
    if (ctx.callbackQuery) {
        const message = `${timestamp} [${userTag}] Data: ${ctx.callbackQuery.data}`;
        console.log(message);
        await logMessage(message, logDate);
    }

    return next();
};