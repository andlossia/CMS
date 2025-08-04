const path = require('node:path');
const fs = require('node:fs');

function loadPlugins({
  dir,
  expectedFunction,
  storeObject,
  serviceName = 'plugin'
}) {
  if (!fs.existsSync(dir)) return { loaded: [], skipped: [], failed: [] };

  const files = fs.readdirSync(dir).filter(file => file.endsWith('.js'));

  const result = {
    loaded: [],
    skipped: [],
    failed: []
  };

  for (const file of files) {
    const name = path.basename(file, '.js');
    const filePath = path.join(dir, file);

    try {
      const plugin = require(filePath);

      if (typeof plugin[expectedFunction] === 'function') {
        storeObject[name] = plugin;
        console.log(`✅ ${name} (${serviceName}) connected successfully`);
        result.loaded.push(name);
      } else {
        console.warn(`⚠️ ${serviceName} "${name}" missing ${expectedFunction}`);
        result.skipped.push(name);
      }

    } catch (err) {
      console.error(`❌ Failed to load ${serviceName} "${name}": ${err.message}`);
      result.failed.push({ name, error: err.message });
    }
  }

  return result;
}

function printPluginSummary(resultsByService) {
  console.log('\n📦 Plugin loading summary:');

  const loaded = [];
  const skipped = [];
  const failed = [];

  for (const [serviceName, result] of Object.entries(resultsByService)) {
    loaded.push(...result.loaded.map(p => `${p} (${serviceName})`));
    skipped.push(...result.skipped.map(p => `${p} (${serviceName})`));
    failed.push(...result.failed.map(f => `${f.name} (${serviceName}) → ${f.error}`));
  }

  console.log(`  ✅ Loaded: ${loaded.join(', ') || 'none'}`);
  console.log(`  ⚠️ Skipped (no function): ${skipped.join(', ') || 'none'}`);
  console.log(`  ❌ Failed: ${failed.join(', ') || 'none'}`);
}

module.exports = {
  loadPlugins,
  printPluginSummary
};
