const path = require('node:path');
const {
  getMediaType,
  determineStorageSource,
  getMaxAllowedSize,
  generateSafeName,
  getStoragePlugin
} = require('./mediaUtils');

async function uploadSignedUrl(req, res) {
  try {
    const {
      filename,
      mimetype,
      sizeInBytes,
      preferredSource,
      expiresIn = 600,  
      accessLevel = 'public'  
    } = req.body;

    if (!filename || !mimetype || typeof sizeInBytes !== 'number') {
      return res.badRequest('Missing or invalid fields: filename, mimetype, sizeInBytes');
    }

    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const mediaType = await getMediaType(ext);
    if (!mediaType) {
      return res.unsupportedMediaType(`Unsupported extension: .${ext}`);
    }

    const maxSize = await getMaxAllowedSize(mediaType);
    if (sizeInBytes > maxSize) {
      return res.payloadTooLarge(`File too large: ${sizeInBytes} > ${maxSize}`);
    }

    const source = await determineStorageSource(mediaType, sizeInBytes, preferredSource);
    const plugin = getStoragePlugin(source);

    const safeName = generateSafeName(filename, mediaType);

    const signedPayload = await plugin.generateSignedUploadUrl({
      filename,
      safeName,
      mimetype,
      sizeInBytes,
      mediaType,
      userId: req.user?.id || null,
      expiresIn,
      accessLevel
    });

    return res.success({
      uploadUrl: signedPayload.uploadUrl,
      finalUrl: signedPayload.finalUrl,
      headers: signedPayload.headers || {},
      method: signedPayload.method || 'PUT',
      safeName,
      storageSource: source,
      mediaType
    });

  } catch (err) {
    console.error('❌ Failed to generate signed upload URL:', err);
    return res.internalServerError('Error generating signed URL');
  }
}

module.exports = { uploadSignedUrl };
