const path = require('node:path');
const { v4: uuidv4 } = require('uuid');
const { loadSchema } = require('../../database');
const { loadPlugins } = require('../../helpers/pluginLoader');

// -------------------- 1. تحميل البلغنز --------------------
const storagePlugins = {};
const pluginsDir = path.join(__dirname, 'cloud');

loadPlugins({
  dir: pluginsDir,
  expectedFunction: 'generateSignedUploadUrl',
  storeObject: storagePlugins,
  serviceName: 'storage'
});

function getStoragePlugin(name = 'gcs') {
  const plugin = storagePlugins[name];
  if (plugin) return plugin;
  console.error(`❌ Storage plugin "${name}" not found.`);
  throw new Error(`Storage plugin "${name}" not found.`);
}

// -------------------- 2. تحميل سكيما الميديا --------------------
async function loadMediaSchema(forceRefresh = false) {
  return loadSchema('media', forceRefresh);
}

// -------------------- 3. مساعدات الوصول للحقول --------------------
function getFieldEnum(schema, fieldName) {
  return schema.fields.find(f => f.name === fieldName && f.enum)?.enum || null;
}

// -------------------- 4. تحديد نوع الوسيط --------------------
async function getMediaType(extension) {
  const variant = await getMediaVariantInfo(extension);
  return variant?.type || null;
}

async function getMediaVariantInfo(extension) {
  const schema = await loadMediaSchema();
  extension = extension.toLowerCase();
  const enumMap = getFieldEnum(schema, 'type');

  if (!enumMap) return null;

  for (const [type, def] of Object.entries(enumMap)) {
    const exts = def?.mediaExtensions || def?.extensions;
    if (exts?.map(e => e.toLowerCase()).includes(extension)) {
      return { type, label: def.label, def };
    }
  }

  return null;
}

// -------------------- 5. توليد Mimetype --------------------
function getMimeType(mediaType, extension) {
  const map = {
    image: `image/${extension}`,
    video: `video/${extension}`,
    audio: `audio/${extension}`,
    file: 'application/octet-stream'
  };
  return map[mediaType] || 'application/octet-stream';
}

// -------------------- 6. الحد الأعلى للحجم --------------------
async function getMaxAllowedSize(mediaType) {
  const schema = await loadMediaSchema();
  const def = getFieldEnum(schema, 'type')?.[mediaType];
  return def?.fileSizeLimit
    ? def.fileSizeLimit * 1024 * 1024
    : 500 * 1024 * 1024; // default 500MB
}

// -------------------- 7. تحديد مزود التخزين --------------------
async function determineStorageSource(mediaType, sizeInBytes, preferredSource) {
  const schema = await loadMediaSchema();
  const validSources = Object.keys(getFieldEnum(schema, 'storage.source') || {});

  if (preferredSource && validSources.includes(preferredSource)) {
    return preferredSource;
  }

  const def = getFieldEnum(schema, 'type')?.[mediaType];
  const rules = def?.storage || {};

  const pluginEntries = Object.entries(storagePlugins).filter(([name, plugin]) =>
    plugin.capabilities?.maxFileSize > sizeInBytes
  );

  if (rules.ifSizeGreaterThanMB && rules.then) {
    const limit = rules.ifSizeGreaterThanMB * 1024 * 1024;
    if (sizeInBytes > limit && validSources.includes(rules.then)) {
      return rules.then;
    }
  }

  const preferred = pluginEntries.find(([name]) => validSources.includes(name));
  return preferred?.[0] || rules.default || 'gcs';
}

// -------------------- 8. توليد اسم آمن للملف --------------------
function generateSafeName(filename, mediaType) {
  const ext = path.extname(filename).toLowerCase();
  return `${mediaType}/${uuidv4()}${ext}`;
}

// -------------------- 9. دالة تحقق من مزود --------------------
async function isValidStorageSource(source) {
  const schema = await loadMediaSchema();
  const enumMap = getFieldEnum(schema, 'storage.source');
  return !!enumMap?.[source];
}

// -------------------- 10. التصدير --------------------
module.exports = {
  loadSchema,
  loadMediaSchema,
  getFieldEnum,
  getMediaType,
  getMediaVariantInfo,
  getMimeType,
  getMaxAllowedSize,
  determineStorageSource,
  generateSafeName,
  getStoragePlugin,
  isValidStorageSource,
  storagePlugins
};
