let token = localStorage.getItem("cpUserToken") || "";
let me = null;
let selected = null;
let ws = null;
let audioWs = null;
let livePollTimer = null;
let liveAudioPollTimer = null;
let liveFallbackTimer = null;
let liveFetchController = null;
let liveAudioFetchController = null;
let lastLiveFrameAt = 0;
let userLiveFrameSequence = 0;
let userRenderedFrameSequence = 0;
let userLiveFrameUrl = "";
let userLiveRenderBusy = false;
let userLivePendingBlob = null;
let userLastLiveFrameUpdatedAt = "";
let userLiveAudioContext = null;
let userLiveAudioNextTime = 0;
let userLastLiveAudioUpdatedAt = "";
let userWebRtcPeer = null;
let userWebRtcSignal = null;
let userWebRtcConnectTimer = null;
let userWebRtcVideoEl = null;
let userMediaRecorder = null;
let userRecordingChunks = [];
let userRecordingBlob = null;
let userRecordingStopPromise = null;
let userRecordingCanvas = null;
let userRecordingDrawTimer = null;
let userRecordingAudioDestination = null;
let userRecordingStartedAt = 0;
let pendingEnrollmentLink = localStorage.getItem("cpPendingEnrollmentLink") || "";
let userDevices = [];
let userCommands = [];
let userRecordings = [];
let activeUserRecordingId = localStorage.getItem("cpUserActiveRecordingId") || "";
let activeUserFileBrowserCommandId = "";

const APP_CONFIG = window.CP_DEVICE_CONFIG || {};
const DEFAULT_BACKEND_BASE = "https://shied.onrender.com";
const API_BASE = (APP_CONFIG.API_BASE_URL || DEFAULT_BACKEND_BASE).replace(/\/$/, "");
const LIVE_BASE = (APP_CONFIG.LIVE_BASE_URL || API_BASE || window.location.origin).replace(/\/$/, "");
const $ = (id) => document.getElementById(id);
const apiUrl = (path) => `${API_BASE}${path}`;
const liveApiUrl = (path) => `${LIVE_BASE}${path}`;
const liveWsUrl = (path) => `${LIVE_BASE.replace("https://", "wss://").replace("http://", "ws://")}${path}`;
const persistentLiveConfigured = () => LIVE_BASE !== window.location.origin && !LIVE_BASE.includes("vercel.app");

const signupFormEl = $("signupForm");
const loginFormEl = $("loginForm");
const switchAuthEl = $("switchAuth");
const emailEl = $("email");
const usernameEl = $("username");
const phoneEl = $("phone");
const passwordEl = $("password");
const loginUserEl = $("loginUser");
const loginPassEl = $("loginPass");
const resetModalEl = $("resetModal");
const resetLoginEl = $("resetLogin");
const currentPasswordEl = $("currentPassword");
const newPasswordEl = $("newPassword");
const confirmNewPasswordEl = $("confirmNewPassword");
const userDevicesEl = $("userDevices");
const userFilesEl = $("userFiles");
const userFrameEl = $("userFrame");
const subscriptionStatusEl = $("subscriptionStatus");
const enrollUserEl = $("enrollUser");
const openAgentUserEl = $("openAgentUser");
const enrollHelpEl = $("enrollHelp");
const paymentMethodEl = $("paymentMethod");
const checkoutSummaryEl = $("checkoutSummary");
const checkoutStatusEl = $("checkoutStatus");
const confirmPaymentEl = $("confirmPayment");
const checkoutBackEl = $("checkoutBack");
const homeEl = $("home");
const logoutUserEl = $("logoutUser");
const locationModalEl = $("locationModal");
const locationTextEl = $("locationText");
const locationMapLinkEl = $("locationMapLink");
const userFilesModalEl = $("userFilesModal");
const userFilesModalTitleEl = $("userFilesModalTitle");
const userFilesStatusEl = $("userFilesStatus");
const userFilesModalContentEl = $("userFilesModalContent");
const authPage = Boolean($("auth"));
const dashboardPage = Boolean($("dashboard"));
const authMessageEl = $("authMessage");
const userRecordingsEl = $("userRecordings");
const userStartRecordingEl = $("userStartRecording");
const userStopRecordingEl = $("userStopRecording");
const userSaveRecordingEl = $("userSaveRecording");
const userRecordingStatusEl = $("userRecordingStatus");
const userLostMessageFormEl = $("userLostMessageForm");
const userLostMessageEl = $("userLostMessage");
const userDeviceInfoModalEl = $("userDeviceInfoModal");
const userDeviceInfoTitleEl = $("userDeviceInfoTitle");
const userDeviceInfoContentEl = $("userDeviceInfoContent");
const userRefreshDeviceInfoEl = $("userRefreshDeviceInfo");
let userDeviceInfoDeviceId = "";

function redirectToAuth(message) {
  if (message) localStorage.setItem("cpUserAuthMessage", message);
  if (window.location.pathname.endsWith("auth.html")) return;
  window.location.href = "auth.html";
}

function showAuthFlashMessage() {
  if (!authMessageEl) return;
  const message = localStorage.getItem("cpUserAuthMessage");
  if (!message) return;
  authMessageEl.textContent = message;
  authMessageEl.classList.remove("hidden");
  localStorage.removeItem("cpUserAuthMessage");
}

function clearAuthFlashMessage() {
  if (!authMessageEl) return;
  authMessageEl.textContent = "";
  authMessageEl.classList.add("hidden");
}

function redirectToDashboard() {
  if (window.location.pathname.endsWith("index.html") || window.location.pathname === "/") return;
  window.location.href = "index.html";
}

const signupFields = ["email", "username", "phone", "password"];
const signupErrors = {
  email: () => $("emailError"),
  username: () => $("usernameError"),
  phone: () => $("phoneError"),
  password: () => $("passwordError")
};
const resetErrors = {
  login: () => $("resetLoginError"),
  currentPassword: () => $("currentPasswordError"),
  newPassword: () => $("newPasswordError"),
  confirmNewPassword: () => $("confirmNewPasswordError")
};
const availabilityCache = { email: null, username: null, phone: null };

function resetAvailability(field) {
  if (["email", "username", "phone"].includes(field)) {
    availabilityCache[field] = null;
  }
}

function areSignupValuesUnique() {
  return ["email", "username", "phone"].every((field) => {
    const input = $(field);
    if (!input) return true;
    const value = input.value.trim();
    const cache = availabilityCache[field];
    return Boolean(cache && cache.value === (field === "phone" ? value.replace(/\s+/g, "") : value.toLowerCase()) && cache.available === true);
  });
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { error: text || `HTTP ${response.status}` };
  }
}

async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const body = await readJsonResponse(response);
  if (!response.ok) throw Object.assign(new Error(body.error || "Request failed"), body);
  return body;
}

function show(sectionId) {
  ["auth", "dashboard", "subscriptions", "checkout"].forEach((id) => {
    const element = $(id);
    if (element) element.classList.toggle("hidden", id !== sectionId);
  });
}

function clearFieldErrors(errors) {
  Object.values(errors).forEach((getElement) => {
    const el = getElement(); if (el) el.textContent = "";
  });
}

function setFieldError(field, message) {
  const element = signupErrors[field] ? signupErrors[field]() : resetErrors[field] ? resetErrors[field]() : null;
  if (element) element.textContent = message || "";
}

function validatePhoneValue(value) {
  return /^\+[1-9]\d{7,14}$/.test(String(value || "").replace(/\s+/g, ""));
}

function validateSignupForm() {
  clearFieldErrors(signupErrors);
  let valid = true;
  if (!emailEl.value.trim()) {
    setFieldError("email", "Email is required.");
    valid = false;
  } else if (!emailEl.checkValidity()) {
    setFieldError("email", "Enter a valid email address.");
    valid = false;
  }
  if (!usernameEl.value.trim()) {
    setFieldError("username", "Username is required.");
    valid = false;
  }
  if (!phoneEl.value.trim()) {
    setFieldError("phone", "Phone number is required.");
    valid = false;
  } else if (!validatePhoneValue(phoneEl.value)) {
    setFieldError("phone", "Include country code, e.g. +15551234567.");
    valid = false;
  }
  if (!passwordEl.value || passwordEl.value.length < 6) {
    setFieldError("password", "Password must be at least 6 characters.");
    valid = false;
  }
  return valid;
}

function isSignupFormValid() {
  return Boolean(
    emailEl && emailEl.value.trim() &&
    emailEl.checkValidity() &&
    usernameEl && usernameEl.value.trim() &&
    phoneEl && phoneEl.value.trim() &&
    validatePhoneValue(phoneEl.value) &&
    passwordEl && passwordEl.value &&
    passwordEl.value.length >= 6
  );
}

function hasFieldErrors(errors) {
  return Object.values(errors).some((getElement) => Boolean(getElement()?.textContent.trim()));
}

async function checkAvailability(field, value) {
  if (!value || !["email", "username", "phone"].includes(field)) return { available: true };
  const normalized = field === "phone" ? value.replace(/\s+/g, "") : value.trim().toLowerCase();
  const cached = availabilityCache[field];
  if (cached && cached.value === normalized) return { available: cached.available, error: cached.error };
  const params = new URLSearchParams({ field, value: value.trim() });
  const response = await fetch(apiUrl(`/api/auth/check-availability?${params}`), { headers: { "Content-Type": "application/json" } });
  const body = await readJsonResponse(response);
  const available = response.ok && body.available !== false;
  const error = available ? null : body.error || "Already in use";
  availabilityCache[field] = { value: normalized, available, error };
  return { available, error };
}

async function validateSignupAvailability() {
  let valid = true;
  const checks = ["email", "username", "phone"].map(async (field) => {
    const value = $(field).value;
    if (!value) return;
    const available = await checkAvailability(field, value);
    if (!available.available) {
      setFieldError(field, available.error);
      valid = false;
    }
  });
  await Promise.all(checks);
  return valid;
}

function updateSignupSubmitState() {
  if (!signupFormEl) return;
  const submit = signupFormEl.querySelector("button[type=submit]");
  if (!submit) return;
  submit.disabled = !isSignupFormValid() || hasFieldErrors(signupErrors);
}

function attachSignupValidation() {
  ["email", "username", "phone", "password"].forEach((field) => {
    const input = $(field);
    if (!input) return;
    input.addEventListener("input", () => {
      resetAvailability(field);
      if (signupErrors[field]) setFieldError(field, "");
      updateSignupSubmitState();
    });
    if (field !== "password") {
      input.addEventListener("blur", async () => {
        if (!input.value.trim()) return;
        const available = await checkAvailability(field, input.value);
        if (!available.available) setFieldError(field, available.error);
        updateSignupSubmitState();
      });
    }
  });
}

function togglePasswordVisibility(button) {
  const inputId = button.dataset.togglePassword;
  const input = $(inputId);
  if (!input) return;
  const visible = input.type === "text";
  input.type = visible ? "password" : "text";
  button.classList.toggle("password-visible", !visible);
  button.setAttribute("aria-label", visible ? "Show password" : "Hide password");
}

function attachPasswordToggles() {
  document.querySelectorAll(".toggle-password").forEach((button) => {
    button.addEventListener("click", () => togglePasswordVisibility(button));
  });
}

async function resetFormErrors() {
  clearFieldErrors(signupErrors);
  clearFieldErrors(resetErrors);
}

function clearSession(message = "") {
  token = "";
  me = null;
  selected = null;
  pendingEnrollmentLink = "";
  if (ws) {
    ws.close();
    ws = null;
  }
  stopUserLiveAudio();
  stopUserWebRtcLive();
  if (livePollTimer) {
    clearTimeout(livePollTimer);
    livePollTimer = null;
  }
  if (liveFallbackTimer) {
    clearTimeout(liveFallbackTimer);
    liveFallbackTimer = null;
  }
  localStorage.removeItem("cpUserToken");
  localStorage.removeItem("cpPendingEnrollmentLink");
  if (message) localStorage.setItem("cpUserAuthMessage", message);
  show("auth");
  const loginForm = $("loginForm");
  const signupForm = $("signupForm");
  const switchAuth = $("switchAuth");
  const loginUser = $("loginUser");
  const loginPass = $("loginPass");
  if (loginForm) loginForm.classList.add("active");
  if (signupForm) signupForm.classList.remove("active");
  if (switchAuth) switchAuth.textContent = "Signup";
  if (loginUser) loginUser.value = "";
  if (loginPass) loginPass.value = "";
}

async function tryRestoreSession() {
  if (!token) return false;
  try {
    const response = await api("/api/auth/me");
    me = response.user;
    localStorage.setItem("cpUserToken", token);
    return true;
  } catch {
    clearSession("Session expired or invalid. Please login again.");
    return false;
  }
}

function initializeUserInterface() {
  attachSignupValidation();
  attachPasswordToggles();
  updateSignupSubmitState();
}

initializeUserInterface();

function renderSubscriptionStatus() {
  if (!subscriptionStatusEl || !me) return;
  const subscription = me.subscription || { plan: "free", expiresAt: null };
  if (subscription.plan === "free" || !subscription.expiresAt) {
    $("subscriptionStatus").textContent = "Plan: Free ï¿½ screen preview only. Paid features require subscription.";
  } else {
    const active = Date.parse(subscription.expiresAt) > Date.now();
    $("subscriptionStatus").textContent = active ? `Plan: ${subscription.plan}. Active until ${new Date(subscription.expiresAt).toLocaleDateString()}.` : "Subscription expired ï¿½ choose a plan to restore access.";
  }
  if (selected && selected.subscriptionOverride && selected.subscriptionOverride.active) {
    subscriptionStatusEl.textContent += " This device has admin-granted paid access override.";
  }
}
function refreshEnrollmentHandoff() {
  if (!openAgentUserEl) return;
  const hasLink = Boolean(pendingEnrollmentLink);
  openAgentUserEl.classList.toggle("hidden", !hasLink);
  if (enrollHelpEl) enrollHelpEl.textContent = hasLink ? "After installing the APK, tap Open Installed Agent to auto-fill Device ID and Token." : "Click Enroll / Download to create an enrollment and download the Shield Device APK.";
}

async function collectUserBrowserDeviceDetails() {
  let userAgentData = null;
  try {
    userAgentData = navigator.userAgentData ? await navigator.userAgentData.getHighEntropyValues(["architecture", "bitness", "model", "platform", "platformVersion", "uaFullVersion"]) : null;
  } catch {
    userAgentData = null;
  }
  const detectedPlatform = /iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : "android";
  const screenSize = window.screen ? window.screen.width + "x" + window.screen.height : "unknown";
  const serialSource = JSON.stringify({
    userId: me && me.id,
    userAgent: navigator.userAgent,
    platform: navigator.platform,
    language: navigator.language,
    screen: screenSize,
    touchPoints: navigator.maxTouchPoints || 0
  });
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(serialSource));
  const serial = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24).toUpperCase();
  return {
    platform: detectedPlatform,
    name: (detectedPlatform === "ios" ? "iPhone" : "Android") + " User Device",
    serial,
    ownerConsent: true,
    capabilities: {
      browserEnrollment: true,
      nativeAgentRequired: detectedPlatform === "android",
      camera: Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      screenControl: false,
      shell: false
    },
    info: {
      userAgent: navigator.userAgent,
      browserPlatform: navigator.platform,
      language: navigator.language,
      screen: screenSize,
      viewport: window.innerWidth + "x" + window.innerHeight,
      pixelRatio: window.devicePixelRatio,
      touchPoints: navigator.maxTouchPoints,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      userAgentData
    }
  };
}

function buildUserAgentEnrollmentLink(enrollment) {
  const params = new URLSearchParams({ serverUrl: API_BASE, liveServerUrl: LIVE_BASE, deviceId: enrollment.deviceId, token: enrollment.token });
  return "cpdevice://enroll?" + params.toString();
}

async function enrollUserDevice() {
  if (!token) return redirectToAuth("Please login before enrolling a device.");
  if (enrollUserEl) enrollUserEl.disabled = true;
  try {
    const details = await collectUserBrowserDeviceDetails();
    const enrollment = await api("/api/user/enroll-browser", { method: "POST", body: JSON.stringify(details) });
    pendingEnrollmentLink = buildUserAgentEnrollmentLink(enrollment);
    localStorage.setItem("cpPendingEnrollmentLink", pendingEnrollmentLink);
    const downloadPath = details.platform === "ios" ? "/api/enrollment/ios-profile" : "/api/enrollment/android-agent";
    const link = document.createElement("a");
    link.href = apiUrl(downloadPath);
    link.download = details.platform === "ios" ? "cp-device-enrollment.mobileconfig" : "shield-device-agent.apk";
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (enrollHelpEl) enrollHelpEl.textContent = details.platform === "ios" ? "Install the downloaded iOS profile, then return here." : "APK download started. After installing it, tap Open Installed Agent to auto-fill enrollment details.";
    refreshEnrollmentHandoff();
    await loadDashboard();
    return enrollment;
  } finally {
    if (enrollUserEl) enrollUserEl.disabled = false;
  }
}

function openInstalledAgent() {
  if (!pendingEnrollmentLink) {
    refreshEnrollmentHandoff();
    if (enrollHelpEl) enrollHelpEl.textContent = "Click Enroll / Download first, then tap Open Installed Agent.";
    return;
  }
  window.location.href = pendingEnrollmentLink;
}

function hasPaidAccess() {
  return me && me.subscription && me.subscription.plan !== "free" && Date.parse(me.subscription.expiresAt) > Date.now();
}

function hasPaidAccessForSelected() {
  if (hasPaidAccess()) return true;
  return selected && selected.subscriptionOverride && selected.subscriptionOverride.active;
}

function openSubscriptionPage() {
  show("subscriptions");
}

function featureRequiresSubscription(type) {
  return !["screen.control.request", "screen.share.request", "device.info.refresh", "locate.device", "file.list", "file.pull", "live.stop", "lost.ring", "lost.message", "lost.disable", "lock.device"].includes(commandTypeForSelected(type));
}

const switchAuthButton = $("switchAuth");
if (switchAuthButton) {
  switchAuthButton.onclick = () => {
    const login = $("loginForm");
    const signup = $("signupForm");
    const showSignup = signup && !signup.classList.contains("active");
    if (signup) signup.classList.toggle("active", showSignup);
    if (login) login.classList.toggle("active", !showSignup);
    if (login) login.classList.toggle("slide-up", showSignup);
    switchAuthButton.textContent = showSignup ? "Login" : "Signup";
  };
}

if (signupFormEl) {
  signupFormEl.onsubmit = async (event) => {
    event.preventDefault();
    await resetFormErrors();
    if (!validateSignupForm()) {
      updateSignupSubmitState();
      return;
    }
    const normalizedPhone = phoneEl.value.replace(/\s+/g, "");
    if (!validatePhoneValue(normalizedPhone)) {
      setFieldError("phone", "Include country code, e.g. +15551234567.");
      updateSignupSubmitState();
      return;
    }
    const available = await validateSignupAvailability();
    if (!available) {
      updateSignupSubmitState();
      return;
    }
    try {
      await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email: emailEl.value.trim(), username: usernameEl.value.trim(), phone: normalizedPhone, password: passwordEl.value })
      });
      alert("Signup successful. Please login.");
      if (switchAuthEl) switchAuthEl.click();
    } catch (error) {
      if (error.message && error.message.toLowerCase().includes("already exists")) {
        const message = String(error.message).toLowerCase();
        if (message.includes("email")) setFieldError("email", "Email is already registered.");
        if (message.includes("username")) setFieldError("username", "Username is already taken.");
        if (message.includes("phone")) setFieldError("phone", "Phone number is already registered.");
        updateSignupSubmitState();
        return;
      }
      alert(error.message || "Signup failed");
    }
  };
}

if (loginFormEl) {
  loginFormEl.onsubmit = async (event) => {
    event.preventDefault();
    const loginValue = loginUserEl ? loginUserEl.value.trim() : "";
    if (!loginValue || !loginPassEl || !loginPassEl.value) {
      return alert("Enter your email/username and password.");
    }
    try {
      const response = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ login: loginValue, password: loginPassEl.value })
      });
      token = response.token;
      me = response.user;
      localStorage.cpUserToken = token;
      if (dashboardPage) await loadDashboard();
      redirectToDashboard();
    } catch (error) {
      alert(error.message || "Email/Username or Password is not valid");
    }
  };
}

const forgotButton = $("forgot");
if (forgotButton && resetModalEl) {
  forgotButton.onclick = () => {
    resetModalEl.showModal();
    resetFormErrors();
  };
}

const saveResetButton = $("saveReset");
if (saveResetButton) {
  saveResetButton.onclick = async () => {
    clearFieldErrors(resetErrors);
    if (!resetLoginEl || !resetLoginEl.value.trim()) {
      setFieldError("login", "Enter your email or username.");
      return;
    }
    if (!currentPasswordEl || !currentPasswordEl.value) {
      setFieldError("currentPassword", "Current password is required.");
      return;
    }
    if (!newPasswordEl || !newPasswordEl.value) {
      setFieldError("newPassword", "New password is required.");
      return;
    }
    if (!confirmNewPasswordEl || newPasswordEl.value !== confirmNewPasswordEl.value) {
      setFieldError("confirmNewPassword", "Passwords do not match.");
      return;
    }
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ login: resetLoginEl.value.trim(), currentPassword: currentPasswordEl.value, newPassword: newPasswordEl.value, confirmNewPassword: confirmNewPasswordEl.value })
      });
      alert("Password updated. Please login with your new password.");
      if (resetModalEl) resetModalEl.close();
    } catch (error) {
      setFieldError("login", error.message || "Password reset failed");
    }
  };
}

async function loadDashboard() {
  if (!userDevicesEl || !userFilesEl) return redirectToDashboard();
  const response = await api("/api/user/devices");
  try { userRecordings = (await api("/api/recordings")).recordings || []; } catch { userRecordings = []; }
  show("dashboard");
  renderSubscriptionStatus();
  userDevices = response.devices || [];
  userCommands = response.commands || [];
  if (selected) selected = response.devices.find((device) => device.id === selected.id) || null;
  userDevicesEl.innerHTML = "";
  userDevices.forEach((device) => {
    const card = document.createElement("div");
    card.className = "device-card";
    const subtitle = formatDeviceDisplayVersion(device);
    card.innerHTML = `<div class="device-main"><b>${escapeHtml(formatDeviceDisplayName(device))}</b>${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}</div>`;
    const controls = document.createElement("div");
    controls.className = "device-controls";
    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    selectBtn.onclick = (e) => { e.stopPropagation(); selected = device; loadDashboard(); };
    const del = document.createElement("button");
    del.className = "danger";
    del.textContent = "Delete";
    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete device ${device.name}? This cannot be undone.`)) return;
      try { await api(`/api/user/devices/${encodeURIComponent(device.id)}`, { method: "DELETE" }); selected = null; await loadDashboard(); } catch (err) { alert(err.message || err); }
    };
    controls.appendChild(selectBtn);
    controls.appendChild(del);
    card.appendChild(controls);
    if (device.subscriptionOverride && device.subscriptionOverride.active) {
      const badge = document.createElement("span");
      badge.className = "device-badge";
      badge.textContent = "Paid access override";
      card.appendChild(badge);
    }
    card.onclick = () => { selected = device; openUserDeviceInfoModal(device.id); };
    if (selected && selected.id === device.id) card.style.outline = "2px solid var(--orange)";
    userDevicesEl.appendChild(card);
  });
  renderFiles(response.files || []);
  renderUserCommandResults();
  renderUserRecordings();
  refreshFeatureGates();
  refreshEnrollmentHandoff();
}


function escapeHtml(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function openUserStoredFile(file) {
  const response = await fetch(apiUrl(`/api/user/files/${encodeURIComponent(file.id)}`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok) {
    const body = await readJsonResponse(response);
    throw new Error(body.error || "File download failed");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const opened = window.open(url, "_blank", "noopener");
  if (!opened) {
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name || "device-file";
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function renderFiles(files = []) {
  if (!userFilesEl) return;
  const visibleFiles = selected ? files.filter((file) => file.sourceDeviceId === selected.id) : files;
  userFilesEl.innerHTML = "<h2>Exported Files</h2>";
  const list = document.createElement("div");
  list.className = "file-list";
  userFilesEl.appendChild(list);
  if (!visibleFiles.length) {
    list.innerHTML = '<p class="hint">No exported files yet. Click Files, open a folder, then Export a file to view or download it here.</p>';
    return;
  }
  const actions = document.createElement("div");
  actions.className = "section-actions";
  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "danger";
  clear.textContent = "Clear All";
  clear.onclick = () => clearUserExportedFiles().catch((error) => alert(error.message || "Clear failed"));
  actions.appendChild(clear);
  userFilesEl.insertBefore(actions, list);
  visibleFiles.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).forEach((file) => {
    const row = document.createElement("div");
    row.className = "file-row";
    const type = file.contentType || "application/octet-stream";
    row.innerHTML = `<span><b>${escapeHtml(file.name || "Device file")}</b><small>${escapeHtml(type)} - ${file.size || 0} bytes</small></span>`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "View / Download";
    button.onclick = () => openUserStoredFile(file).catch((error) => alert(error.message || "File open failed"));
    row.appendChild(button);
    list.appendChild(row);
  });
}

async function clearUserExportedFiles() {
  if (!confirm("Clear all exported files in this section? This deletes them from the backend too.")) return;
  const query = selected ? `?deviceId=${encodeURIComponent(selected.id)}` : "";
  await api(`/api/user/files${query}`, { method: "DELETE" });
  await loadDashboard();
}

function parseOutputJson(output) {
  if (output && typeof output === "object") return output;
  if (typeof output !== "string") return null;
  let candidate = output.trim();
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed !== "string") return parsed;
      candidate = parsed.trim();
      continue;
    } catch { }
    const unescaped = candidate.replace(/\\"/g, '"').replace(/\\\//g, '/');
    if (unescaped === candidate) break;
    candidate = unescaped;
  }
  return null;
}

function formatDeviceDisplayName(device) {
  const info = device.info || {};
  const manufacturer = (info.manufacturer || "").trim();
  const model = (info.model || "").trim();
  const candidate = `${manufacturer} ${model}`.trim();
  return candidate || device.name || device.serial || device.id;
}

function formatDeviceDisplayVersion(device) {
  const info = device.info || {};
  if (info.androidVersion) return `Android ${info.androidVersion}`;
  if (info.iosVersion) return `iPhone ${info.iosVersion}`;
  if (info.systemVersion) return info.systemVersion;
  if (device.version) return device.version;
  return device.platform ? `${device.platform.charAt(0).toUpperCase()}${device.platform.slice(1)}` : "Device";
}


function latestUserDeviceInfo(device) {
  const refreshCommand = userCommands
    .filter((command) => command.type === "device.info.refresh" && command.deviceIds.includes(device.id) && command.results && command.results[device.id])
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const output = refreshCommand && refreshCommand.results[device.id] && refreshCommand.results[device.id].output;
  return { ...(device.deviceDetails || {}), ...(output && typeof output === "object" ? output : {}) };
}

function userInfoValueHtml(value) {
  if (Array.isArray(value)) {
    if (!value.length) return '<span class="hint">Unavailable</span>';
    return `<ul class="info-list">${value.map((item) => `<li>${userInfoValueHtml(item)}</li>`).join("")}</ul>`;
  }
  if (value && typeof value === "object") {
    return `<div class="info-grid">${Object.entries(value).map(([key, inner]) => `<div class="info-row"><b>${escapeHtml(userLabelize(key))}</b><span>${userInfoValueHtml(inner)}</span></div>`).join("")}</div>`;
  }
  return escapeHtml(value || "Unavailable");
}

function userLabelize(key) {
  return String(key || "").replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase());
}

function renderUserDeviceInfoModal(device) {
  if (!userDeviceInfoContentEl) return;
  const details = latestUserDeviceInfo(device);
  const rows = {
    "IMEI": details.imei,
    "MAC Addresses": details.macAddresses,
    "SIM Cards": details.simCards,
    "Phone Numbers": details.phoneNumbers,
    "Last 5 Call Logs": details.lastCallLogs,
    "Updated At": details.updatedAt || details.collectedAt,
    "Factory Reset Blocked In Settings": device.operation && device.operation.factoryResetBlockedInSettings ? "Yes" : "No ï¿½ requires Device Owner",
    "Recovery Mode Factory Reset": "Cannot be guaranteed blocked by a normal APK; requires OEM/enterprise FRP support"
  };
  userDeviceInfoContentEl.innerHTML = `<div class="info-grid">${Object.entries(rows).map(([key, value]) => `<div class="info-row"><b>${escapeHtml(key)}</b><span>${userInfoValueHtml(value)}</span></div>`).join("")}</div>`;
}

function openUserDeviceInfoModal(deviceId) {
  const device = userDevices.find((item) => item.id === deviceId);
  if (!device || !userDeviceInfoModalEl) return;
  userDeviceInfoDeviceId = deviceId;
  if (userDeviceInfoTitleEl) userDeviceInfoTitleEl.textContent = `${formatDeviceDisplayName(device)} Info`;
  renderUserDeviceInfoModal(device);
  if (typeof userDeviceInfoModalEl.showModal === "function" && !userDeviceInfoModalEl.open) userDeviceInfoModalEl.showModal();
}

async function refreshUserDeviceInfo() {
  const device = userDevices.find((item) => item.id === userDeviceInfoDeviceId);
  if (!device) throw new Error("Select a device first");
  await api("/api/user/commands", { method: "POST", body: JSON.stringify({ deviceIds: [device.id], type: "device.info.refresh", payload: { requestedAt: new Date().toISOString() } }) });
  if (userDeviceInfoContentEl) userDeviceInfoContentEl.innerHTML = '<p class="hint">Refresh queued. Waiting for the enrolled device agent...</p>';
  setTimeout(loadDashboard, 1200);
}
function friendlyCommandLabel(type) {
  const map = {
    "locate.device": "Locate device",
    "file.list": "Browse files",
    "file.pull": "Export file",
    "screen.control.request": "Start remote screen",
    "camera.stream.request": "Start live camera",
    "camera.switch": "Switch camera",
    "lock.device": "Lock device",
    "lost.ring": "Lost Mode ring",
    "lost.message": "Lost Mode message",
    "lost.disable": "Disable lost mode",
    "live.stop": "Stop live session",
    "mobile.data.on": "Turn on mobile data",
    "device.info.refresh": "Refresh device info",
    "shell": "Execute shell command",
    "app.install": "Install app",
    "firmware.update": "Firmware update"
  };
  return map[type] || type.replace(/\./g, " ");
}

function renderCommandResultText(result, command) {
  if (!result) return "Queued: waiting for device agent...";
  if (result.error) return `Failed: ${String(result.error)}`;
  if (command.type === "locate.device") {
    const loc = typeof result.output === "object" ? result.output : null;
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) return `Location found: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}${loc.accuracy ? ` (Â±${Math.round(loc.accuracy)}m)` : ""}`;
  }
  if (command.type === "file.list") {
    const listed = typeof result.output === "object" ? result.output : null;
    if (listed && Array.isArray(listed.files)) return `Listed ${listed.files.length} items.`;
    return "File list requested.";
  }
  if (command.type === "file.pull") return "File export requested.";
  if (command.type === "screen.control.request" || command.type === "camera.stream.request") return result.ok ? "Live session started." : "Live session requested.";
  if (command.type === "lock.device") return result.ok ? "Lock command sent." : "Lock command requested.";
  if (["lost.ring", "lost.message", "lost.disable"].includes(command.type)) return result.output && typeof result.output === "string" ? result.output : "Lost Mode command completed.";
  if (command.type === "mobile.data.on") return result.ok ? "Mobile data toggle requested." : "Mobile data request queued.";
  if (result.output && typeof result.output === "string") return result.output;
  if (result.output && typeof result.output === "object") return `Result: ${Object.keys(result.output).join(", ")}`;
  return result.ok ? "Command completed." : "Command returned result.";
}

function showLocationModal(location, message = "") {
  const modal = locationModalEl || $("locationModal");
  const text = locationTextEl || $("locationText");
  const link = locationMapLinkEl || $("locationMapLink");
  if (!modal || !text || !link) return;
  if (!location || !Number.isFinite(location.lat) || !Number.isFinite(location.lng)) {
    text.textContent = message || "Locating device in real time... waiting for the enrolled agent.";
    link.removeAttribute("href");
    link.textContent = "Google Map link will appear when location is ready.";
  } else {
    const mapUrl = location.mapUrl || `https://www.google.com/maps?q=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
    text.textContent = `${selected ? formatDeviceDisplayName(selected) : "Device"}: ${location.lat}, ${location.lng}${location.accuracy ? ` - accuracy ${Math.round(location.accuracy)}m` : ""}`;
    link.href = mapUrl;
    link.textContent = "Open location in Google Maps";
  }
  if (typeof modal.showModal === "function" && !modal.open) modal.showModal();
}

function showUserFilesModal(status = "Waiting for file list...") {
  if (userFilesModalTitleEl) userFilesModalTitleEl.textContent = selected ? `${formatDeviceDisplayName(selected)} Files` : "Device Files";
  if (userFilesStatusEl) userFilesStatusEl.textContent = status;
  if (userFilesModalContentEl) userFilesModalContentEl.innerHTML = "";
  if (userFilesModalEl && typeof userFilesModalEl.showModal === "function" && !userFilesModalEl.open) userFilesModalEl.showModal();
}

function renderUserFileList(files, container = userFilesEl) {
  if (!container) return;
  container.innerHTML = "";
  if (!files.length) {
    container.innerHTML = '<p class="hint">No files found for this path.</p>';
    return;
  }
  files.forEach((file) => {
    const row = document.createElement("div");
    row.className = "file-row";
    row.innerHTML = `<span><b>${escapeHtml(file.name || file.path || "Item")}</b><small>${escapeHtml(file.path || "")} - ${file.directory ? "folder" : `${file.size || 0} bytes`}</small></span>`;
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = file.directory ? "Open" : "Export";
    button.onclick = () => runUserFileCommand(file.directory ? "file.list" : "file.pull", file.path || "/sdcard");
    row.appendChild(button);
    container.appendChild(row);
  });
}

function renderUserCommandResults() {
  if (!selected || !userFilesEl) return;
  const selectedCommands = userCommands.filter((command) => command.deviceIds.includes(selected.id));
  const latestLocate = [...selectedCommands].reverse().find((command) => command.type === "locate.device" && command.results && command.results[selected.id]);
  const location = latestLocate && parseOutputJson(latestLocate.results[selected.id].output);
  const modal = locationModalEl || $("locationModal");
  if (location && modal && Number.isFinite(location.lat) && Number.isFinite(location.lng) && modal.dataset.commandId !== latestLocate.id) {
    modal.dataset.commandId = latestLocate.id;
    showLocationModal(location);
  }
  const latestList = (activeUserFileBrowserCommandId && userCommands.find((command) => command.id === activeUserFileBrowserCommandId && command.type === "file.list" && command.results && command.results[selected.id])) || [...selectedCommands].reverse().find((command) => command.type === "file.list" && command.results && command.results[selected.id]);
  const listed = latestList && parseOutputJson(latestList.results[selected.id].output);
  if (listed && listed.error && userFilesEl) {
    userFilesEl.innerHTML = `<h2>Device Files</h2><p class="hint">${escapeHtml(listed.error)}</p>`;
  }
  if (listed && Array.isArray(listed.files)) {
    userFilesEl.innerHTML = "<h2>Device Files</h2>";
    const listHost = document.createElement("div");
    listHost.className = "file-list";
    userFilesEl.appendChild(listHost);
    renderUserFileList(listed.files, listHost);
    if (userFilesModalEl && userFilesModalEl.open) {
      if (userFilesStatusEl) userFilesStatusEl.textContent = `Listed ${listed.files.length} item(s).`;
      renderUserFileList(listed.files, userFilesModalContentEl);
    }
  }
}

function userCommandGateMessage(type) {
  if (!selected) return "Select a device first.";
  const capabilities = selected.capabilities || {};
  const actualType = commandTypeForSelected(type);
  if (capabilities.browserEnrollment && !capabilities.nativeAgent && !capabilities.appleMdm) return "Install the Android agent or complete iPhone MDM enrollment first.";
  if (selected.platform === "android") {
    if (actualType === "screen.tap" && !capabilities.accessibility) return "Enable Shield Device Accessibility service first.";
    if (["camera.stream.request", "camera.switch"].includes(actualType) && !capabilities.camera) return "Allow camera permission in Shield Device first.";
    if (["camera.stream.request", "camera.switch"].includes(actualType) && capabilities.microphone === false) return "Allow microphone permission in Shield Device for camera audio.";
    if (actualType === "lock.device" && !capabilities.nativeAgent && !capabilities.deviceAdmin && !capabilities.deviceOwner) return "Install Shield Device Agent and approve Device Admin or provision Device Owner first.";
    if (actualType === "mobile.data.on" && !capabilities.oemPrivileged) return "Requires OEM/system privileges.";
  }
  if (selected.platform === "ios") {
    if (!capabilities.appleMdm) return "Install the iPhone MDM profile and complete Apple MDM/APNs enrollment first.";
    if (actualType === "locate.device" && !capabilities.supervised) return "Requires supervised iPhone Lost Mode support.";
    if (["file.list", "file.pull", "mobile.data.on", "camera.stream.request", "camera.switch", "live.stop", "lost.ring", "lost.message", "lost.disable"].includes(type)) return "Not supported by public Apple MDM APIs.";
  }
  return "";
}

function refreshFeatureGates() {
  document.querySelectorAll("[data-feature]").forEach((button) => {
    const message = userCommandGateMessage(button.dataset.feature);
    button.disabled = Boolean(message);
    button.title = message || "Available for selected device";
  });
}

function commandTypeForSelected(type) {
  if (!selected || selected.platform !== "ios") return type;
  if (type === "screen.control.request") return "screen.share.request";
  return type;
}

function unsupportedIosFeature(type) {
  return selected && selected.platform === "ios" && ["file.list", "file.pull", "camera.stream.request", "camera.switch", "live.stop", "mobile.data.on", "lost.ring", "lost.message", "lost.disable"].includes(type);
}

function livePreviewUnavailable() {
  return selected && selected.platform === "ios";
}

async function waitForUserCommandResult(commandId, deviceId, onUpdate, timeoutMs = 15000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 800));
    const response = await api("/api/user/devices");
    userDevices = response.devices || [];
    userCommands = response.commands || [];
    const found = userCommands.find((item) => item.id === commandId);
    const result = found && found.results && found.results[deviceId];
    if (onUpdate) onUpdate(result, found);
    if (result) return { result, command: found };
  }
  return { result: null, command: userCommands.find((item) => item.id === commandId) || null };
}

async function runUserLocateCommand() {
  if (!selected) return alert("Select device first");
  showLocationModal(null, "Locating device in real time... waiting for the enrolled agent.");
  const queued = await command("locate.device", { requestedAt: new Date().toISOString() });
  if (!queued) return;
  const { result } = await waitForUserCommandResult(queued.id, selected.id, (partial) => {
    if (partial && partial.output && typeof partial.output === "string") showLocationModal(null, partial.output);
  });
  const location = result && parseOutputJson(result.output);
  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng)) showLocationModal(location);
  else showLocationModal(null, result && result.output ? String(result.output) : "Location is still pending. Keep the agent online and try Locate again if no result appears.");
}

async function runUserFileCommand(type = "file.list", path = "/sdcard") {
  if (!selected) return alert("Select device first");
  showUserFilesModal(type === "file.list" ? `Browsing ${path}... waiting for the enrolled agent.` : `Exporting ${path}... waiting for the enrolled agent.`);
  const queued = await command(type, { path, requestedAt: new Date().toISOString() });
  if (!queued) return;
  if (type === "file.list") activeUserFileBrowserCommandId = queued.id;
  const { result } = await waitForUserCommandResult(queued.id, selected.id);
  if (!result) { if (userFilesStatusEl) userFilesStatusEl.textContent = "Still waiting for the enrolled agent. Try again if the device is offline."; return; }
  if (type === "file.pull") {
    if (userFilesStatusEl) userFilesStatusEl.textContent = "Export requested. Download will appear in Exported Files after the agent uploads it.";
    await loadDashboard();
    return;
  }
  const listed = parseOutputJson(result.output);
  if (listed && Array.isArray(listed.files)) {
    if (userFilesStatusEl) userFilesStatusEl.textContent = listed.error || `Listed ${listed.files.length} item(s) from ${path}.`;
    if (listed.error && userFilesModalContentEl) userFilesModalContentEl.innerHTML = `<p class="hint">${escapeHtml(listed.error)}</p>`;
    else renderUserFileList(listed.files, userFilesModalContentEl);
    renderUserCommandResults();
  } else if (userFilesStatusEl) {
    userFilesStatusEl.textContent = result.output ? String(result.output) : "No file list returned.";
  }
}

async function command(type, payload = {}) {
  if (!selected) return alert("Select device first");
  const actualType = commandTypeForSelected(type);
  if (unsupportedIosFeature(type)) {
    alert("This iPhone feature is not available through public Apple MDM APIs. iPhone enrollment supports profile enrollment, app/MDM commands, device lock, supervised Lost Mode location where configured, and screen-share request workflows.");
    return null;
  }
  try {
    return await api("/api/user/commands", { method: "POST", body: JSON.stringify({ deviceIds: [selected.id], type: actualType, payload }) });
  } catch (error) {
    if (error.subscriptionRequired) return openSubscriptionPage();
    throw error;
  }
}

document.querySelectorAll("[data-feature]").forEach((button) => {
  button.onclick = async () => {
    try {
      if (userLostMessageFormEl && userLostMessageFormEl.contains(button)) return;
      const type = button.dataset.feature;
      if (button.dataset.lostAction === "locate") return runUserLocateCommand();
      if (type === "live.stop") {
        const result = await command("live.stop", { requestedAt: new Date().toISOString(), mode: "user-control-session" });
        if (result) stopUserLiveLocal(`Live stop requested for ${formatDeviceDisplayName(selected)}.`);
        setTimeout(() => loadDashboard().catch(() => {}), 1200);
        return;
      }
      if (type === "locate.device") return runUserLocateCommand();
      if (type === "file.list") return runUserFileCommand("file.list", "/sdcard");
      if (featureRequiresSubscription(type) && !hasPaidAccessForSelected()) return openSubscriptionPage();
      const payload = { path: "/sdcard", requestedAt: new Date().toISOString() };
      if (["lost.ring", "lost.disable"].includes(type)) payload.mode = "lost-mode";
      if (type === "camera.stream.request") payload.facing = button.dataset.cameraFacing || "front";
      const result = await command(type, payload);
      if (!result) return;
      if (["lost.ring", "lost.disable", "lock.device"].includes(type)) alert(friendlyCommandLabel(type) + " queued for " + formatDeviceDisplayName(selected) + ".");
      setTimeout(() => loadDashboard().catch(() => {}), 2500);
      if (["screen.control.request", "camera.stream.request"].includes(type) && !livePreviewUnavailable()) openLive(type === "camera.stream.request" ? "camera" : "screen");
      if (type === "screen.control.request" && livePreviewUnavailable()) alert("iPhone screen viewing uses Apple-approved screen-share/MDM workflows. The request was queued; live remote control like Android is not available from a web profile alone.");
    } catch (error) {
      alert(error.message || "Command failed");
    }
  };
});

if (userLostMessageFormEl) {
  userLostMessageFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      if (!selected) return alert("Select device first");
      const message = userLostMessageEl && userLostMessageEl.value.trim() ? userLostMessageEl.value.trim() : "This device is lost. Please contact the owner.";
      const result = await command("lost.message", { message, requestedAt: new Date().toISOString(), mode: "lost-mode" });
      if (result) alert("Lost Mode message queued for " + formatDeviceDisplayName(selected) + ".");
      setTimeout(() => loadDashboard().catch(() => {}), 1200);
    } catch (error) {
      alert(error.message || "Lost Mode message failed");
    }
  });
}

function userLiveTapPayload(event, imageElement) {
  if (!imageElement || !imageElement.naturalWidth || !imageElement.naturalHeight) return null;
  const rect = imageElement.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const xRatio = (event.clientX - rect.left) / rect.width;
  const yRatio = (event.clientY - rect.top) / rect.height;
  if (xRatio < 0 || xRatio > 1 || yRatio < 0 || yRatio > 1) return null;
  return {
    x: Math.round(xRatio * imageElement.naturalWidth),
    y: Math.round(yRatio * imageElement.naturalHeight),
    xRatio: Number(xRatio.toFixed(6)),
    yRatio: Number(yRatio.toFixed(6)),
    frameWidth: imageElement.naturalWidth,
    frameHeight: imageElement.naturalHeight,
    requestedAt: new Date().toISOString()
  };
}

function recordingDeviceLabel(recording) {
  const device = userDevices.find((item) => item.id === recording.deviceId) || selected;
  return recording.name || `${device ? formatDeviceDisplayName(device) : recording.deviceId || "Device"} live recording`;
}

function formatBytes(bytes = 0) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function formatRecordingDuration(durationMs) {
  const totalSeconds = Math.max(0, Math.round((Number(durationMs) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return totalSeconds ? `Duration ${minutes}:${String(seconds).padStart(2, "0")}` : "";
}

function renderUserRecordings() {
  if (!userRecordingsEl) return;
  const recordings = [...(userRecordings || [])].sort((a, b) => new Date(b.createdAt || b.updatedAt || 0) - new Date(a.createdAt || a.updatedAt || 0));
  userRecordingsEl.innerHTML = recordings.length ? "" : '<p class="hint">No saved recordings yet.</p>';
  if (recordings.length) {
    const actions = document.createElement("div");
    actions.className = "section-actions";
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "danger";
    clear.textContent = "Clear All";
    clear.onclick = () => clearUserRecordings().catch((error) => alert(error.message || "Clear failed"));
    actions.appendChild(clear);
    userRecordingsEl.appendChild(actions);
  }
  for (const recording of recordings) {
    const card = document.createElement("div");
    card.className = "device-card recording-card";
    const title = escapeHtml(recordingDeviceLabel(recording));
    const meta = `${escapeHtml(recording.status || "recording")} • ${recording.frameCount || 0} frames • ${formatBytes(recording.size || 0)}`;
    const duration = formatRecordingDuration(recording.durationMs);
    card.innerHTML = `<div class="device-main"><b>${title}</b><small>${meta}</small>${duration ? `<small>${escapeHtml(duration)}</small>` : ""}</div>`;
    const controls = document.createElement("div");
    controls.className = "device-controls";
    const view = document.createElement("button");
    view.type = "button";
    view.textContent = "View";
    view.onclick = () => viewUserRecording(recording.id);
    const download = document.createElement("button");
    download.type = "button";
    download.textContent = "Download";
    download.onclick = () => downloadUserRecording(recording.id).catch((error) => alert(error.message));
    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "Delete";
    del.onclick = () => deleteUserRecording(recording.id).catch((error) => alert(error.message));
    controls.appendChild(view);
    controls.appendChild(download);
    controls.appendChild(del);
    card.appendChild(controls);
    userRecordingsEl.appendChild(card);
  }
}


async function clearUserRecordings() {
  if (!confirm("Clear all saved recordings? This deletes them from the backend too.")) return;
  await api("/api/recordings", { method: "DELETE" });
  activeUserRecordingId = "";
  localStorage.removeItem("cpUserActiveRecordingId");
  await loadDashboard();
}

function userRecordingMimeType() {
  const choices = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4;codecs=h264,aac", "video/mp4", "video/webm;codecs=vp8,opus", "video/webm;codecs=vp8", "video/webm"];
  return choices.find((type) => window.MediaRecorder && MediaRecorder.isTypeSupported(type)) || "";
}

function userLiveVisualElement() {
  return userWebRtcVideoEl && userWebRtcVideoEl.srcObject ? userWebRtcVideoEl : userFrameEl;
}

function drawUserRecordingFrame(context, canvas) {
  const visual = userLiveVisualElement();
  context.fillStyle = "#000";
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (!visual) return;
  const sourceWidth = visual.videoWidth || visual.naturalWidth || visual.clientWidth || canvas.width;
  const sourceHeight = visual.videoHeight || visual.naturalHeight || visual.clientHeight || canvas.height;
  if (!sourceWidth || !sourceHeight) return;
  const scale = Math.min(canvas.width / sourceWidth, canvas.height / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  const x = (canvas.width - width) / 2;
  const y = (canvas.height - height) / 2;
  try { context.drawImage(visual, x, y, width, height); } catch {}
}

async function startUserBrowserRecording() {
  if (!window.MediaRecorder) throw new Error("This browser does not support live recording.");
  userRecordingChunks = [];
  userRecordingBlob = null;
  userRecordingCanvas = document.createElement("canvas");
  const visual = userLiveVisualElement();
  userRecordingCanvas.width = Math.max(320, Math.min(1280, (visual && (visual.videoWidth || visual.naturalWidth || visual.clientWidth)) || 854));
  userRecordingCanvas.height = Math.max(240, Math.min(720, (visual && (visual.videoHeight || visual.naturalHeight || visual.clientHeight)) || 480));
  const context = userRecordingCanvas.getContext("2d");
  const stream = userRecordingCanvas.captureStream(12);
  if (userWebRtcVideoEl && userWebRtcVideoEl.srcObject) {
    for (const track of userWebRtcVideoEl.srcObject.getAudioTracks()) stream.addTrack(track);
  } else if (userLiveAudioContext) {
    userRecordingAudioDestination = userLiveAudioContext.createMediaStreamDestination();
    for (const track of userRecordingAudioDestination.stream.getAudioTracks()) stream.addTrack(track);
  }
  userRecordingDrawTimer = setInterval(() => drawUserRecordingFrame(context, userRecordingCanvas), 83);
  drawUserRecordingFrame(context, userRecordingCanvas);
  const mimeType = userRecordingMimeType();
  userMediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  userMediaRecorder.ondataavailable = (event) => { if (event.data && event.data.size) userRecordingChunks.push(event.data); };
  userRecordingStopPromise = new Promise((resolve) => {
    userMediaRecorder.onstop = () => {
      if (userRecordingDrawTimer) clearInterval(userRecordingDrawTimer);
      userRecordingDrawTimer = null;
      userRecordingAudioDestination = null;
      stream.getTracks().forEach((track) => { if (track.kind === "video") track.stop(); });
      userRecordingBlob = new Blob(userRecordingChunks, { type: userMediaRecorder.mimeType || "video/mp4" });
      resolve(userRecordingBlob);
    };
  });
  userRecordingStartedAt = Date.now();
  userMediaRecorder.start(1000);
}

async function stopUserBrowserRecording() {
  if (!userMediaRecorder) return userRecordingBlob;
  if (userMediaRecorder.state !== "inactive") userMediaRecorder.stop();
  const blob = await userRecordingStopPromise;
  userMediaRecorder = null;
  userRecordingStopPromise = null;
  return blob;
}

async function uploadUserBrowserRecording(recordingId) {
  const blob = await stopUserBrowserRecording();
  if (!blob || !blob.size) throw new Error("No recording data captured. Start live video first, then start recording after frames are visible.");
  const durationMs = userRecordingStartedAt ? Math.max(0, Date.now() - userRecordingStartedAt) : 0;
  const response = await fetch(apiUrl(`/api/recordings/${encodeURIComponent(recordingId)}/upload?durationMs=${encodeURIComponent(durationMs)}`), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": blob.type || "video/mp4", "X-Device-Id": selected ? selected.id : "" },
    body: blob
  });
  const body = await readJsonResponse(response);
  if (!response.ok) throw new Error(body.error || "Recording upload failed");
  userRecordingStartedAt = 0;
  return body.recording;
}
async function startUserRecording() {
  if (!selected) throw new Error("Select a device before recording");
  if (!hasPaidAccessForSelected()) return openSubscriptionPage();
  const body = await api("/api/recordings/start", { method: "POST", body: JSON.stringify({ deviceId: selected.id }) });
  activeUserRecordingId = body.recording && body.recording.id;
  if (activeUserRecordingId) localStorage.setItem("cpUserActiveRecordingId", activeUserRecordingId);
  await startUserBrowserRecording();
  if (userRecordingStatusEl) userRecordingStatusEl.textContent = `Recording ${formatDeviceDisplayName(selected)}...`;
  await loadDashboard();
}

async function stopUserRecording() {
  if (!activeUserRecordingId) throw new Error("No active recording to stop");
  await uploadUserBrowserRecording(activeUserRecordingId);
  const body = await api(`/api/recordings/${encodeURIComponent(activeUserRecordingId)}/stop`, { method: "POST", body: JSON.stringify({ deviceId: selected && selected.id }) });
  if (userRecordingStatusEl) userRecordingStatusEl.textContent = `Recording stopped: ${body.recording ? body.recording.id : activeUserRecordingId}`;
  await loadDashboard();
}

async function saveUserRecording() {
  if (!activeUserRecordingId) throw new Error("No active recording to save");
  if (userMediaRecorder && userMediaRecorder.state !== "inactive") await uploadUserBrowserRecording(activeUserRecordingId);
  const body = await api(`/api/recordings/${encodeURIComponent(activeUserRecordingId)}/save`, { method: "POST", body: JSON.stringify({ deviceId: selected && selected.id }) });
  activeUserRecordingId = "";
  localStorage.removeItem("cpUserActiveRecordingId");
  if (body.recording) {
    userRecordings = [body.recording, ...userRecordings.filter((recording) => recording.id !== body.recording.id)];
    renderUserRecordings();
  }
  if (userRecordingStatusEl) userRecordingStatusEl.textContent = body.github && body.github.skipped ? `Saved locally: ${body.github.reason}` : "Recording saved.";
  await loadDashboard();
}

function viewUserRecording(recordingId) {
  window.open(apiUrl(`/api/recordings/${encodeURIComponent(recordingId)}/download?inline=1&token=${encodeURIComponent(token)}`), "_blank", "noopener");
}

async function downloadUserRecording(recordingId) {
  const response = await fetch(apiUrl(`/api/recordings/${encodeURIComponent(recordingId)}/download`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok) {
    const body = await readJsonResponse(response);
    throw new Error(body.error || "Recording download failed");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = blob.type && blob.type.includes("mp4") ? `${recordingId}.mp4` : blob.type && blob.type.includes("webm") ? `${recordingId}.webm` : `${recordingId}.mjpeg`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function deleteUserRecording(recordingId) {
  if (!confirm("Delete this recording permanently?")) return;
  await api(`/api/recordings/${encodeURIComponent(recordingId)}`, { method: "DELETE" });
  if (activeUserRecordingId === recordingId) {
    activeUserRecordingId = "";
    localStorage.removeItem("cpUserActiveRecordingId");
  }
  await loadDashboard();
}
function resetUserLiveFrameState() {
  userLiveFrameSequence += 1;
  userRenderedFrameSequence = userLiveFrameSequence;
  userLastLiveFrameUpdatedAt = "";
  if (liveFetchController) liveFetchController.abort();
  liveFetchController = null;
  if (userLiveFrameUrl) URL.revokeObjectURL(userLiveFrameUrl);
  userLiveFrameUrl = "";
}

function renderUserLiveBlob(blob) {
  if (!userFrameEl || !blob) return;
  if (userLiveRenderBusy) {
    userLivePendingBlob = blob;
    return;
  }
  userLiveRenderBusy = true;
  const url = URL.createObjectURL(blob);
  const probe = new Image();
  probe.onload = () => {
    const previous = userLiveFrameUrl;
    userLiveFrameUrl = url;
    userFrameEl.src = url;
    userFrameEl.alt = "Live device screen streaming";
    if (previous && previous !== url) URL.revokeObjectURL(previous);
    userLiveRenderBusy = false;
    if (userLivePendingBlob) {
      const nextBlob = userLivePendingBlob;
      userLivePendingBlob = null;
      renderUserLiveBlob(nextBlob);
    }
  };
  probe.onerror = () => {
    URL.revokeObjectURL(url);
    userLiveRenderBusy = false;
  };
  probe.src = url;
}


function getUserWebRtcVideoElement() {
  const liveHost = $("userLive");
  if (!liveHost) return null;
  if (!userWebRtcVideoEl) {
    userWebRtcVideoEl = document.createElement("video");
    userWebRtcVideoEl.id = "userLiveVideo";
    userWebRtcVideoEl.className = "live-video";
    userWebRtcVideoEl.autoplay = true;
    userWebRtcVideoEl.playsInline = true;
    userWebRtcVideoEl.controls = false;
    userWebRtcVideoEl.muted = false;
    liveHost.insertBefore(userWebRtcVideoEl, userFrameEl || liveHost.firstChild);
  }
  return userWebRtcVideoEl;
}

function sendUserWebRtcSignal(payload) {
  if (userWebRtcSignal && userWebRtcSignal.readyState === WebSocket.OPEN) userWebRtcSignal.send(JSON.stringify(payload));
}

function stopUserWebRtcLive() {
  if (userWebRtcConnectTimer) clearTimeout(userWebRtcConnectTimer);
  userWebRtcConnectTimer = null;
  try { if (userWebRtcSignal) userWebRtcSignal.close(); } catch {}
  try { if (userWebRtcPeer) userWebRtcPeer.close(); } catch {}
  userWebRtcSignal = null;
  userWebRtcPeer = null;
  if (userWebRtcVideoEl) {
    try { if (userWebRtcVideoEl.srcObject) userWebRtcVideoEl.srcObject.getTracks().forEach((track) => track.stop()); } catch {}
    userWebRtcVideoEl.srcObject = null;
    userWebRtcVideoEl.classList.remove("active");
  }
}

async function loadUserWebRtcConfig() {
  const response = await fetch(apiUrl("/api/webrtc/config"), { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!response.ok) throw new Error("WebRTC config unavailable");
  return response.json();
}

async function tryUserWebRtcLive(mode, fallback) {
  if (!selected || !window.RTCPeerConnection || !window.WebSocket) { fallback(); return false; }
  stopUserWebRtcLive();
  const config = await loadUserWebRtcConfig().catch(() => null);
  if (!config) { fallback(); return false; }
  const timeoutMs = Math.max(8000, Math.min(12000, Number(config.timeoutMs || 10000)));
  const retryMs = Math.max(30000, Number(config.retryMs || 45000));
  const video = getUserWebRtcVideoElement();
  let connected = false;
  let fallbackStarted = false;
  const startFallback = () => {
    if (fallbackStarted || connected) return;
    fallbackStarted = true;
    stopUserWebRtcLive();
    fallback();
    userWebRtcConnectTimer = setTimeout(() => tryUserWebRtcLive(mode, () => {}).catch(() => {}), retryMs);
  };
  userWebRtcPeer = new RTCPeerConnection({ iceServers: config.iceServers || [] });
  userWebRtcPeer.addTransceiver("video", { direction: "recvonly" });
  if (mode === "camera") userWebRtcPeer.addTransceiver("audio", { direction: "recvonly" });
  userWebRtcPeer.onicecandidate = (event) => { if (event.candidate) sendUserWebRtcSignal({ type: "candidate", candidate: event.candidate }); };
  userWebRtcPeer.ontrack = (event) => {
    connected = true;
    if (livePollTimer) clearTimeout(livePollTimer);
    livePollTimer = null;
    stopUserLiveAudio();
    if (video) {
      video.srcObject = event.streams[0];
      video.classList.add("active");
      if (userFrameEl) userFrameEl.alt = mode === "camera" ? "WebRTC camera stream active." : "WebRTC screen stream active.";
    }
  };
  userWebRtcPeer.onconnectionstatechange = () => {
    if (["failed", "closed", "disconnected"].includes(userWebRtcPeer.connectionState)) startFallback();
  };
  userWebRtcSignal = new WebSocket(liveWsUrl(`/ws/webrtc-viewer?deviceId=${encodeURIComponent(selected.id)}&mode=${encodeURIComponent(mode)}&adminToken=${encodeURIComponent(token)}`));
  userWebRtcSignal.onmessage = async (event) => {
    let message;
    try { message = JSON.parse(event.data); } catch { return; }
    if (message.type === "answer" && message.sdp) await userWebRtcPeer.setRemoteDescription(message.sdp).catch(() => startFallback());
    if (message.type === "candidate" && message.candidate) await userWebRtcPeer.addIceCandidate(message.candidate).catch(() => {});
    if (message.type === "device.disconnected") startFallback();
  };
  userWebRtcSignal.onerror = startFallback;
  userWebRtcSignal.onopen = async () => {
    try {
      const offer = await userWebRtcPeer.createOffer();
      await userWebRtcPeer.setLocalDescription(offer);
      sendUserWebRtcSignal({ type: "offer", sdp: userWebRtcPeer.localDescription, mode });
    } catch { startFallback(); }
  };
  userWebRtcConnectTimer = setTimeout(startFallback, timeoutMs);
  return true;
}
async function fetchUserLiveFrame() {
  if (!selected) return;
  if (liveFetchController) return;
  const controller = new AbortController();
  liveFetchController = controller;
  const response = await fetch(liveApiUrl(`/api/live/${encodeURIComponent(selected.id)}/frame?t=${Date.now()}`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: controller.signal
  });
  if (response.status === 204) { if (liveFetchController === controller) liveFetchController = null; return; }
  if (!response.ok) {
    if (liveFetchController === controller) liveFetchController = null;
    throw new Error(response.status === 404 ? "No live frame yet. Open Shield Device and tap Start Live Screen." : "Live frame unavailable");
  }
  const updatedAt = response.headers.get("X-Frame-Updated-At") || "";
  if (updatedAt && userLastLiveFrameUpdatedAt && Date.parse(updatedAt) < Date.parse(userLastLiveFrameUpdatedAt)) { if (liveFetchController === controller) liveFetchController = null; return; }
  const blob = await response.blob();
  if (controller.signal.aborted) { if (liveFetchController === controller) liveFetchController = null; return; }
  if (updatedAt) userLastLiveFrameUpdatedAt = updatedAt;
  renderUserLiveBlob(blob);
  if (liveFetchController === controller) liveFetchController = null;
}

function stopUserLiveAudio() {
  if (audioWs) audioWs.close();
  if (liveAudioPollTimer) clearTimeout(liveAudioPollTimer);
  if (liveAudioFetchController) liveAudioFetchController.abort();
  audioWs = null;
  liveAudioPollTimer = null;
  liveAudioFetchController = null;
  userLiveAudioNextTime = 0;
  userLastLiveAudioUpdatedAt = "";
}

async function ensureUserLiveAudioContext() {
  const AudioCtor = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtor) return null;
  if (!userLiveAudioContext) userLiveAudioContext = new AudioCtor({ sampleRate: 16000 });
  if (userLiveAudioContext.state === "suspended") await userLiveAudioContext.resume();
  return userLiveAudioContext;
}

function playUserPcmChunk(arrayBuffer, sampleRate = 16000) {
  if (!userLiveAudioContext || !arrayBuffer || arrayBuffer.byteLength < 2) return;
  const samples = new Int16Array(arrayBuffer);
  const audioBuffer = userLiveAudioContext.createBuffer(1, samples.length, sampleRate);
  const channel = audioBuffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) channel[index] = Math.max(-1, Math.min(1, samples[index] / 32768));
  const source = userLiveAudioContext.createBufferSource();
  source.buffer = audioBuffer;
  source.connect(userLiveAudioContext.destination);
  if (userRecordingAudioDestination) source.connect(userRecordingAudioDestination);
  const now = userLiveAudioContext.currentTime;
  if (!userLiveAudioNextTime || userLiveAudioNextTime < now || userLiveAudioNextTime - now > 0.45) userLiveAudioNextTime = now + 0.04;
  source.start(userLiveAudioNextTime);
  userLiveAudioNextTime += audioBuffer.duration;
}

async function fetchUserLiveAudio() {
  if (!selected) return;
  if (liveAudioFetchController) liveAudioFetchController.abort();
  const controller = new AbortController();
  liveAudioFetchController = controller;
  const response = await fetch(liveApiUrl(`/api/live/${encodeURIComponent(selected.id)}/audio?t=${Date.now()}`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
    signal: controller.signal
  });
  if (response.status === 204) { if (liveFetchController === controller) liveFetchController = null; return; }
  if (!response.ok) return;
  const updatedAt = response.headers.get("X-Audio-Updated-At") || "";
  if (updatedAt && userLastLiveAudioUpdatedAt && Date.parse(updatedAt) <= Date.parse(userLastLiveAudioUpdatedAt)) return;
  const sampleRate = Number(response.headers.get("X-Audio-Sample-Rate") || 16000) || 16000;
  const chunk = await response.arrayBuffer();
  if (controller.signal.aborted) { if (liveFetchController === controller) liveFetchController = null; return; }
  if (updatedAt) userLastLiveAudioUpdatedAt = updatedAt;
  playUserPcmChunk(chunk, sampleRate);
}

async function startUserLiveAudio() {
  await ensureUserLiveAudioContext();
  stopUserLiveAudio();
  stopUserWebRtcLive();
  await ensureUserLiveAudioContext();
  const startAudioPolling = () => {
    if (liveAudioPollTimer) return;
    const poll = async () => {
      await fetchUserLiveAudio().catch(() => {});
      liveAudioPollTimer = setTimeout(poll, 180);
    };
    poll();
  };
  if (!persistentLiveConfigured() && (API_BASE || location.origin).includes("vercel.app")) {
    startAudioPolling();
    return;
  }
  audioWs = new WebSocket(liveWsUrl(`/ws/live-audio?deviceId=${encodeURIComponent(selected.id)}&adminToken=${encodeURIComponent(token)}`));
  audioWs.binaryType = "arraybuffer";
  audioWs.onmessage = (event) => playUserPcmChunk(event.data, 16000);
  audioWs.onerror = () => {
    if (audioWs) audioWs.close();
  };
  const backupPoll = async () => {
    await fetchUserLiveAudio().catch(() => {});
    liveAudioPollTimer = setTimeout(backupPoll, 500);
  };
  backupPoll();
}

function stopUserLiveLocal(message = "Live session stopped.") {
  if (ws) ws.close();
  if (livePollTimer) clearTimeout(livePollTimer);
  if (liveFallbackTimer) clearTimeout(liveFallbackTimer);
  if (liveFetchController) liveFetchController.abort();
  stopUserLiveAudio();
  stopUserWebRtcLive();
  ws = null;
  livePollTimer = null;
  liveFallbackTimer = null;
  liveFetchController = null;
  lastLiveFrameAt = 0;
  resetUserLiveFrameState();
  if (userFrameEl) {
    userFrameEl.removeAttribute("src");
    userFrameEl.alt = message;
  }
}
function startUserJpegLive(mode = "screen") {
  if (mode === "camera") startUserLiveAudio().catch(() => {});
  else stopUserLiveAudio();
  const startPolling = () => {
    if (livePollTimer) return;
    const poll = async () => {
      try {
        await fetchUserLiveFrame();
      } catch (error) {
        if (error.name !== "AbortError") userFrameEl.alt = error.message;
      } finally {
        livePollTimer = setTimeout(poll, 220);
      }
    };
    poll();
  };
  if (!persistentLiveConfigured() && (API_BASE || location.origin).includes("vercel.app")) {
    startPolling();
    return;
  }
  ws = new WebSocket(liveWsUrl(`/ws/live?deviceId=${encodeURIComponent(selected.id)}&adminToken=${encodeURIComponent(token)}`));
  ws.binaryType = "blob";
  startPolling();
  ws.onopen = () => {};
  ws.onmessage = (event) => {
    lastLiveFrameAt = Date.now();
    renderUserLiveBlob(event.data);
  };
  ws.onerror = () => {
    userFrameEl.alt = "Live websocket unavailable; retrying with frame polling.";
    startPolling();
  };
  ws.onclose = startPolling;
  liveFallbackTimer = setTimeout(() => {
    if (!lastLiveFrameAt) startPolling();
  }, 1200);
}

function openLive(mode = "screen") {
  if (ws) ws.close();
  if (audioWs) audioWs.close();
  if (livePollTimer) clearTimeout(livePollTimer);
  if (liveFallbackTimer) clearTimeout(liveFallbackTimer);
  livePollTimer = null;
  liveFallbackTimer = null;
  lastLiveFrameAt = 0;
  resetUserLiveFrameState();
  if (userFrameEl) userFrameEl.alt = "Trying WebRTC live stream. JPEG fallback starts automatically if it cannot connect.";
  tryUserWebRtcLive(mode, () => startUserJpegLive(mode)).catch(() => startUserJpegLive(mode));
}
if (userStartRecordingEl) userStartRecordingEl.onclick = () => startUserRecording().catch((error) => alert(error.message));
if (userStopRecordingEl) userStopRecordingEl.onclick = () => stopUserRecording().catch((error) => alert(error.message));
if (userSaveRecordingEl) userSaveRecordingEl.onclick = () => saveUserRecording().catch((error) => alert(error.message));

// allow tapping the live frame to send remote touch events (user-initiated)
if (userFrameEl) {
  userFrameEl.addEventListener("pointerdown", (ev) => {
    if (!selected) return;
    const payload = userLiveTapPayload(ev, userFrameEl);
    if (!payload) return;
    ev.preventDefault();
    command("screen.tap", payload).catch((err) => alert(err.message || err));
  });
}

let checkoutPlan = "";

function preferredProvider() {
  const phone = me.phone || "";
  if (phone.startsWith("+234")) return "squad";
  if (/^\+(2|3)/.test(phone)) return "flutterwave";
  return "stripe";
}

function planLabel(plan) {
  return { monthly: "Monthly - $7", six_months: "6 Months - $35", yearly: "1 Year - $60" }[plan] || plan;
}

function openCheckout(plan, provider) {
  checkoutPlan = plan;
  if (paymentMethodEl) paymentMethodEl.value = provider;
  if (checkoutSummaryEl) checkoutSummaryEl.textContent = `${planLabel(plan)} selected. Recommended provider: ${paymentMethodEl.options[paymentMethodEl.selectedIndex].text}.`;
  if (checkoutStatusEl) checkoutStatusEl.textContent = "";
  show("checkout");
}

if (confirmPaymentEl) {
  confirmPaymentEl.onclick = async () => {
    const paymentId = `pay_${crypto.randomUUID()}`;
    const response = await api("/api/payments/init", {
      method: "POST",
      body: JSON.stringify({ plan: checkoutPlan, provider: paymentMethodEl.value, paymentId })
    });
    if (checkoutStatusEl) checkoutStatusEl.textContent = response.checkout.reason || "Payment initialized. Redirect URL will appear here when provider keys are configured.";
  };
}

if (checkoutBackEl) checkoutBackEl.onclick = () => show("subscriptions");
if (homeEl) homeEl.onclick = () => { show("dashboard"); refreshEnrollmentHandoff(); };
if (enrollUserEl) enrollUserEl.addEventListener("click", () => enrollUserDevice().catch((error) => {
  if (enrollHelpEl) enrollHelpEl.textContent = error.message || "Enrollment failed";
  else alert(error.message || "Enrollment failed");
}));
if (openAgentUserEl) openAgentUserEl.addEventListener("click", openInstalledAgent);

document.querySelectorAll("[data-plan]").forEach((button) => {
  button.onclick = async () => {
    const provider = preferredProvider();
    openCheckout(button.dataset.plan, provider);
  };
});

const logoutUser = $("logoutUser");
if (logoutUser) logoutUser.onclick = () => {
  if (ws) ws.close();
  if (livePollTimer) clearTimeout(livePollTimer);
  if (liveFallbackTimer) clearTimeout(liveFallbackTimer);
  try { api("/api/auth/logout", { method: "POST" }).catch(() => {}); } catch {};
  clearSession();
  if (dashboardPage) redirectToAuth();
};

async function initUserApp() {
  if (authPage) {
    initializeUserInterface();
    showAuthFlashMessage();
    if (token && await tryRestoreSession()) {
      redirectToDashboard();
    }
    return;
  }
  if (dashboardPage) {
    if (!token || !(await tryRestoreSession())) {
      redirectToAuth();
      return;
    }
    await loadDashboard();
  }
}

initUserApp();






document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.onclick = () => {
    const input = $(button.dataset.togglePassword);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.classList.toggle("password-visible", !showing);
    button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  };
});

if (userRefreshDeviceInfoEl) {
  userRefreshDeviceInfoEl.addEventListener("click", () => refreshUserDeviceInfo().catch((error) => alert(error.message || error)));
}
