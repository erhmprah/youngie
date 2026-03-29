// get-turn-credentials.js
// Script to get TURN credentials from Metered.ca for WebRTC

const https = require('https');

console.log('🔄 Getting TURN credentials from Metered.ca...\n');

// Metered API key from environment
const METERED_API_KEY = process.env.METERED_API_KEY;

if (!METERED_API_KEY) {
  console.log('❌ Please set your Metered API key:');
  console.log('   export METERED_API_KEY=your_api_key');
  console.log('\n📝 Get free API key from: https://www.metered.ca/');
  console.log('   1. Sign up for free at Metered.ca');
  console.log('   2. Create a new project in dashboard');
  console.log('   3. Go to Project Settings → API Keys');
  console.log('   4. Copy your API key');
  process.exit(1);
}

const options = {
  hostname: 'api.metered.ca',
  port: 443,
  path: `/api/v1/turn/credentials?apiKey=${METERED_API_KEY}`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = https.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);

      if (Array.isArray(response) && response.length > 0) {
        console.log('✅ TURN credentials obtained from Metered!\n');
        console.log('📋 Add these to your backend/.env file:\n');

        response.forEach(server => {
          if (server.urls && server.urls.startsWith('turn:')) {
            console.log(`TURN_SERVER_URL=${server.urls}`);
            if (server.username) console.log(`TURN_USERNAME=${server.username}`);
            if (server.credential) console.log(`TURN_CREDENTIAL=${server.credential}`);
            console.log('');
          }
        });

        console.log('💡 Alternative: You can also set METERED_API_KEY in .env');
        console.log('   and the server will fetch credentials automatically.\n');

      } else {
        console.log('❌ Failed to get TURN credentials');
        console.log('Response:', response);
      }
    } catch (error) {
      console.log('❌ Error parsing response:', error.message);
    }
  });
});

req.on('error', (error) => {
  console.log('❌ Request failed:', error.message);
  console.log('\n💡 Make sure your METERED_API_KEY is correct');
  console.log('   Get one free at: https://www.metered.ca/');
});

req.end();