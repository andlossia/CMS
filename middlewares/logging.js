const fs = require('node:fs');
const path = require('node:path');

const logStream = fs.createWriteStream(path.join(__dirname, 'requests.log'), { flags: 'a' });

module.exports = (req, res, next) => {
    const log = `${new Date().toISOString()} ${req.method} ${req.url}\n`;
    logStream.write(log);
    next();
};
