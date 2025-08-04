const { Storage } = require('@google-cloud/storage');

const GCS_BUCKET_NAME = process.env.GCS_BUCKET_NAME;
const GCS_KEYFILE = process.env.GCS_KEYFILE_BASE64;
const GCS_PROJECT_ID = process.env.GCS_PROJECT_ID;

if (!GCS_BUCKET_NAME || !GCS_KEYFILE || !GCS_PROJECT_ID) {
  throw new Error('Missing GCS environment variables');
}

let credentials;
try {
  credentials = JSON.parse(Buffer.from(GCS_KEYFILE, 'base64').toString('utf8'));
} catch (err) {
  throw new Error('Failed to parse GCS_KEYFILE_BASE64');
}

const storage = new Storage({ credentials, projectId: GCS_PROJECT_ID });
const bucket = storage.bucket(GCS_BUCKET_NAME);

function getPublicUrl(filename) {
  return `https://storage.googleapis.com/${GCS_BUCKET_NAME}/${filename}`;
}

async function generateSignedUploadUrl({ safeName, mimetype, expiresIn = 600, accessLevel = 'public' }) {
  const file = bucket.file(safeName);
  const [uploadUrl] = await file.getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: Date.now() + expiresIn * 1000,
    contentType: mimetype,
  });

  // ✅ دائمًا استخدم رابط View موقّع
  const signedViewUrl = await getSignedViewUrl(safeName, 3600);

  return {
    uploadUrl,
    finalUrl: signedViewUrl, // تم التعديل هنا ✅
    headers: { 'Content-Type': mimetype },
    method: 'PUT',
  };
}


async function getSignedViewUrl(filePath, expiresInSeconds = 3600) {
  const file = bucket.file(filePath);
  const [url] = await file.getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInSeconds * 1000,
  });
  return url;
}

async function uploadFile(buffer, fileName, mimetype = 'application/octet-stream') {
  const file = bucket.file(fileName);
  await file.save(buffer, { contentType: mimetype });
  return {
    finalUrl: getPublicUrl(fileName),
    size: buffer.length,
  };
}

async function deleteFile(filePath) {
  await bucket.file(filePath).delete().catch(err => {
    console.warn(`❌ Failed to delete file ${filePath}:`, err.message);
    throw err;
  });
}

module.exports = {
  label: 'Google Cloud Storage',
  source: 'gcs',
  generateSignedUploadUrl,
  getSignedViewUrl,
  uploadFile,
  deleteFile,
  getPublicUrl,
  capabilities: {
    supportsStreaming: true,
    supportsTransformation: true,
    supportsWebhookTrigger: true,
    maxFileSize: 10 * 1024 * 1024 * 1024, // 10GB
    regions: ['global'],
  },
};

