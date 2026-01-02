require('dotenv').config();

exports.tgbot = {
    apikey : (process.env.API_KEY || undefined), 
    mode : (process.env.MODE || "DEV"),
    admin : {
        id : undefined,
        username : undefined,     
    },
    group : {
        id : undefined,
        name : undefined,
        username : undefined,
        guard : false
    },
    privacy : true,
    version : "1.0.0",
    rules : "1) 🚫 Упоминать других ботов строго запрещено.\n2) 🔑 Не делись своими ключами с другими.\n3) 📨 Жалобы и вопросы — только в поддержку.\n4) 🛡️ Не пытайся взломать или обойти систему\n5) 😡 Не оскорблять администрацую , подержку и бота.\n6) 🌐 Пользуйся VPN безопасно, бот не несет ответственность за твои глупые действия.\n",
}

exports.db = {
    host : (process.env.DB_HOST || undefined),
    name : (process.env.DB_NAME || undefined),
    user : (process.env.DB_USER || "root"),
    password : (process.env.DB_PASSWORD || undefined),
    dialect : (process.env.DB_DIALECT || "mariadb"),
    prefix : "tg_",
}

exports.vpn = {
    // Пример объекта
    // nl : {
    //     status : "active",
    //     name :  {
    //         ru : "🇳🇱Нидерланды",
    //         en : "🇳🇱Netherlands"
    //     },
    //     desk : "+ EXMAPLE",
    //     roleTime : {
    //         NONE : 1 * 24 * 60 * 60 * 1000,
    //         USER : 7 * 24 * 60 * 60 * 1000,
    //         VIP : 14 * 24 * 60 * 60 * 1000,
    //         ADMIN : 0,                         
    //         SUPERADMIN : 0                           
    //     },
    //     host : "ip4",
    //     login : "login",
    //     password : "password",
    //     path : "/",
    //     port : 5842,
    //     inbounds : [
    //         {
    //             type : "vless",
    //             meta : "NOTING",
    //             id : 1,
    //             publicKey : 'pkey',
    //             sni : 'example.com',
    //             sid : "sid",
    //             port : 3333,
    //         },
    //     ]
    // },
}

