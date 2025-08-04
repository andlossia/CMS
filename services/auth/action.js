const getProvidersPlugin = require('./getProvidersPlugin');
const signIn = require('./mode/sign-in');
const signUp = require('./mode/sign-up');
const forgotPassword = require('./mode/forgot-password');
const resetPassword = require('./mode/reset-password');

const modeHandlers = {
  'sign-in': signIn,
  'sign-up': signUp,
  'forgot-password': forgotPassword,
  'reset-password': resetPassword
};

module.exports = async (doc, next, context) => {
  try {
    console.log('📥 Incoming doc:', JSON.stringify(doc, null, 2));
    console.log('📦 Context keys:', Object.keys(context));

    if (!doc.mode || typeof doc.mode !== 'object') {
      throw new Error('Missing or invalid mode');
    }

    const modeKey = Object.keys(doc.mode)[0];
    console.log('🔍 Detected modeKey:', modeKey);

    if (!modeKey || !modeHandlers[modeKey]) {
      throw new Error(`Unsupported or missing mode handler: ${modeKey}`);
    }

    const providerObj = doc.mode[modeKey]?.provider;
    if (!providerObj || typeof providerObj !== 'object') {
      throw new Error('Missing or invalid provider object');
    }

    const providerKey = Object.keys(providerObj)[0];
    const payload = providerObj[providerKey] || {};

    console.log('🔑 Provider key:', providerKey);
    console.log('📨 Payload:', payload);

    const identifier = (payload.identifier || '').toLowerCase();
    if (!identifier) {
      throw new Error('Missing identifier');
    }

    console.log('🆔 Identifier:', identifier);

    const providerPlugin = providerKey !== 'local'
      ? getProvidersPlugin(providerKey)
      : null;

    console.log('🔌 Provider plugin loaded:', !!providerPlugin);

    console.log(`🚀 Executing handler for mode "${modeKey}"...`);
    await modeHandlers[modeKey].handle(doc, next, context, {
      providerKey,
      identifier,
      payload,
      providerPlugin
    });

    console.log(`✅ Handler "${modeKey}" completed.`);

  } catch (err) {
    console.error('🔥 Auth error:', err);
    doc._skipInsert = true;
    doc._response = {
      success: false,
      message: 'Auth request failed',
      error: err.message
    };
    return next();
  }
};
