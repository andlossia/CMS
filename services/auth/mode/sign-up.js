const argon2 = require('argon2');
const { loadSchema, loadCollection } = require('../../../database');

exports.handle = async (doc, next, context, { providerKey, identifier, payload, providerPlugin }) => {
  try {
    // تحميل الـ schemas
    const authModel = await loadSchema('auth');
    const userModel = await loadSchema('user');

    if (!authModel || !userModel) {
      throw new Error('Missing schema definition');
    }

    // تحميل الـ collections
    const accounts = await loadCollection(authModel.name.collection); // authentications
    const users = await loadCollection(userModel.name.collection);    // users

    // التأكد من عدم وجود حساب مسبقًا
    const existing = await accounts.findOne({ provider: providerKey, identifier });
    if (existing) throw new Error('Account already exists');

    // التحقق من مزود خارجي إن وجد
    if (providerPlugin && typeof providerPlugin.providerRequest === 'function') {
      const result = await providerPlugin.providerRequest(payload);
      if (!result || !result.account) {
        throw new Error('External provider authentication failed');
      }
    }

    // 🔒 تشفير كلمة المرور
    const passwordHash = await argon2.hash(payload.secret, { type: argon2.argon2id });

    // إنشاء مستخدم جديد
    const userDoc = {
      email: identifier,
      username: identifier.split('@')[0],
      status: 'active',
      created_at: new Date()
    };
    const userResult = await users.insertOne(userDoc);

    // إنشاء سجل authentication مرتبط بالمستخدم
    const authDoc = {
      userId: userResult.insertedId,
      provider: providerKey,
      identifier,
      local: {
        password_hash: passwordHash,
        one_time_password: false,
        email_verified: false
      },
      linked_at: new Date()
    };
    await accounts.insertOne(authDoc);

    // تجهيز الرد
    doc.userId = userResult.insertedId;
    doc.identifier = identifier;
    doc.provider = providerKey;
    doc.mode = 'sign-up';
    doc._response = {
      success: true,
      message: 'Account created successfully',
      data: {
        userId: doc.userId,
        provider: doc.provider,
        identifier: doc.identifier
      }
    };

    return next();
  } catch (err) {
    doc._skipInsert = true;
    doc._response = {
      success: false,
      message: 'Sign-up failed',
      error: err.message
    };
    return next();
  }
};
