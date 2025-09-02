const argon2 = require('argon2');

module.exports = async function comparePassword(plainText, hashedPassword) {
  try {
    if (!plainText || !hashedPassword) return false;

    const match = await argon2.verify(hashedPassword, plainText, {
      type: argon2.argon2id
    });

    return match;
  } catch (err) {
    console.error('comparePassword error:', err);
    return false;
  }
};
