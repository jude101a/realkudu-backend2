const ONE_SIGNAL_CONFIG = {
  appId: process.env.ONE_SIGNAL_APP_ID,
  apiKey: process.env.ONE_SIGNAL_API_KEY,
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