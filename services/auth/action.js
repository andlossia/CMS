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
    if (!doc.mode || typeof doc.mode !== 'object') {
      throw new Error('Missing or invalid mode');
    }

    const modeKey = Object.keys(doc.mode)[0];
    if (!modeKey || !modeHandlers[modeKey]) {
      throw new Error(`Unsupported or missing mode handler: ${modeKey}`);
    }

    const providerObj = doc.mode[modeKey]?.provider;
    if (!providerObj || typeof providerObj !== 'object') {
      throw new Error('Missing or invalid provider object');
    }

    const providerKey = Object.keys(providerObj)[0];
    const payload = providerObj[providerKey] || {};
    const identifier = (payload.identifier || '').toLowerCase();

    if (!identifier) {
      throw new Error('Missing identifier');
    }

    console.log(`🚀 Auth request: mode="${modeKey}", provider="${providerKey}", identifier="${identifier}"`);

    const providerPlugin = providerKey !== 'local'
      ? getProvidersPlugin(providerKey)
      : null;

    if (providerPlugin) {
      console.log(`🔌 External provider plugin loaded for: ${providerKey}`);
    }

    await modeHandlers[modeKey].handle(doc, next, context, {
      providerKey,
      identifier,
      payload,
      providerPlugin
    });

    if (doc._response) {
      console.log(`✅ Auth handler completed:`, doc._response);
    }

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
