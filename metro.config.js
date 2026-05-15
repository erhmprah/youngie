const { getDefaultConfig } = require('expo/metro-config');
const { pathToFileURL } = require('url');
const { resolve } = require('path');

const config = getDefaultConfig(process.cwd());

config.server = {
  ...config.server,
  hostname: '0.0.0.0',
};

config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
  unstable_conditionNames: ['browser', 'require', 'react-native'],
  alias: {
    'react-native-reanimated': resolve(__dirname, 'node_modules', 'react-native-reanimated', 'lib', 'module', 'index.js'),
  },
};

module.exports = config;