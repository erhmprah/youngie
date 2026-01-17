// get-turn-credentials.js
// Script to help obtain TURN credentials for testing

const https = require('https');

console.log('🔄 Getting temporary TURN credentials from Twilio...\n');

// Twilio's temporary TURN endpoint (requires Account SID and Auth Token)
// For production, sign up at https://www.twilio.com/ and get permanent credentials

const ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || 'your-account-sid';
const AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || 'your-auth-token';

if (ACCOUNT_SID === 'your-account-sid' || AUTH_TOKEN === 'your-auth-token') {
  console.log('❌ Please set your Twilio credentials:');
  console.log('   export TWILIO_ACCOUNT_SID=your_account_sid');
  console.log('   export TWILIO_AUTH_TOKEN=your_auth_token');
  console.log('\n📝 Get credentials from: https://www.twilio.com/console');
  console.log('   1. Sign up for Twilio');
  console.log('   2. Go to Dashboard → Account Info');
  console.log('   3. Copy Account SID and Auth Token');
  process.exit(1);
}

const options = {
  hostname: 'api.twilio.com',
  port: 443,
  path: '/2010-04-01/Accounts/' + ACCOUNT_SID + '/Tokens.json',
  method: 'POST',
  auth: ACCOUNT_SID + ':' + AUTH_TOKEN,
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
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

      if (response.ice_servers) {
        console.log('✅ TURN credentials obtained!');
        console.log('\n📋 Add these to your backend/.env file:\n');

        response.ice_servers.forEach(server => {
          if (server.url.startsWith('turn:')) {
            console.log(`TURN_SERVER_URL=${server.url}`);
            console.log(`TURN_USERNAME=${server.username}`);
            console.log(`TURN_CREDENTIAL=${server.credential}`);
            console.log('');
          }
        });

        console.log('⚠️  Note: These credentials expire in 24 hours.');
        console.log('   For production, get permanent credentials from Twilio.');

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
  console.log('\n💡 Alternative: Use free TURN servers from:');
  console.log('   - Metered.ca: https://www.metered.ca/');
  console.log('   - Xirsys: https://xirsys.com/');
});

req.end();