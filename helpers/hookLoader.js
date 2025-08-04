const { VM } = require('vm2');
const { signToken, verifyToken } = require('../utils/token');
const { dataDB, adminDB } = require('../database');
const mongoose = require('mongoose');

// Get hook document by ID
async function getHookById(id) {
  return await adminDB().collection('hooks').findOne({
    _id: new mongoose.Types.ObjectId(id)
  });
}

// Attach hook to Mongoose schema
function attachHook(schema, hookDoc) {
  const hookType = hookDoc.hookType; // e.g., preSave, postUpdate
  const [timing, event] = hookType.match(/(pre|post)(.*)/i).slice(1);
  const mongooseEvent = event.charAt(0).toLowerCase() + event.slice(1);

  schema[timing](mongooseEvent, async function (docOrNext, nextMaybe) {
    const doc = timing === 'post' ? docOrNext : this;

    // Always ensure nextFn is a function to avoid runtime errors
    const nextFn =
      typeof nextMaybe === 'function'
        ? nextMaybe
        : typeof docOrNext === 'function'
        ? docOrNext
        : () => {};

    try {
      const vm = new VM({
        timeout: hookDoc.config?.timeout || 1000,
        sandbox: {
  doc,
  signToken,
  verifyToken,
  adminDB: adminDB(),
  dataDB: dataDB(),
  require,
  console
},
      });

      const hookFn = vm.run(`(${hookDoc.logic})`);

      await hookFn(doc, nextFn, {
        adminDB: adminDB(),
        dataDB: dataDB(),
        signToken,
        require
      });
    } catch (err) {
      console.error('❌ Hook error:', err);
      return nextFn(err); // Proper error forwarding
    }
  });
}

module.exports = { getHookById, attachHook };
