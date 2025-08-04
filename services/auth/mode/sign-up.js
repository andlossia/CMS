const { loadSchema, loadCollection } = require('../../../database');

exports.handle = async (doc, next, context, { providerKey, identifier, payload, providerPlugin }) => {
  try {
    // تحميل الـ schemas
    const authModel = await loadSchema('auth');
    const userModel = await loadSchema('user');

    console.log('authModel', authModel);
    console.log('userModel', userModel);

    if (!authModel || !userModel) {
      throw new Error('Missing schema definition');
    }

    // تحميل collections باستخدام الاسم الجمع
    
    const accounts = await loadCollection(authModel.name.plural);
    const users = await loadCollection(userModel.name.plural);


    console.log('accounts', accounts);
    console.log('users', users);

    if (!accounts || typeof accounts.findOne !== 'function') {
      throw new Error('Failed to load accounts collection');
    }

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

    // إنشاء مستخدم جديد
  const userDoc = {
  email: identifier,
  username: identifier.split('@')[0], // أو أي منطق آخر لاستخلاص اسم المستخدم
  status: 'active',
  created_at: new Date()
};

    const userResult = await users.insertOne(userDoc);

    // تجهيز مستند المصادقة
    doc.userId = userResult.insertedId;
    doc.identifier = identifier;
    doc.provider = providerKey;
    doc.mode = 'sign-up';
    doc.local = {
      password_hash: payload.secret,
      one_time_password: false,
      email_verified: false
    };
    doc.linked_at = new Date();

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
