const { fetch } = require('undici');
const { processImage, convertToWebp } = require('./image');
const { processVideo, fixMoovIfNeeded, processVideoToHLS, getVideoQualityPlan } = require('./video');

async function mediaProcessor({ safeName, finalUrl, mimetype, mediaType, source, webhookUrl, uploadFn, deleteFn }) {
  let metadata = null;

  if (mediaType === 'image') {
    metadata = await processImage(finalUrl);
    console.log('📐 Image metadata:', metadata);

    if (metadata?.format?.toLowerCase() !== 'webp') {
      const webp = await convertToWebp({ finalUrl, safeName, uploadFn });

      if (webp?.url) {
        console.log('✅ WebP uploaded:', webp.url);
        metadata.webp = webp;

        // 🗑️ حذف الصورة الأصلية بعد نجاح التحويل
        if (typeof deleteFn === 'function') {
          try {
            await deleteFn(safeName);
            metadata.webp.originalDeleted = true;
            console.log('🗑️ Original image deleted from storage');
          } catch (err) {
            metadata.webp.originalDeleted = false;
            console.warn('⚠️ Failed to delete original image:', err.message);
          }
        }
      } else {
        console.warn('⚠️ WebP conversion skipped or failed');
        metadata.webp = { error: webp?.error || 'Conversion failed' };
      }
    }
  }

  if (mediaType === 'video') {
    finalUrl = await fixMoovIfNeeded(finalUrl, safeName, mimetype, uploadFn);
    metadata = await processVideo(finalUrl);

    const plan = getVideoQualityPlan(metadata?.videoHeight || 0);
    metadata.qualityPlan = plan;

    if (plan.shouldProcess) {
      const hls = await processVideoToHLS({ finalUrl, resolutions: plan.resolutionsToGenerate, uploadFn });

      if (hls) {
        metadata.hls = { ...hls, deleteOriginal: plan.deleteOriginal };

        if (plan.deleteOriginal && typeof deleteFn === 'function') {
          try {
            await deleteFn(safeName);
            metadata.hls.originalDeleted = true;
            console.log('🗑️ Original video deleted from storage');
          } catch (e) {
            metadata.hls.originalDeleted = false;
            console.warn('⚠️ Could not delete original:', e.message);
          }
        }
      }
    }
  }

  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          safeName,
          finalUrl,
          mimetype,
          mediaType,
          source,
          metadata,
          event: 'media.processed',
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error('❌ Failed to send webhook:', err.message);
    }
  }

  return metadata;
}

module.exports = { mediaProcessor };
