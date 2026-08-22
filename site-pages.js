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
