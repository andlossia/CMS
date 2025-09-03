const { loadCollection } = require('../../../database');

exports.handle = async (doc, next, context, { providerKey, identifier, payload, providerPlugin }) => {
  try {
    // تحميل مجموعة الحسابات
    const accounts = await loadCollection('authentications');
    if (!accounts || typeof accounts.findOne !== 'function') {
      throw new Error('Failed to load accounts collection');
    }

    // البحث عن الحساب
    const account = await accounts.findOne({ provider: providerKey, identifier });

    // ⚠️ لا نفصح للمهاجم إذا الحساب غير موجود
    if (!account) {
      doc._skipInsert = true;
      doc._response = {
        success: true,
        message: 'If the account exists, reset instructions have been sent.'
      };
      return next();
    }

    // توليد رمز إعادة تعيين كلمة المرور
    const resetToken = Math.random().toString(36).substring(2, 10).toUpperCase();
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 دقيقة

    // تحديث الحساب
    await accounts.updateOne(
      { _id: account._id },
      { $set: { reset_token: resetToken, reset_expires: resetExpires } }
    );

    // TODO: إرسال التوكن للبريد أو SMS حسب المزود
    // providerPlugin.sendResetToken(account, resetToken);

    doc._skipInsert = true;
    doc._response = {
      success: true,
      message: 'If the account exists, reset instructions have been sent.'
    };

    return next();
  } catch (err) {
    console.error('🔥 Forgot-password error:', err);
    doc._skipInsert = true;
    doc._response = {
      success: false,
      message: 'Forgot-password request failed',
      error: err.message
    };
    return next();
  }
};
