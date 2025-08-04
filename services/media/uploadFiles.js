const { getStoragePlugin, getMediaType, determineStorageSource, generateSafeName, getMimeType, getMaxAllowedSize } = require('./mediaUtils');
const { mediaProcessor } = require('./processing/processor'); 
const path = require('node:path');

// 🔹 1. توليد Signed URL لرفع ملف
async function generateSignedUpload({ originalName, sizeInBytes, preferredSource }) {
  if (!originalName || !sizeInBytes) {
    throw new Error('Missing required fields: originalName or sizeInBytes');
  }

  const ext = path.extname(originalName).replace('.', '').toLowerCase();
  const mediaType = await getMediaType(ext);
  if (!mediaType) {
    throw new Error(`Unsupported file extension: ${ext}`);
  }

  const maxSize = await getMaxAllowedSize(mediaType);
  if (sizeInBytes > maxSize) {
    throw new Error(`File exceeds max allowed size (${(maxSize / 1024 / 1024).toFixed(1)}MB)`);
  }

  const safeName = generateSafeName(originalName, mediaType);
  const storageSource = await determineStorageSource(mediaType, sizeInBytes, preferredSource);
  const plugin = getStoragePlugin(storageSource);

  const mimetype = getMimeType(mediaType, ext);

  const result = await plugin.generateSignedUploadUrl({
    safeName,
    originalName,
    sizeInBytes,
    mimetype,
  });

  return {
    ...result,
    safeName,
    mimetype,
    mediaType,
    storageSource,
  };
}

// 🔹 2. تأكيد اكتمال الرفع ومعالجة الملف محليًا
async function handleUploadComplete({ safeName, mimetype, mediaType, storageSource, userId }) {
  const plugin = getStoragePlugin(storageSource);

  const finalUrl = plugin.getSignedViewUrl
    ? await plugin.getSignedViewUrl(safeName, 3600)
    : plugin.getPublicUrl?.(safeName);

  if (!finalUrl) {
    throw new Error('Cannot resolve final URL after upload');
  }

  // ⚙️ معالجة محلية بدون Webhook
  const metadata = await mediaProcessor({
    safeName,
    finalUrl,
    mimetype,
    mediaType,
    source: storageSource,
    webhookUrl: null,
    uploadFn: plugin.uploadFile,
    deleteFn: plugin.deleteFile,
  });

  return {
    safeName,
    finalUrl,
    mimetype,
    mediaType,
    metadata,
  };
}

module.exports = {
  generateSignedUpload,
  handleUploadComplete,
};
