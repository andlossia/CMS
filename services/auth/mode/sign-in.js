const comparePassword = require('../comparePassword');
const { loadCollection } = require('../../../database');

exports.handle = async (doc, next, context, { providerKey, identifier, payload, providerPlugin }) => {
  const { signToken } = context;

  const accounts = loadCollection('authentications')
  let account = await accounts.findOne({ provider: providerKey, identifier });

  if (!account) {
    throw new Error('Account not found');
  }

  if (providerPlugin && typeof providerPlugin.providerRequest === 'function') {
    const externalAuth = await providerPlugin.providerRequest(payload);

    if (!externalAuth || !externalAuth.account) {
      throw new Error('External provider authentication failed');
    }

    account = externalAuth.account;
  } else {
    const hash = account?.local?.password_hash || '';
    const match = await comparePassword(payload.secret, hash);
    if (!match) throw new Error('Invalid password');
  }

  const token = signToken({ userId: account.userId, provider: providerKey }, '1h');

  doc._skipInsert = true;
  doc._response = {
    success: true,
    message: 'Login successful',
    token,
    data: {
      userId: account.userId,
      identifier,
      provider: providerKey
    }
  };

  return next();
};
