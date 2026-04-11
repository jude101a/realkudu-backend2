import https from "https";
import ONE_SIGNAL_CONFIG from "../config/oneSignal.js";

export async function sendNotification(data, callback) {
    // Input validation
    if (!data || typeof data !== 'object') {
        return callback(new Error('Invalid notification data'), null);
    }

    if (!ONE_SIGNAL_CONFIG.apiKey) {
        return callback(new Error('OneSignal API key not configured'), null);
    }

    const headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": "Basic " + ONE_SIGNAL_CONFIG.apiKey
    };

    const options = {
        host: "onesignal.com",
        port: 443,
        path: "/api/v1/notifications",
        method: "POST",
        headers: headers,
        timeout: 10000 // 10 second timeout
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
                    const parsedData = JSON.parse(responseData);
                    console.log('✅ OneSignal response:', parsedData);
                    return callback(null, parsedData);
                } else {
                    // Handle empty response
                    return callback(null, { success: true });
                }
            } catch (parseError) {
                console.error('❌ Failed to parse OneSignal response:', parseError);
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
        req.write(JSON.stringify(data));
        req.end();
    } catch (error) {
        console.error('❌ Error writing request:', error);
        return callback(error, null);
    }
}