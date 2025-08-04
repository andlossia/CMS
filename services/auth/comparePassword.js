const bcrypt = require('bcrypt');


module.exports = async function comparePassword(plainText, hashedPassword) {
  if (!plainText || !hashedPassword) return false;
  return bcrypt.compare(plainText, hashedPassword);
};
