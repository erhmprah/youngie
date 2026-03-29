const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Configure Metro to be accessible from Android Emulator and physical devices
// Android Emulator accesses host via 10.0.2.2
// Physical devices on same network access via host's local IP
config.server = {
  // Enable HMR with proper host binding
  ...config.server,
  // Force Metro to listen on all interfaces (required for emulator/device access)
  hostname: '0.0.0.0',
};

// Fix for event-target-shim module resolution issue with react-native-webrtc
// This helps Metro properly resolve the module when it has non-standard exports
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: false,
  unstable_conditionNames: ['browser', 'require', 'react-native'],
};

module.exports = config;
