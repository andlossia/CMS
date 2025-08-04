const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { exec } = require('node:child_process');
const { fetch } = require('undici');
const { v4: uuidv4 } = require('uuid');
const ffprobe = require('ffprobe');
const ffprobeStatic = require('ffprobe-static');



function execPromise(cmd) {
  return new Promise((resolve, reject) => {
    exec(cmd, (err, stdout, stderr) => (err ? reject(err) : resolve(stdout)));
  });
}

async function processVideo(finalUrl) {
  try {
    const info = await ffprobe(finalUrl, { path: ffprobeStatic.path });
    const videoStream = info.streams.find(s => s.codec_type === 'video');
    const audioStream = info.streams.find(s => s.codec_type === 'audio');

    return {
      duration: parseFloat(info.format.duration),
      resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : null,
      videoHeight: videoStream?.height || null,
      videoCodec: videoStream?.codec_name || null,
      audioCodec: audioStream?.codec_name || null,
    };
  } catch (err) {
    console.error('❌ Failed to analyze video:', err.message);
    return { error: err.message };
  }
}


async function isMoovAtomAtStart(finalUrl) {
  const chunkSize = 1024 * 1024;
  const [headRes, tailRes] = await Promise.all([
    fetch(finalUrl, { headers: { Range: `bytes=0-${chunkSize - 1}` } }),
    fetch(finalUrl, { headers: { Range: `bytes=-${chunkSize}` } }),
  ]);

  const head = Buffer.from(await headRes.arrayBuffer());
  const tail = Buffer.from(await tailRes.arrayBuffer());

  const headHasMoov = head.includes(Buffer.from('moov'));
  const tailHasMoov = tail.includes(Buffer.from('moov'));

  return headHasMoov && !tailHasMoov;
}

async function fixMoovIfNeeded(finalUrl, safeName, mimetype, uploadFn) {
  const hasMoov = await isMoovAtomAtStart(finalUrl);
  if (hasMoov) return finalUrl;

  const fixedBuffer = await moveMoovAtomToFront(finalUrl);
  const { finalUrl: newUrl } = await uploadFn(fixedBuffer, safeName, mimetype);
  return newUrl;
}



async function moveMoovAtomToFront(finalUrl) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'moovfix-'));
  const inputPath = path.join(tempDir, 'input.mp4');
  const outputPath = path.join(tempDir, 'fixed.mp4');

  const res = await fetch(finalUrl);
  fs.writeFileSync(inputPath, Buffer.from(await res.arrayBuffer()));

  const cmd = `ffmpeg -y -i "${inputPath}" -movflags faststart -acodec copy -vcodec copy "${outputPath}"`;
  await execPromise(cmd);

  const fixedBuffer = fs.readFileSync(outputPath);
  fs.rmSync(tempDir, { recursive: true, force: true });

  return fixedBuffer;
}


async function analyzeVideo(finalUrl) {
  try {
    const info = await ffprobe(finalUrl, { path: ffprobeStatic.path });
    const videoStream = info.streams.find(s => s.codec_type === 'video');
    const audioStream = info.streams.find(s => s.codec_type === 'audio');

    return {
      duration: parseFloat(info.format.duration),
      resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : null,
      videoHeight: videoStream?.height || null,
      videoCodec: videoStream?.codec_name || null,
      audioCodec: audioStream?.codec_name || null,
    };
  } catch (err) {
    console.error('❌ Failed to analyze video:', err.message);
    return null;
  }
}


function getVideoQualityPlan(videoHeight) {
  const qualityMap = [
    { label: 'HD', height: 720 },
    { label: 'FHD', height: 1080 },
    { label: '2K', height: 1440 },
    { label: '4K', height: 2160 },
  ];
  const labels = qualityMap.map(q => q.label);
  const over4K = videoHeight > qualityMap[3].height;
  const original = qualityMap.find(q => videoHeight <= q.height);
  if (!original || original.label === 'HD') return { shouldProcess: false, resolutionsToGenerate: [], deleteOriginal: false };
  if (over4K) return { shouldProcess: true, resolutionsToGenerate: labels.slice(0, 3), deleteOriginal: true };
  const idx = qualityMap.findIndex(q => q.label === original.label);
  return { shouldProcess: true, resolutionsToGenerate: labels.slice(0, idx), deleteOriginal: false };
}


async function processVideoToHLS({ finalUrl, resolutions, uploadFn }) {
  const qualityMap = {
    HD: { w: 1280, h: 720, bitrate: 1400 },
    FHD: { w: 1920, h: 1080, bitrate: 2800 },
    '2K': { w: 2560, h: 1440, bitrate: 5000 },
  };
  const tempId = uuidv4();
  const tempDir = path.join(os.tmpdir(), `hls_${tempId}`);
  fs.mkdirSync(tempDir);
  const inputPath = path.join(tempDir, 'input.mp4');

  try {
    const response = await fetch(finalUrl);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(inputPath, buffer);

    const master = ['#EXTM3U', '#EXT-X-VERSION:3'];
    const uploaded = {};

    for (const res of resolutions) {
      const q = qualityMap[res];
      const m3u8 = `${res}.m3u8`;
      const segment = path.join(tempDir, `${res}_%03d.ts`);
      const out = path.join(tempDir, m3u8);

      const cmd = `ffmpeg -i "${inputPath}" -vf scale=${q.w}:${q.h} -c:a aac -b:a 128k -c:v h264 -crf 20 -g 48 -keyint_min 48 -b:v ${q.bitrate}k -maxrate ${q.bitrate * 1.2}k -bufsize ${q.bitrate * 2}k -hls_time 4 -hls_playlist_type vod -hls_segment_filename "${segment}" "${out}"`;
      await execPromise(cmd);

      master.push(`#EXT-X-STREAM-INF:BANDWIDTH=${q.bitrate * 1000},RESOLUTION=${q.w}x${q.h}`);
      master.push(m3u8);
    }

    const masterPath = path.join(tempDir, 'master.m3u8');
    fs.writeFileSync(masterPath, master.join('\n'));

    for (const file of fs.readdirSync(tempDir)) {
      const buffer = fs.readFileSync(path.join(tempDir, file));
      const { finalUrl } = await uploadFn(buffer, `hls/${tempId}/${file}`);
      uploaded[file] = finalUrl;
    }

    return {
      masterUrl: uploaded['master.m3u8'],
      variants: resolutions.map(res => ({
        quality: res,
        url: uploaded[`${res}.m3u8`],
      })),
    };
  } catch (err) {
    console.error('❌ HLS conversion failed:', err.message);
    return null;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

module.exports = {
  fixMoovIfNeeded,
  processVideo,
  isMoovAtomAtStart,
  moveMoovAtomToFront,
  analyzeVideo,
  getVideoQualityPlan,
  processVideoToHLS,
};