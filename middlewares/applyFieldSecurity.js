const bcrypt = require('bcrypt');
const crypto = require('node:crypto');

// --- encryption helper
const encrypt = (value, secretKey, algorithm = 'aes-256-cbc') => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, Buffer.from(secretKey, 'hex'), iv);
  let encrypted = cipher.update(value, 'utf8', 'hex') + cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

module.exports = async function applyFieldSecurity(doc, schemaDef) {
  for (const field of schemaDef.fields || []) {
    const value = doc[field.name];

    // 🔐 1. Hashing logic
    if (field.hashing?.algorithm === 'bcrypt' && value && typeof value === 'string') {
      const isHashed = /^\$2[abxy]?\$/.test(value);
      if (!isHashed) {
        const rounds = field.hashing.rounds || 12;
        doc[field.name] = await bcrypt.hash(value, rounds);
      }
    }

    // 🔏 2. Encryption logic
    if (field.encryption?.algorithm === 'aes-256-cbc' && value && typeof value === 'string') {
      const secretKey = field.encryption.secretKey;
      if (secretKey && !value.includes(':')) {
        doc[field.name] = encrypt(value, secretKey);
      }
    }
  }

  return doc;
};
