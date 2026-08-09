import { readJson, writeJson } from "./storeService.js";


// =====================================
// Login activity log
// Mencatat: username, tanggal login,
// device/browser/OS (diparse dari User-Agent).
// Data: data/login-logs.json (maks 500 baris)
// =====================================


const MAX_LOGS = 500;


function getLogs() {

    return readJson("login-logs", []);

}


function saveLogs(logs) {

    writeJson("login-logs", logs);

}


function parseDeviceInfo(userAgent) {

    const ua = userAgent || "";

    let device = "Desktop";

    if (/mobile|android|iphone/i.test(ua)) {

        device = "Mobile";

    }
    else if (/ipad|tablet/i.test(ua)) {

        device = "Tablet";

    }

    let browser = "Unknown";

    if (/edg\//i.test(ua)) {

        browser = "Edge";

    }
    else if (/opr\//i.test(ua)) {

        browser = "Opera";

    }
    else if (/chrome/i.test(ua)) {

        browser = "Chrome";

    }
    else if (/firefox/i.test(ua)) {

        browser = "Firefox";

    }
    else if (/safari/i.test(ua)) {

        browser = "Safari";

    }

    let os = "Unknown";

    if (/windows/i.test(ua)) {

        os = "Windows";

    }
    else if (/mac os|macintosh/i.test(ua)) {

        os = "macOS";

    }
    else if (/android/i.test(ua)) {

        os = "Android";

    }
    else if (/iphone|ipad/i.test(ua)) {

        os = "iOS";

    }
    else if (/linux/i.test(ua)) {

        os = "Linux";

    }

    return { device, browser, os };

}


export function addLoginLog({ userId, username, userAgent }) {

    const logs = getLogs();

    const info = parseDeviceInfo(userAgent);

    logs.push({
        id: Date.now(),
        userId,
        username,
        userAgent: userAgent || "",
        device: info.device,
        browser: info.browser,
        os: info.os,
        timestamp: new Date().toISOString()
    });

    if (logs.length > MAX_LOGS) {

        logs.splice(0, logs.length - MAX_LOGS);

    }

    saveLogs(logs);

    return logs[logs.length - 1];

}


export function listLoginLogs() {

    return getLogs().slice().reverse();

}