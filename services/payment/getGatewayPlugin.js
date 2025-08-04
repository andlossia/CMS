const { loadPlugins } = require('../../helpers/pluginLoader');
const path = require('node:path');

const gatewayPlugins = {};

const gatewayResult = loadPlugins({
  dir: path.join(__dirname, 'gateway'),
  expectedFunction: 'makegatewayRequest',
  storeObject: gatewayPlugins,
  serviceName: 'gateway'
});

function getGatewayPlugin(name = 'tranzila') {
  if (gatewayPlugins[name]) return gatewayPlugins[name];
  throw new Error(`Gateway plugin "${name}" not found.`);
}

module.exports = { getGatewayPlugin, gatewayResult };
