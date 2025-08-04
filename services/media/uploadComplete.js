const { getStoragePlugin } = require('./mediaUtils');
const { mediaProcessor } = require('../media/processing/processor');
const { dataDB } = require('../../database');

async function uploadComplete(req, res) {
  try {
    const {
      safeName,
      originalName,
      mimetype,
      sizeInBytes,
      mediaType,
      storageSource,
    } = req.body;

    if (!safeName || !mimetype || !mediaType || !storageSource || !originalName || !sizeInBytes) {
      return res.badRequest('Missing required fields');
    }

    const plugin = getStoragePlugin(storageSource);
    const finalUrl = plugin.getSignedViewUrl
      ? await plugin.getSignedViewUrl(safeName, 3600)
      : plugin.getPublicUrl?.(safeName);

    if (!finalUrl) {
      return res.internalServerError('Failed to resolve final URL');
    }

    // ✅ معالجة الوسيط (صورة أو فيديو)
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

    const doc = {
      type: mediaType,
      originalName,
      mimetype,
      size: sizeInBytes,
      createdAt: new Date(),
      user: req.user?.id || null,
      storage: {
        source: storageSource,
        path: safeName,
        url: finalUrl,
        bucket: plugin.bucketName || null,
      },
      metadata: metadata || null,
      status: metadata ? 'processed' : 'pending',
      processedAt: metadata ? new Date() : null,
      downloadCount: 0,
    };

    const result = await dataDB.collection('media').insertOne(doc);
    doc._id = result.insertedId;

    return res.created({ message: 'media created successfully', media: doc });
  } catch (err) {
    console.error('❌ Failed to finalize media upload:', err);
    return res.internalServerError('Error completing upload');
  }
}

module.exports = { uploadComplete };
