const TRANSLATE_LANGUAGES = [["af", "Afrikaans"], ["sq", "Albanian"], ["am", "Amharic"], ["ar", "Arabic"], ["hy", "Armenian"], ["as", "Assamese"], ["ay", "Aymara"], ["az", "Azerbaijani"], ["bm", "Bambara"], ["eu", "Basque"], ["be", "Belarusian"], ["bn", "Bengali"], ["bho", "Bhojpuri"], ["bs", "Bosnian"], ["bg", "Bulgarian"], ["ca", "Catalan"], ["ceb", "Cebuano"], ["ny", "Chichewa"], ["zh-CN", "Chinese Simplified"], ["zh-TW", "Chinese Traditional"], ["co", "Corsican"], ["hr", "Croatian"], ["cs", "Czech"], ["da", "Danish"], ["dv", "Dhivehi"], ["doi", "Dogri"], ["nl", "Dutch"], ["en", "English"], ["eo", "Esperanto"], ["et", "Estonian"], ["ee", "Ewe"], ["tl", "Filipino"], ["fi", "Finnish"], ["fr", "French"], ["fy", "Frisian"], ["gl", "Galician"], ["ka", "Georgian"], ["de", "German"], ["el", "Greek"], ["gn", "Guarani"], ["gu", "Gujarati"], ["ht", "Haitian Creole"], ["ha", "Hausa"], ["haw", "Hawaiian"], ["iw", "Hebrew"], ["hi", "Hindi"], ["hmn", "Hmong"], ["hu", "Hungarian"], ["is", "Icelandic"], ["ig", "Igbo"], ["ilo", "Ilocano"], ["id", "Indonesian"], ["ga", "Irish"], ["it", "Italian"], ["ja", "Japanese"], ["jw", "Javanese"], ["kn", "Kannada"], ["kk", "Kazakh"], ["km", "Khmer"], ["rw", "Kinyarwanda"], ["gom", "Konkani"], ["ko", "Korean"], ["kri", "Krio"], ["ku", "Kurdish Kurmanji"], ["ckb", "Kurdish Sorani"], ["ky", "Kyrgyz"], ["lo", "Lao"], ["la", "Latin"], ["lv", "Latvian"], ["ln", "Lingala"], ["lt", "Lithuanian"], ["lg", "Luganda"], ["lb", "Luxembourgish"], ["mk", "Macedonian"], ["mai", "Maithili"], ["mg", "Malagasy"], ["ms", "Malay"], ["ml", "Malayalam"], ["mt", "Maltese"], ["mi", "Maori"], ["mr", "Marathi"], ["mni-Mtei", "Meiteilon"], ["lus", "Mizo"], ["mn", "Mongolian"], ["my", "Myanmar Burmese"], ["ne", "Nepali"], ["no", "Norwegian"], ["or", "Odia"], ["om", "Oromo"], ["ps", "Pashto"], ["fa", "Persian"], ["pl", "Polish"], ["pt", "Portuguese"], ["pa", "Punjabi"], ["qu", "Quechua"], ["ro", "Romanian"], ["ru", "Russian"], ["sm", "Samoan"], ["sa", "Sanskrit"], ["gd", "Scots Gaelic"], ["nso", "Sepedi"], ["sr", "Serbian"], ["st", "Sesotho"], ["sn", "Shona"], ["sd", "Sindhi"], ["si", "Sinhala"], ["sk", "Slovak"], ["sl", "Slovenian"], ["so", "Somali"], ["es", "Spanish"], ["su", "Sundanese"], ["sw", "Swahili"], ["sv", "Swedish"], ["tg", "Tajik"], ["ta", "Tamil"], ["tt", "Tatar"], ["te", "Telugu"], ["th", "Thai"], ["ti", "Tigrinya"], ["ts", "Tsonga"], ["tr", "Turkish"], ["tk", "Turkmen"], ["ak", "Twi"], ["uk", "Ukrainian"], ["ur", "Urdu"], ["ug", "Uyghur"], ["uz", "Uzbek"], ["vi", "Vietnamese"], ["cy", "Welsh"], ["xh", "Xhosa"], ["yi", "Yiddish"], ["yo", "Yoruba"], ["zu", "Zulu"]];

function populateTranslateLanguages() {
  const select = document.getElementById("translateLanguage");
  if (!select || select.dataset.ready === "true") return;
  TRANSLATE_LANGUAGES.forEach(([code, name]) => {
    const option = document.createElement("option");
    option.value = code;
    option.textContent = name;
    select.appendChild(option);
  });
  select.dataset.ready = "true";
  select.value = localStorage.getItem("aegisTranslateLanguage") || "";
}

function setTranslateCookie(language) {
  const value = language ? `/auto/${language}` : "";
  const expires = language ? "; expires=Fri, 31 Dec 9999 23:59:59 GMT" : "; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  document.cookie = `googtrans=${value}${expires}; path=/`;
  document.cookie = `googtrans=${value}${expires}; path=/; domain=${location.hostname}`;
}

function applySelectedTranslation(language) {
  setTranslateCookie(language);
  if (language) localStorage.setItem("aegisTranslateLanguage", language);
  else localStorage.removeItem("aegisTranslateLanguage");
  const combo = document.querySelector(".goog-te-combo");
  if (combo) {
    combo.value = language;
    combo.dispatchEvent(new Event("change"));
  } else {
    setTimeout(() => location.reload(), 120);
  }
}

function initTranslateWidget() {
  populateTranslateLanguages();
  const toggle = document.getElementById("translateToggle");
  const tray = document.getElementById("translateTray");
  const select = document.getElementById("translateLanguage");
  if (toggle && tray) toggle.onclick = () => tray.classList.toggle("hidden");
  if (select) select.onchange = () => applySelectedTranslation(select.value);
}

window.initGoogleTranslate = function initGoogleTranslate() {
  if (!window.google || !window.google.translate || !document.getElementById("googleTranslateElement")) return;
  new window.google.translate.TranslateElement({ pageLanguage: "en", autoDisplay: false }, "googleTranslateElement");
  const saved = localStorage.getItem("aegisTranslateLanguage") || "";
  if (saved) setTimeout(() => applySelectedTranslation(saved), 500);
};

initTranslateWidget();
initProfilePhotoCapture();

const logoutUser = document.getElementById("logoutUser");
if (logoutUser) {
  const hasUserSession = Boolean(localStorage.getItem("cpUserToken"));
  const label = logoutUser.lastChild;
  if (label && label.nodeType === Node.TEXT_NODE) label.nodeValue = hasUserSession ? "Logout" : "Login";
  logoutUser.setAttribute("aria-label", hasUserSession ? "Log out" : "Log in");
  logoutUser.onclick = () => {
    if (!localStorage.getItem("cpUserToken")) {
      window.location.href = "auth.html";
      return;
    }
    localStorage.removeItem("cpUserToken");
    localStorage.removeItem("cpPendingEnrollmentLink");
    localStorage.removeItem("cpPendingPaymentId");
    localStorage.removeItem("cpUserActiveRecordingId");
    window.location.href = "auth.html";
  };
}

const SETTINGS_PLAN_NAMES = {
  basic: "Basic - 1 Month",
  standard: "Standard - 3 Months",
  premium: "Premium - 6 Months"
};
const SETTINGS_PLAN_DAYS = { basic: 30, standard: 90, premium: 180 };
let settingsProfilePhotoObjectUrl = "";
let profilePhotoStream = null;
let profileFaceTimer = null;
let capturedProfileBlob = null;
let profileFaceDetector = null;
const settingsToken = () => localStorage.getItem("cpUserToken") || "";
const settingsConfig = () => window.CP_DEVICE_CONFIG || {};
function settingsApiBase() {
  const base = String(settingsConfig().API_BASE_URL || "").replace(/\/$/, "");
  if (!base) throw new Error("Backend API URL is not configured. Set API_BASE_URL in the Vercel project environment and redeploy.");
  return base;
}
function settingsApiUrl(path) { return `${settingsApiBase()}${path}`; }
async function settingsReadJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { error: text }; }
}
async function settingsApi(path, options = {}) {
  const token = settingsToken();
  if (!token) throw new Error("Please login to view settings.");
  const response = await fetch(settingsApiUrl(path), {
    ...options,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(options.headers || {}) }
  });
  const body = await settingsReadJson(response);
  if (!response.ok) throw new Error(body.error || "Request failed");
  return body;
}
function settingsEscape(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function settingsDisplayName(user) {
  return String((user && (user.username || user.email || user.phone || user.id)) || "Aegis User").trim() || "Aegis User";
}
function settingsInitials(name) {
  const parts = String(name || "AE").trim().split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : (parts[0] || "AE").slice(0, 2)).toUpperCase();
}
function settingsDeviceName(device) {
  const info = device.info || {};
  return `${info.manufacturer || ""} ${info.model || ""}`.trim() || device.name || device.serial || device.id;
}
function settingsFormatDate(value) {
  const time = Date.parse(value || "");
  return Number.isFinite(time) ? new Date(time).toLocaleDateString() : "Not available";
}
function settingsSubscriptionStart(subscription) {
  if (!subscription) return "Not available";
  if (subscription.startedAt || subscription.createdAt || subscription.activatedAt) return settingsFormatDate(subscription.startedAt || subscription.createdAt || subscription.activatedAt);
  const plan = subscription.plan;
  const expiresAt = Date.parse(subscription.expiresAt || "");
  const days = SETTINGS_PLAN_DAYS[plan];
  if (Number.isFinite(expiresAt) && days) return new Date(expiresAt - days * 86400000).toLocaleDateString();
  return "Not available";
}
function settingsSetStatus(message, error = false) {
  const status = document.getElementById("settingsStatus");
  if (!status) return;
  status.textContent = message || "";
  status.classList.toggle("error", Boolean(error));
}
function renderSettingsProfile(user) {
  const name = settingsDisplayName(user);
  const pairs = {
    settingsProfileName: name,
    settingsFullName: name,
    settingsEmail: user.email || "Not available",
    settingsPhone: user.phone || "Not available",
    settingsUserId: user.id || "Not available",
    settingsAvatarInitials: settingsInitials(name)
  };
  Object.entries(pairs).forEach(([id, value]) => { const node = document.getElementById(id); if (node) node.textContent = value; });
  loadSettingsProfilePhoto(user).catch(() => {});
}
async function loadSettingsProfilePhoto(user) {
  const img = document.getElementById("settingsAvatarPhoto");
  const initials = document.getElementById("settingsAvatarInitials");
  if (!img) return;
  if (settingsProfilePhotoObjectUrl) {
    URL.revokeObjectURL(settingsProfilePhotoObjectUrl);
    settingsProfilePhotoObjectUrl = "";
  }
  if (!user || !user.profilePhoto || !user.profilePhoto.url) {
    img.classList.add("hidden");
    if (initials) initials.classList.remove("hidden");
    return;
  }
  const response = await fetch(settingsApiUrl("/api/user/profile-photo"), { headers: { Authorization: `Bearer ${settingsToken()}` }, cache: "no-store" });
  if (!response.ok) throw new Error("Profile photo could not be loaded");
  const blob = await response.blob();
  settingsProfilePhotoObjectUrl = URL.createObjectURL(blob);
  img.src = settingsProfilePhotoObjectUrl;
  img.classList.remove("hidden");
  if (initials) initials.classList.add("hidden");
}
function profilePhotoNodes() {
  return {
    dialog: document.getElementById("profilePhotoDialog"),
    video: document.getElementById("profilePhotoVideo"),
    canvas: document.getElementById("profilePhotoCanvas"),
    start: document.getElementById("profilePhotoStart"),
    capture: document.getElementById("profilePhotoCapture"),
    upload: document.getElementById("profilePhotoUpload"),
    close: document.getElementById("profilePhotoClose"),
    status: document.getElementById("profilePhotoFaceStatus"),
    guide: document.getElementById("profilePhotoGuide"),
    camera: document.getElementById("settingsAvatarCamera")
  };
}
function stopProfileCamera() {
  if (profileFaceTimer) clearInterval(profileFaceTimer);
  profileFaceTimer = null;
  if (profilePhotoStream) profilePhotoStream.getTracks().forEach((track) => track.stop());
  profilePhotoStream = null;
}
function profileFrameBrightness(video, canvas) {
  if (!video || !canvas || !video.videoWidth || !video.videoHeight) return 0;
  const size = 32;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(video, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let total = 0;
  for (let index = 0; index < data.length; index += 4) total += (data[index] + data[index + 1] + data[index + 2]) / 3;
  return total / (data.length / 4);
}
async function updateProfileFaceGuide() {
  const { video, canvas, capture, status, guide } = profilePhotoNodes();
  if (!video || !canvas || !status) return;
  if (!video.videoWidth || !video.videoHeight) return;
  const brightness = profileFrameBrightness(video, canvas);
  if (brightness < 55) {
    status.textContent = "Too dark - move to brighter light.";
    status.className = "profile-photo-face-status warning";
    if (capture) capture.disabled = true;
    return;
  }
  if (window.FaceDetector) {
    try {
      profileFaceDetector ||= new FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await profileFaceDetector.detect(video);
      const face = faces && faces[0];
      if (!face) {
        status.textContent = "No face detected - center your face in the frame.";
        status.className = "profile-photo-face-status warning";
        if (capture) capture.disabled = true;
        return;
      }
      const box = face.boundingBox;
      const centerX = box.x + box.width / 2;
      const centerY = box.y + box.height / 2;
      const centered = centerX > video.videoWidth * 0.25 && centerX < video.videoWidth * 0.75 && centerY > video.videoHeight * 0.18 && centerY < video.videoHeight * 0.82;
      const largeEnough = box.width > video.videoWidth * 0.14 && box.height > video.videoHeight * 0.14;
      if (!centered || !largeEnough) {
        status.textContent = "Face found - move closer and keep it centered.";
        status.className = "profile-photo-face-status warning";
        if (capture) capture.disabled = true;
        return;
      }
      status.textContent = "Face detected clearly. Ready to capture.";
      status.className = "profile-photo-face-status ok";
      if (guide) guide.textContent = "Good lighting and face detected. Capture a real live selfie now.";
      if (capture) capture.disabled = false;
      return;
    } catch (error) {
      status.textContent = "Face detector unavailable in this browser. Use a clear live selfie.";
    }
  } else {
    status.textContent = "Face detector unavailable in this browser. Use a clear live selfie.";
  }
  status.className = "profile-photo-face-status neutral";
  if (capture) capture.disabled = false;
}
async function startProfileCamera() {
  const { video, start, capture, upload, status, guide } = profilePhotoNodes();
  if (!video) return;
  stopProfileCamera();
  capturedProfileBlob = null;
  if (upload) upload.disabled = true;
  if (capture) capture.disabled = true;
  if (status) status.textContent = "Requesting camera permission...";
  profilePhotoStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 960 } }, audio: false });
  video.srcObject = profilePhotoStream;
  await video.play();
  if (start) start.textContent = "Restart Camera";
  if (guide) guide.textContent = "Look at the camera. Keep your face centered with good light; avoid masks, screenshots, or another screen.";
  profileFaceTimer = setInterval(() => updateProfileFaceGuide().catch(() => {}), 900);
  await updateProfileFaceGuide();
}
function captureProfilePhoto() {
  const { video, canvas, upload, status } = profilePhotoNodes();
  if (!video || !canvas || !video.videoWidth || !video.videoHeight) return;
  const size = Math.min(video.videoWidth, video.videoHeight);
  const sx = (video.videoWidth - size) / 2;
  const sy = (video.videoHeight - size) / 2;
  canvas.width = 720;
  canvas.height = 720;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, sx, sy, size, size, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    capturedProfileBlob = blob;
    if (upload) upload.disabled = !blob;
    if (status) {
      status.textContent = blob ? "Captured. Upload to save this profile picture." : "Capture failed. Try again.";
      status.className = blob ? "profile-photo-face-status ok" : "profile-photo-face-status warning";
    }
  }, "image/jpeg", 0.88);
}
async function uploadProfilePhoto() {
  const { upload, dialog, status } = profilePhotoNodes();
  if (!capturedProfileBlob) return settingsSetStatus("Capture a live selfie first.", true);
  if (upload) upload.disabled = true;
  if (status) status.textContent = "Uploading securely to backend storage...";
  const response = await settingsApi("/api/user/profile-photo", { method: "POST", headers: { "Content-Type": capturedProfileBlob.type || "image/jpeg" }, body: capturedProfileBlob });
  settingsSetStatus("Profile picture saved.");
  stopProfileCamera();
  if (dialog && dialog.open) dialog.close();
  capturedProfileBlob = null;
  const me = await settingsApi("/api/auth/me");
  renderSettingsProfile(me.user || {});
  return response;
}
function initProfilePhotoCapture() {
  const { camera, dialog, close, start, capture, upload } = profilePhotoNodes();
  if (!camera || !dialog) return;
  camera.onclick = () => {
    capturedProfileBlob = null;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "open");
  };
  if (close) close.onclick = () => { stopProfileCamera(); if (dialog.open) dialog.close(); else dialog.removeAttribute("open"); };
  dialog.addEventListener("close", stopProfileCamera);
  if (start) start.onclick = () => startProfileCamera().catch((error) => settingsSetStatus(error.message || "Camera failed to start.", true));
  if (capture) capture.onclick = captureProfilePhoto;
  if (upload) upload.onclick = () => uploadProfilePhoto().catch((error) => { upload.disabled = false; settingsSetStatus(error.message || "Profile photo upload failed.", true); });
}
function renderSettingsSubscription(user) {
  const host = document.getElementById("settingsSubscription");
  if (!host) return;
  const subscription = (user && user.subscription) || {};
  const planName = SETTINGS_PLAN_NAMES[subscription.plan] || "No active subscription";
  const active = subscription.expiresAt && Date.parse(subscription.expiresAt) > Date.now();
  host.innerHTML = `<div class="settings-plan-pill ${active ? "active" : "inactive"}">${settingsEscape(planName)}</div><div class="settings-info-grid compact"><div><span>Status</span><strong>${active ? "Active" : "Inactive"}</strong></div><div><span>Subscribed date</span><strong>${settingsEscape(settingsSubscriptionStart(subscription))}</strong></div><div><span>Expires</span><strong>${settingsEscape(settingsFormatDate(subscription.expiresAt))}</strong></div><div><span>Plan ID</span><strong>${settingsEscape(subscription.plan || "none")}</strong></div></div>`;
}
function renderSettingsDevices(devices) {
  const host = document.getElementById("settingsDevices");
  if (!host) return;
  if (!devices.length) {
    host.innerHTML = '<p class="hint">No enrolled devices yet.</p>';
    return;
  }
  host.innerHTML = devices.map((device) => `<article class="settings-device-card"><strong>${settingsEscape(settingsDeviceName(device))}</strong><span>${settingsEscape(device.platform || "device")} • ${settingsEscape(device.status || "unknown")}</span><small>${settingsEscape(device.id || "")}</small></article>`).join("");
}
function renderSettingsOwnerMessages(devices) {
  const host = document.getElementById("settingsOwnerMessages");
  if (!host) return;
  const rows = devices.map((device) => ({ device, ownerMessage: (device.lostMode && device.lostMode.ownerMessage) || {} })).filter((row) => row.ownerMessage.message);
  if (!rows.length) {
    host.innerHTML = '<p class="hint">No saved owner message has been attached to your enrolled devices yet.</p>';
    return;
  }
  host.innerHTML = "";
  rows.forEach(({ device, ownerMessage }) => {
    const card = document.createElement("article");
    card.className = "settings-owner-card";
    card.innerHTML = `<div class="settings-owner-head"><div><span>Device</span><strong>${settingsEscape(settingsDeviceName(device))}</strong></div><small>${ownerMessage.enabled === false || ownerMessage.active === false ? "Overlay off" : "Overlay on"}</small></div><textarea readonly maxlength="240">${settingsEscape(ownerMessage.message)}</textarea><div class="settings-owner-actions"><button type="button" data-edit-owner="${settingsEscape(device.id)}">Edit</button><button type="button" class="secondary" data-save-owner="${settingsEscape(device.id)}" disabled>Save</button></div>`;
    const textarea = card.querySelector("textarea");
    const edit = card.querySelector("[data-edit-owner]");
    const save = card.querySelector("[data-save-owner]");
    edit.onclick = () => { textarea.readOnly = false; textarea.focus(); save.disabled = false; settingsSetStatus(`Editing owner message for ${settingsDeviceName(device)}.`); };
    save.onclick = async () => {
      const message = textarea.value.trim();
      if (!message) return settingsSetStatus("Owner message text is required.", true);
      save.disabled = true;
      try {
        await settingsApi(`/api/user/devices/${encodeURIComponent(device.id)}/owner-message`, { method: "PUT", body: JSON.stringify({ message }) });
        textarea.readOnly = true;
        settingsSetStatus(`Saved owner message for ${settingsDeviceName(device)}.`);
        await loadSettingsProfile();
      } catch (error) {
        save.disabled = false;
        settingsSetStatus(error.message || "Owner message save failed.", true);
      }
    };
    host.appendChild(card);
  });
}
async function loadSettingsProfile() {
  if (!document.body.classList.contains("settings-page")) return;
  try {
    const [me, dashboard] = await Promise.all([settingsApi("/api/auth/me"), settingsApi("/api/user/devices")]);
    const user = me.user || {};
    const devices = dashboard.devices || [];
    renderSettingsProfile(user);
    renderSettingsSubscription(user);
    renderSettingsDevices(devices);
    renderSettingsOwnerMessages(devices);
    settingsSetStatus("");
  } catch (error) {
    settingsSetStatus(error.message || "Failed to load settings.", true);
    if (/login/i.test(error.message || "")) setTimeout(() => { window.location.href = "auth.html"; }, 900);
  }
}
loadSettingsProfile();
