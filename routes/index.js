const { Composer } = require('telegraf');
const fs = require('fs');
const path = require('path');

module.exports = () => {
    const composer = new Composer(); 
    fs.readdirSync(__dirname)
        .filter(file => file !== 'index.js' && file.endsWith('.js'))
        .forEach(file => {
            try {
                const route = require(path.join(__dirname, file))();
                composer.use(route);
                console.log(`[✓] Loaded: ${file}`);
            } catch (e) {
                console.log(`[✗] Error in ${file}: ${e.message}`);
            }
        });
    return composer;
}