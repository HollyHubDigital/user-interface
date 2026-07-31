# CP DEVICE User Interface

This folder is the separate static user portal intended for deployment at:

https://android-device-management.vercel.app

## Configure backend URL

Edit `config.js` before deployment:

```js
window.CP_DEVICE_CONFIG = {
  API_BASE_URL: "https://your-admin-backend-domain.vercel.app"
};
```

The user portal stores no secrets. All auth, subscriptions, device data, GitHub persistence, APK downloads, and WebSocket relays are handled by the admin/backend deployment.

## Files

- `index.html` user login/signup/dashboard/subscription UI
- `user.css` responsive glassmorphism styling
- `user.js` auth, enrollment, subscription gating, and device commands
- `config.js` public backend URL
- `vercel.json` static deployment headers
