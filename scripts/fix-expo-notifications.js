const fs = require('fs');
const path = require('path');

const targetPath = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-notifications',
  'android',
  'src',
  'main',
  'java',
  'expo',
  'modules',
  'notifications',
  'serverregistration',
  'InstallationId.java'
);

if (!fs.existsSync(targetPath)) {
  console.error('❌ InstallationId.java not found at expected path');
  process.exit(1);
}

let content = fs.readFileSync(targetPath, 'utf8');

const original = `      String line = bufferedReader.readLine();
      // If line is not a UUID, it throws an IllegalArgumentException
      return UUID.fromString(line).toString();`;

const patched = `      String line = bufferedReader.readLine();
      if (line == null) {
        return null;
      }
      // If line is not a UUID, it throws an IllegalArgumentException
      return UUID.fromString(line).toString();`;

if (content.includes(patched)) {
  console.log('✅ expo-notifications InstallationId.java patch already applied');
  process.exit(0);
}

if (!content.includes(original)) {
  console.error('❌ Could not find expected code to patch in InstallationId.java');
  process.exit(1);
}

content = content.replace(original, patched);
fs.writeFileSync(targetPath, content, 'utf8');
console.log('✅ Patched expo-notifications InstallationId.java for NullPointerException fix');
