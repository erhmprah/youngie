const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const withCallKeep = (config) => {
  return withAndroidManifest(config, async (config) => {
    const manifest = config.modResults;
    const mainApplication = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);

    // Add permissions required by CallKeep
    AndroidConfig.Permissions.addPermission(manifest, 'android.permission.BIND_TELECOM_CONNECTION_SERVICE');
    AndroidConfig.Permissions.addPermission(manifest, 'android.permission.FOREGROUND_SERVICE');
    AndroidConfig.Permissions.addPermission(manifest, 'android.permission.MANAGE_OWN_CALLS');
    // Required for Android 14+
    AndroidConfig.Permissions.addPermission(manifest, 'android.permission.FOREGROUND_SERVICE_MICROPHONE');
    AndroidConfig.Permissions.addPermission(manifest, 'android.permission.FOREGROUND_SERVICE_CAMERA');

    // Add the VoiceConnectionService
    if (!mainApplication.service) {
      mainApplication.service = [];
    }

    const serviceName = 'io.wazo.callkeep.VoiceConnectionService';
    const existingService = mainApplication.service.find(
      (s) => s.$['android:name'] === serviceName
    );

    if (!existingService) {
      mainApplication.service.push({
        $: {
          'android:name': serviceName,
          'android:label': 'Wazo',
          'android:permission': 'android.permission.BIND_TELECOM_CONNECTION_SERVICE',
          'android:foregroundServiceType': 'camera|microphone',
          'android:exported': 'true',
        },
        'intent-filter': [
          {
            action: [
              {
                $: {
                  'android:name': 'android.telecom.ConnectionService',
                },
              },
            ],
          },
        ],
      });
    }

    return config;
  });
};

module.exports = withCallKeep;