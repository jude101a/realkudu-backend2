import { json } from "express";
import ONE_SIGNAL_CONFIG from "../config/oneSignal.js";

export async function sendNotification(data, callback) {
    var headers = {
        "Content-Type": "application/json; charset=utf-8",
        "Authorization": "Basic " + ONE_SIGNAL_CONFIG.apiKey
    };

    var options = {
        host: "onesignal.com",
        port: 443,
        path: "/api/v1/notifications",
        method: "POST",
        headers: headers
    };

    var https = require("https");
    var req = https.request(options, function(res) {
        res.on("data", function(data) {
            console.log(JSON.parse(data));
            return callback(null, JSON.parse(data));
        });
    });

    req.on("error", function(e) {
        console.log("ERROR:" + e);
        return callback(e, {
            message: e
        });
    });
    req.write(JSON.stringify(data));
    req.end();
}