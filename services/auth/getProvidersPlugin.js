const { loadPlugins } = require('../../helpers/pluginLoader');
const path = require('node:path');

const providerPlugins = {};

const providerResult = loadPlugins({
  dir: path.join(__dirname, 'provider'),
  expectedFunction: 'providerRequest',
  storeObject: providerPlugins,
  serviceName: 'provider'
});

function getProvidersPlugin(name = 'google') {
  if (providerPlugins[name]) return providerPlugins[name];
  throw new Error(`Provider plugin "${name}" not found.`);
}

module.exports = { getProvidersPlugin, providerResult };
