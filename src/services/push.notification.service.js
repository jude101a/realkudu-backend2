import https from "https";
import ONE_SIGNAL_CONFIG from "../config/oneSignal.js";
import { fcm } from "../config/firebase.js";

export async function sendNotification(data, callback) {
    console.info('[push] sendNotification called', { oneSignalApp: process.env.ONE_SIGNAL_APP_ID ? true : false });
    // Input validation
    if (!data || typeof data !== 'object') {
        return callback(new Error('Invalid notification data'), null);
    }

    if (!ONE_SIGNAL_CONFIG.apiKey) {
        return callback(new Error('OneSignal API key not configured'), null);
    }

    const headers = {
  "Content-Type": "application/json; charset=utf-8",
  "Authorization": "key os_v2_app_nhcgwb466zcxri5otrdc6p3vehrb62o3jy7eqbf2avwnp63hnmwrgfgmcpoyz5vzxnlo7bmzaqrafppovwk6qignxwwqep46ksxba4q",
};

const options = {
  host: "api.onesignal.com",
  port: 443,
  path: "/notifications",
  method: "POST",
  headers,
};

    const req = https.request(options, function(res) {
        let responseData = '';
        
        // Handle chunked responses properly
        res.on("data", function(chunk) {
            responseData += chunk;
        });

        // Call callback when response ends
        res.on("end", function() {
            try {
                if (responseData) {
                    try {
                      const parsedData = JSON.parse(responseData);
                      console.info('[push] OneSignal response parsed', { id: parsedData?.id });
                      return callback(null, parsedData);
                    } catch (parseError) {
                      console.error('❌ Failed to parse OneSignal response:', parseError, 'raw:', responseData);
                      return callback(parseError, null);
                    }
                } else {
                    // Handle empty response
                    console.warn('[push] OneSignal returned empty response');
                    return callback(null, { success: true });
                }
            } catch (parseError) {
                console.error('❌ Error handling OneSignal response:', parseError, 'raw:', responseData);
                return callback(parseError, null);
            }
        });

        // Handle response errors
        res.on("error", function(error) {
            console.error('❌ OneSignal response error:', error);
            return callback(error, null);
        });
    });

    // Handle request errors
    req.on("error", function(error) {
        console.error('❌ OneSignal request error:', error.message);
        return callback(error, null);
    });

    // Handle request timeout
    req.on("timeout", function() {
        req.destroy();
        return callback(new Error('OneSignal request timeout'), null);
    });

    try {
        const payload = JSON.stringify(data);
        console.debug('[push] OneSignal request payload', { len: payload.length });
        req.write(payload);
        req.end();
    } catch (error) {
        console.error('❌ Error writing OneSignal request:', error?.message || error);
        return callback(error, null);
    }
}


export async function sendPush({ token, title, body, data = {} }) {
    console.info('[push] sendPush called', { tokenPresent: !!token, title });
    if (!fcm) {
        const err = new Error("Firebase FCM not available. serviceAccountKey.json is missing.");
        console.error('[push] sendPush error', err.message);
        throw err;
    }
  
    if (!token) {
        const err = new Error("FCM token missing");
        console.error('[push] sendPush error', err.message);
        throw err;
    }

    const message = {
        token,
        notification: { title, body },
        data,
    };

    try {
        const start = Date.now();
        const resp = await fcm.send(message);
        console.info('[push] sendPush success', { token, durationMs: Date.now() - start });
        return resp;
    } catch (error) {
        console.error('[push] sendPush failed', { token, error: error?.message || error });
        throw error;
    }
}