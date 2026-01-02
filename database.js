const { db, tgbot } = require('./config');
const { Sequelize, Op } = require('sequelize');
const Cache = require('node-cache');

const Database = new Sequelize(db.name, db.user, db.password, {
    host : db.host,
    dialect : db.dialect,
    define : {
        timestamps : false
    },
    logging: (tgbot.mode == "DEV") ? console.warn : false,
});

const name = (table) => db.prefix + table;

exports.UserCache = new Cache({ stdTTL: 600, checkperiod: 60 });
exports.VpnCache = new Cache({ stdTTL: 3600, checkperiod: 1800 });
exports.PromoCache = new Cache({ stdTTL : 60, checkperiod: 60 });

exports.startDatabase = () => {
    return new Promise(async (res) => {
        try {
            await Database.authenticate();
            await Database.sync({ force : (tgbot.mode == "DEV") ? true : false });
            exports.log('База данных синхронизирована');
            exports.log('База данных запущена!');
            res(true);
        } catch (e) {
            exports.log(`Ошибка при подключении... ${e.message}`);
            res(false);
        }
    });
};

exports.User = Database.define(name('user'), {
    id : {
        type : Sequelize.INTEGER,
        primaryKey : true,
        autoIncrement : true,
    },
    userid : {
        type : Sequelize.STRING,
        allowNull : false,
        unique : true,
    },
    chatid : {
        type : Sequelize.STRING,
        allowNull : true,
        unique : true,
    },
    role : {
        type : Sequelize.STRING(100),
        allowNull : false,
        defaultValue : 'none',
    },
    balance : {
        type : Sequelize.INTEGER,
        allowNull : false,
        defaultValue : 777,
    },
    lang : {
        type : Sequelize.STRING(2),
        defaultValue : "ru",
    },
    notify : {
        type : Sequelize.BOOLEAN,
        defaultValue : true
    },
    ban : {
        type : Sequelize.BOOLEAN,
        allowNull : false,
        defaultValue : false,
    },
    ban_reason : {
        type : Sequelize.STRING(100),
        allowNull : true,
    },
    accept_rules : {
        type : Sequelize.BOOLEAN,
        allowNull : true,
        defaultValue : null,
    },
    regAt : {
        type : Sequelize.DATE,
        allowNull : false,
        defaultValue : Sequelize.NOW
    }
});

exports.Log = Database.define(name('log'), {
    id : {
        type : Sequelize.INTEGER,
        primaryKey : true,
        autoIncrement : true,
    },
    name : {
        type : Sequelize.STRING(100),
        allowNull : false,
    },
    value : {
        type : Sequelize.STRING(255),
        allowNull : false,
    },
    status : {
        type : Sequelize.STRING(30),
        allowNull : false,
    },
    date : {
        type : Sequelize.DATE,
        allowNull : false,
        defaultValue : Sequelize.NOW
    }
});

exports.Promo = Database.define(name('promo'), {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  value: {
    type: Sequelize.STRING,
    allowNull: false,
    unique: true
  },
  reward: {
    type: Sequelize.JSON,
    allowNull: false
  },
  count: {
    type: Sequelize.INTEGER,
    defaultValue: 1
  },
  status: {
    type: Sequelize.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  usedBy: {
    type: Sequelize.JSON,
    defaultValue: []
  },
  createdAt: {
    type: Sequelize.DATE,
    defaultValue: Sequelize.NOW
  },
});

exports.Sequelize = Sequelize;
exports.Op = Sequelize.Op;

exports.log = (log) => console.log(`[MySQL] ${log}`);
