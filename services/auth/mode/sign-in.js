const argon2 = require('argon2');
const { loadCollection } = require('../../../database');

exports.handle = async (doc, next, context, { providerKey, identifier, payload, providerPlugin }) => {
  try {
    const { signToken } = context;

    const accounts = await loadCollection('authentications');
    if (!accounts || typeof accounts.findOne !== 'function') {
      throw new Error('Failed to load accounts collection');
    }

    // البحث عن الحساب
    let account = await accounts.findOne({ provider: providerKey, identifier });
    if (!account) {
      console.log('⚠️ Account not found in authentications. Trying to sync with users collection...');
      
      const users = await loadCollection('users');
      const user = await users.findOne({ email: identifier });
      
      if (!user) {
        throw new Error('Account not found');
      }

      // إنشاء auth record جديد إذا لم يكن موجود
      account = {
        userId: user._id,
        provider: providerKey,
        identifier,
        local: {}
      };
      await accounts.insertOne(account);
      console.log('ℹ️ Auth record created for existing user');
    }

    if (providerPlugin && typeof providerPlugin.providerRequest === 'function') {
      // مزود خارجي
      const externalAuth = await providerPlugin.providerRequest(payload);
      if (!externalAuth || !externalAuth.account) {
        throw new Error('External provider authentication failed');
      }
      account = externalAuth.account;
    } else {
      // التحقق من كلمة المرور
      if (!account.local?.password_hash) {
        throw new Error('No password set for this account');
      }

      const match = await argon2.verify(account.local.password_hash, payload.secret);
      if (!match) throw new Error('Invalid password');
    }

    // إنشاء JWT token
    const token = signToken({ userId: account.userId, provider: providerKey }, '1h');

    // تجهيز الرد
    doc._skipInsert = true;
    doc._response = {
      success: true,
      message: 'Login successful',
      token,
      data: {
        userId: account.userId,
        provider: providerKey,
        identifier
      }
    };

    return next();
  } catch (err) {
    doc._skipInsert = true;
    doc._response = {
      success: false,
      message: 'Sign-in failed',
      error: err.message
    };
    return next();
  }
};
