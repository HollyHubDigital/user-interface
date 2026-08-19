# Aegis Eye Agent User Interface

This folder is the separate static user portal intended for deployment at:

https://android-device-management.vercel.app

## Configure backend URL

Edit `config.js` before deployment if Render gives you a different backend URL:

```js
const BACKEND_BASE_URL = "https://shied.onrender.com";

window.CP_DEVICE_CONFIG = {
  API_BASE_URL: BACKEND_BASE_URL,
  LIVE_BASE_URL: BACKEND_BASE_URL
};
```

The user portal stores no secrets. All auth, subscriptions, device data, persistence, APK downloads, and WebSocket relays are handled by the separate Render backend deployment.

## Files

- `index.html` user login/signup/dashboard/subscription UI
- `user.css` responsive glassmorphism styling
- `user.js` auth, enrollment, subscription gating, and device commands
- `config.js` public backend URL
- `vercel.json` static deployment headers
