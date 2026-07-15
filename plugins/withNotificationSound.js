const { withAndroidManifest } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const withNotificationSound = (config) => {
  return withAndroidManifest(config, async (config) => {
    const projectRoot = config.modRequest.projectRoot;
    const assetsSoundsPath = path.join(projectRoot, 'assets', 'sounds');
    const resRawPath = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'raw');

    if (fs.existsSync(assetsSoundsPath)) {
      const files = fs.readdirSync(assetsSoundsPath);
      for (const file of files) {
        if (!fs.existsSync(resRawPath)) {
          fs.mkdirSync(resRawPath, { recursive: true });
        }
        fs.copyFileSync(path.join(assetsSoundsPath, file), path.join(resRawPath, file));
        console.log(`[withNotificationSound] Copied ${file} to android res/raw`);
      }
    }

    return config;
  });
};

module.exports = withNotificationSound;
