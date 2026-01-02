const { VpnCache } = require('../database');
const axios = require('axios');
const { vpn } = require('../config');

const urlHost = (locate) => {
    if(!locate || !vpn[locate]) return false;
    return `http://${vpn[locate].host.replace(/\/+$/, '')}:${vpn[locate].port}${vpn[locate]?.path.replace(/\/+$/, '') || ''}`;
}

const login = async (locate) => {
    const host = urlHost(locate);
    if(!host) return null;
    let token = await VpnCache.get(host);
    if(token) return token;

    const req = await axios.post(`${host}/login`, {
        username: vpn[locate].login,
        password: vpn[locate].password
    });

    if(!req.data.success) return null;

    token = req.headers['set-cookie'];
    VpnCache.set(host, token);
    return token;
}

const getInbound = (locate, type = "vless") => {
    if (!vpn[locate] || !vpn[locate].inbounds || !type) return null;
    return vpn[locate].inbounds.find(u => u.type === type) || null;
}

const getUserList = async (locate, type = "vless") => {
    const cookie = await login(locate);
    if (!cookie ) return false;

    const host = urlHost(locate);
    if(!host) return false;

    const inbound = getInbound(locate, type);
    if (!inbound) return false;

    const req = await axios.get(`${host}/panel/api/inbounds/get/${inbound.id}`, {
        headers: { Cookie: cookie.join('; ') }
    });

    if (!req.data.success) return false;

    return JSON.parse(req.data.obj.settings).clients;
}

const getUserByTG = async (locate, tgid, type = "vless") => {
    const cookie = await login(locate);
    if (!cookie || !tgid) return null;

    const host = urlHost(locate);
    if(!host) return false;
    
    const inbound = getInbound(locate, type);
    if (!inbound) return false;

    let req = await axios.get(`${host}/panel/api/inbounds/get/${inbound.id}`, {
        headers : { Cookie : cookie.join('; ') }
    });

    if(!req.data.success) return null;

    let arr = [];
    let clients = JSON.parse(req.data.obj.settings).clients;
    for(let i = 0; i < clients.length; i++) {
        if(clients[i].tgId == tgid) {
            arr.push(clients[i]);
        }
    }
    
    if(arr.length > 0) return arr;

    return null;
}

const getUserByEmail = async (locate, email, type = "vless") => {
    const cookie = await login(locate);
    if (!cookie || !email) return null;

    const host = urlHost(locate);
    if(!host) return false;
    
    const inbound = getInbound(locate, type);
    if (!inbound) return false;

    let req = await axios.get(`${host}/panel/api/inbounds/get/${inbound.id}`, {
        headers : { Cookie : cookie.join('; ') }
    });

    if(!req.data.success) return null;

    let clients = JSON.parse(req.data.obj.settings).clients;
    const client = clients.find(c => c.email === email);

    return client || null;
}

const getUserById = async (locate, id, type = "vless") => {
    const cookie = await login(locate);
    if (!cookie || !id) return null;

    const host = urlHost(locate);
    if (!host) return false;

    const inbound = getInbound(locate, type);
    if (!inbound) return false;

    const req = await axios.get(`${host}/panel/api/inbounds/get/${inbound.id}`, {
        headers: { Cookie: cookie.join('; ') }
    });

    if (!req.data.success) return null;

    const clients = JSON.parse(req.data.obj.settings).clients;
    const client = clients.find(c => c.id === id);
    return client || null;
};

const addUser = async (locate, time, userObj, type = "vless") => {
    const cookie = await login(locate);
    if (!cookie || time === undefined || !userObj) return null;

    const host = urlHost(locate);
    if(!host) return false;

    const inbound = getInbound(locate, type = "vless");
    if (!inbound) return false;

    const clientData = {
        id: userObj.id,
        email: userObj.email,
        enable: true,
        expiryTime: time !== 0 ? Date.now() + time : undefined,
        flow: "xtls-rprx-vision",
        limitIp: userObj.limitIp || 1,
        reset: 0,
        subid: userObj.subid || undefined,
        tgId: userObj.tgId || undefined,
        totalGB: 0
    };


    let req = await axios.post(`${host}/panel/api/inbounds/addClient`, {
        id: inbound.id,
        settings: JSON.stringify({ clients: [clientData] })
    }, {
        headers: { Cookie: cookie.join('; ') }
    });

    if(!req.data.success) return false;
    return true;
}

const deleteUser = async (locate, uuid, type = "vless") => {
    const cookie = await login(locate);
    if(!cookie || !uuid) return null;

    const host = urlHost(locate);
    if(!host) return false;

    const inbound = getInbound(locate, type);
    if (!inbound) return false;

    const req = await axios.post(`${host}/panel/api/inbounds/${inbound.id}/delClient/${uuid}`, {}, { 
        headers: { Cookie: cookie.join('; ') } 
    });

    if(!req.data.success) return false;
    return true;
}

const status = async (locate) => {
    const cookie = await login(locate);
    if (!locate) return null;

    const host = urlHost(locate);
    if(!host) return false;

    const req = await axios.get(`${host}/panel/api/server/status`, {
        headers: { Cookie: cookie.join('; ') }
    });
    if(!req) return false;
    return true;
}

const expiryKey = (time) => {
    if (!time) return true;
    if (time === 0) return false;
    return Date.now() > time;
}

module.exports = { urlHost, login, getUserList, getInbound, getUserByTG, getUserByEmail, getUserById, addUser, deleteUser, status, expiryKey };