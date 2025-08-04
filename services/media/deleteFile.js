const { getStoragePlugin } = require('./mediaUtils');

async function deleteFromStorage({ safeName, source }) {
  if (!safeName || !source) {
    throw new Error('Missing "safeName" or "source" for deletion');
  }

  const plugin = getStoragePlugin(source);

  if (!plugin || typeof plugin.deleteFile !== 'function') {
    throw new Error(`Storage plugin "${source}" does not support deletion`);
  }

  await plugin.deleteFile(safeName);

  return {
    success: true,
    deleted: safeName,
    source,
  };
}

module.exports = { deleteFromStorage };
