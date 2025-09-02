const argon2 = require('argon2');
const { loadSchema, loadCollection } = require('../../../database');

exports.handle = async (doc, next, context, { providerKey, identifier, payload, providerPlugin }) => {
  try {
    const authModel = await loadSchema('auth');
    const userModel = await loadSchema('user');

    if (!authModel || !userModel) {
      throw new Error('Missing schema definition');
    }

    const accounts = await loadCollection(authModel.name.plural); 
    const users = await loadCollection(userModel.name.plural);   

    const existing = await accounts.findOne({ provider: providerKey, identifier });
    if (existing) throw new Error('Account already exists');

    if (providerPlugin && typeof providerPlugin.providerRequest === 'function') {
      const result = await providerPlugin.providerRequest(payload);
      if (!result || !result.account) {
        throw new Error('External provider authentication failed');
      }
    }

    const passwordHash = await argon2.hash(payload.secret, { type: argon2.argon2id });

    const userDoc = {
      email: identifier,
      username: identifier.split('@')[0],
      status: 'active',
      created_at: new Date()
    };
    const userResult = await users.insertOne(userDoc);

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
