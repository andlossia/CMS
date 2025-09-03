const argon2 = require('argon2');
const { loadCollection } = require('../../../database');

exports.handle = async (doc, next, context, { providerKey, identifier, payload, providerPlugin }) => {
  try {
    const { secret, token } = payload;
    if (!secret || !token) throw new Error('Missing new password or reset token');

    const accounts = await loadCollection('authentications');
    if (!accounts || typeof accounts.findOne !== 'function') {
      throw new Error('Failed to load accounts collection');
    }

    // البحث عن الحساب بالرمز
    const account = await accounts.findOne({
      provider: providerKey,
      identifier,
      reset_token: token,
      reset_expires: { $gt: new Date() }
    });

    if (!account) throw new Error('Invalid or expired reset token');

    // تشفير كلمة المرور الجديدة
    const passwordHash = providerKey === 'local'
      ? await argon2.hash(secret, { type: argon2.argon2id })
      : null;

    // تحديث الحساب
    const updateData = providerKey === 'local'
      ? { 'local.password_hash': passwordHash }
      : {};

    await accounts.updateOne(
      { _id: account._id },
      { $set: updateData, $unset: { reset_token: '', reset_expires: '' } }
    );

    doc._skipInsert = true;
    doc._response = {
      success: true,
      message: 'Password has been reset successfully'
    };

    return next();
  } catch (err) {
    console.error('🔥 Reset-password error:', err);
    doc._skipInsert = true;
    doc._response = {
      success: false,
      message: 'Reset-password failed',
      error: err.message
    };
    return next();
  }
};
