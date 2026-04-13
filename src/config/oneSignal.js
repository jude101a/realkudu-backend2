import dotenv from 'dotenv';
dotenv.config();


const ONE_SIGNAL_CONFIG = {
  appId: 'afca3b91-aa6c-4372-9384-ba42748acdda',
  apiKey: 'os_v2_app_v7fdxenknrbxfe4exjbhjcwn3l7fwk7nfk2uduurv4g5n5i7u2rek3pb4beodw44gxkv2w5ibwjlwu5pmazkpyrsidjsdgex2bxvq2i',
};



// Validate and warn about missing config
if (!ONE_SIGNAL_CONFIG.appId || !ONE_SIGNAL_CONFIG.apiKey) {
  console.warn(
    '⚠️ OneSignal configuration incomplete:\n' +
    `  - ONE_SIGNAL_APP_ID: ${ONE_SIGNAL_CONFIG.appId ? '✓' : '✗ NOT SET'}\n` +
    `  - ONE_SIGNAL_API_KEY: ${ONE_SIGNAL_CONFIG.apiKey ? '✓' : '✗ NOT SET'}\n` +
    'The send_to_all and send_to_user endpoints will return 500 errors.\n' +
    'Add these variables to your .env file or Render environment variables.'
  );
}

export default ONE_SIGNAL_CONFIG;