const { fetch } = require('undici');
const Jimp = require('jimp');



async function processImage(finalUrl) {
  try {
    const response = await fetch(finalUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer || buffer.length === 0) {
      throw new Error('Downloaded image buffer is empty');
    }

    const image = await Jimp.read(buffer);
    const mime = image.getMIME();

    return {
      width: image.bitmap.width,
      height: image.bitmap.height,
      format: mime.split('/')[1], // e.g., "image/jpeg" → "jpeg"
    };
  } catch (err) {
    console.error('❌ Failed to process image:', err.message);
    return { error: err.message };
  }
}

async function convertToWebp({ finalUrl, safeName, uploadFn }) {
  try {
    const response = await fetch(finalUrl);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.status}`);

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer || buffer.length === 0) {
      throw new Error('Downloaded image buffer is empty');
    }

    const image = await Jimp.read(buffer);
    const webpBuffer = await image.quality(80).getBufferAsync(Jimp.MIME_WEBP);

    if (!webpBuffer || webpBuffer.length === 0) {
      throw new Error('WebP buffer is empty');
    }

    const webpName = safeName.replace(/\.[^.]+$/, '.webp');
    const { finalUrl: webpUrl } = await uploadFn(webpBuffer, webpName, 'image/webp');

    return {
      originalName: safeName,
      newName: webpName,
      url: webpUrl,
      size: webpBuffer.length,
      format: 'webp',
      width: image.bitmap.width,
      height: image.bitmap.height,
    };
  } catch (err) {
    console.error('❌ Failed to convert to WebP:', err.message);
    return { error: err.message };
  }
}


module.exports = {
  processImage,
  convertToWebp,
};
