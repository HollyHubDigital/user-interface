let token = localStorage.getItem("cpUserToken") || "";
let me = null;
let selected = null;
let ws = null;
let livePollTimer = null;
let pendingEnrollmentLink = localStorage.getItem("cpPendingEnrollmentLink") || "";
let userCommands = [];

const API_BASE = (window.CP_DEVICE_CONFIG && window.CP_DEVICE_CONFIG.API_BASE_URL) || window.location.origin;
const $ = (id) => document.getElementById(id);
const apiUrl = (path) => `${API_BASE}${path}`;

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
const authPage = Boolean($("auth"));
const dashboardPage = Boolean($("dashboard"));
const authMessageEl = $("authMessage");

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

function clearSession() {
  token = "";
  me = null;
  selected = null;
  localStorage.removeItem("cpUserToken");
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
    localStorage.setItem("cpUserAuthMessage", "Session expired or invalid. Please login again.");
    clearSession();
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
  if (!$("subscriptionStatus") || !me) return;
  const subscription = me.subscription || { plan: "free", expiresAt: null };
  if (subscription.plan === "free" || !subscription.expiresAt) {
    $("subscriptionStatus").textContent = "Plan: Free � screen preview only. Paid features require subscription.";
  } else {
    const active = Date.parse(subscription.expiresAt) > Date.now();
    $("subscriptionStatus").textContent = active ? `Plan: ${subscription.plan}. Active until ${new Date(subscription.expiresAt).toLocaleDateString()}.` : "Subscription expired � choose a plan to restore access.";
  }
  if (selected && selected.subscriptionOverride && selected.subscriptionOverride.active) {
    $("subscriptionStatus").textContent += " This device has admin-granted paid access override.";
  }
}
function refreshEnrollmentHandoff() {
  if (!$("openAgentUser")) return;
  const hasLink = Boolean(pendingEnrollmentLink);
  $("openAgentUser").classList.toggle("hidden", !hasLink);
  $("enrollHelp").textContent = hasLink ? "After installing the APK, tap Open Installed Agent to auto-fill Device ID and Token." : "";
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
      await loadDashboard();
      redirectToDashboard();
    } catch (error) {
      alert(error.message || "Email/Username or Password is not valid");
    }
  };
}

const forgotButton = $("forgot");
if (forgotButton && resetModal) {
  forgotButton.onclick = () => {
    resetModal.showModal();
    resetFormErrors();
  };
}

const saveResetButton = $("saveReset");
if (saveResetButton) {
  saveResetButton.onclick = async () => {
    clearFieldErrors(resetErrors);
    if (!resetLogin || !resetLogin.value.trim()) {
      setFieldError("login", "Enter your email or username.");
      return;
    }
    if (!currentPassword || !currentPassword.value) {
      setFieldError("currentPassword", "Current password is required.");
      return;
    }
    if (!newPassword || !newPassword.value) {
      setFieldError("newPassword", "New password is required.");
      return;
    }
    if (!confirmNewPassword || newPassword.value !== confirmNewPassword.value) {
      setFieldError("confirmNewPassword", "Passwords do not match.");
    return;
  }
  try {
    await api("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ login: resetLogin.value.trim(), currentPassword: currentPassword.value, newPassword: newPassword.value, confirmNewPassword: confirmNewPassword.value })
    });
    alert("Password updated. Please login with your new password.");
    resetModal.close();
  } catch (error) {
    setFieldError("login", error.message || "Password reset failed");
  }
};

async function loadDashboard() {
  const response = await api("/api/user/devices");
  show("dashboard");
  renderSubscriptionStatus();
  userCommands = response.commands || [];
  if (selected) selected = response.devices.find((device) => device.id === selected.id) || null;
  userDevices.innerHTML = "";
  response.devices.forEach((device) => {
    const card = document.createElement("div");
    card.className = "device-card";
    const subtitle = formatDeviceDisplayVersion(device);
    card.innerHTML = `<div class="device-main"><b>${escapeHtml(formatDeviceDisplayName(device))}</b>${subtitle ? `<small>${escapeHtml(subtitle)}</small>` : ""}</div>`;
    const controls = document.createElement("div");
    controls.className = "device-controls";
    const selectBtn = document.createElement("button");
    selectBtn.textContent = "Select";
    selectBtn.onclick = () => { selected = device; loadDashboard(); };
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
    card.onclick = () => { selected = device; loadDashboard(); };
    if (selected && selected.id === device.id) card.style.outline = "2px solid var(--orange)";
    userDevices.appendChild(card);
  });
  renderFiles(response.files || []);
  renderUserCommandResults();
  refreshFeatureGates();
}


function parseOutputJson(output) {
  try { return typeof output === "string" ? JSON.parse(output) : output; } catch { return null; }
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

function friendlyCommandLabel(type) {
  const map = {
    "locate.device": "Locate device",
    "file.list": "Browse files",
    "file.pull": "Export file",
    "screen.control.request": "Start remote screen",
    "camera.stream.request": "Start live camera",
    "lock.device": "Lock device",
    "mobile.data.on": "Turn on mobile data",
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
    if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) return `Location found: ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}${loc.accuracy ? ` (±${Math.round(loc.accuracy)}m)` : ""}`;
  }
  if (command.type === "file.list") {
    const listed = typeof result.output === "object" ? result.output : null;
    if (listed && Array.isArray(listed.files)) return `Listed ${listed.files.length} items.`;
    return "File list requested.";
  }
  if (command.type === "file.pull") return "File export requested.";
  if (command.type === "screen.control.request" || command.type === "camera.stream.request") return result.ok ? "Live session started." : "Live session requested.";
  if (command.type === "lock.device") return result.ok ? "Lock command sent." : "Lock command requested.";
  if (command.type === "mobile.data.on") return result.ok ? "Mobile data toggle requested." : "Mobile data request queued.";
  if (result.output && typeof result.output === "string") return result.output;
  if (result.output && typeof result.output === "object") return `Result: ${Object.keys(result.output).join(", ")}`;
  return result.ok ? "Command completed." : "Command returned result.";
}

function showLocationModal(location) {
  const modal = $("locationModal");
  const text = $("locationText");
  const link = $("locationMapLink");
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
  text.textContent = `${selected.name}: ${location.lat}, ${location.lng}${location.accuracy ? ` ? accuracy ${Math.round(location.accuracy)}m` : ""}`;
  link.href = mapUrl;
  link.textContent = mapUrl;
  modal.showModal();
}

function renderUserCommandResults() {
  if (!selected) return;
  const selectedCommands = userCommands.filter((command) => command.deviceIds.includes(selected.id));
  const latestLocate = [...selectedCommands].reverse().find((command) => command.type === "locate.device" && command.results && command.results[selected.id]);
  const location = latestLocate && parseOutputJson(latestLocate.results[selected.id].output);
  const modal = $("locationModal");
  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lng) && modal.dataset.commandId !== latestLocate.id) {
    modal.dataset.commandId = latestLocate.id;
    showLocationModal(location);
  }
  const latestList = [...selectedCommands].reverse().find((command) => command.type === "file.list" && command.results && command.results[selected.id]);
  const listed = latestList && parseOutputJson(latestList.results[selected.id].output);
  if (listed && Array.isArray(listed.files)) {
    userFiles.innerHTML = "<h2>Device Files</h2>";
    listed.files.forEach((file) => {
      const row = document.createElement("div");
      row.className = "file-row";
      row.innerHTML = `<span><b>${file.name}</b><small>${file.path} ? ${file.directory ? "folder" : `${file.size} bytes`}</small></span>`;
      const button = document.createElement("button");
      button.textContent = file.directory ? "Open" : "Export";
      button.onclick = () => command(file.directory ? "file.list" : "file.pull", { path: file.path, requestedAt: new Date().toISOString() }).then(loadDashboard).catch((error) => alert(error.message));
      row.appendChild(button);
      userFiles.appendChild(row);
    });
  }
}

function userCommandGateMessage(type) {
  if (!selected) return "Select a device first.";
  const capabilities = selected.capabilities || {};
  const actualType = commandTypeForSelected(type);
  if (capabilities.browserEnrollment && !capabilities.nativeAgent && !capabilities.appleMdm) return "Install the Android agent or complete iPhone MDM enrollment first.";
  if (selected.platform === "android") {
    if (actualType === "screen.tap" && !capabilities.accessibility) return "Enable CP DEVICE Accessibility service first.";
    if (actualType === "lock.device" && !capabilities.deviceAdmin && !capabilities.deviceOwner) return "Approve Device Admin or provision Device Owner first.";
    if (actualType === "mobile.data.on" && !capabilities.oemPrivileged) return "Requires OEM/system privileges.";
  }
  if (selected.platform === "ios") {
    if (!capabilities.appleMdm) return "Install the iPhone MDM profile and complete Apple MDM/APNs enrollment first.";
    if (actualType === "locate.device" && !capabilities.supervised) return "Requires supervised iPhone Lost Mode support.";
    if (["file.list", "mobile.data.on"].includes(type)) return "Not supported by public Apple MDM APIs.";
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
function renderFiles(files) {
  userFiles.innerHTML = "<h2>Exported Files</h2>";
  files.forEach((file) => {
    const row = document.createElement("div");
    row.className = "file-row";
    row.innerHTML = `<b>${file.name}</b>`;
    const button = document.createElement("button");
    button.textContent = "Download";
    button.onclick = () => downloadUserFile(file);
    row.appendChild(button);
    userFiles.appendChild(row);
  });
}

async function enroll() {
  const isAndroid = /android/i.test(navigator.userAgent);
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) || (/macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const platform = isAndroid ? "android" : "ios";
  const details = {
    platform,
    name: isIos ? "User iPhone Device" : "User Android Device",
    serial: `WEB-${Date.now()}`,
    ownerConsent: true,
    capabilities: { browserEnrollment: true, mdmProfile: isIos },
    info: { userAgent: navigator.userAgent }
  };
  const enrollment = await api("/api/user/enroll-browser", { method: "POST", body: JSON.stringify(details) });
  const link = document.createElement("a");
  if (isIos) {
    link.href = apiUrl("/api/enrollment/ios-profile");
    link.download = "cp-device-enrollment.mobileconfig";
  } else {
    const params = new URLSearchParams({ serverUrl: API_BASE || location.origin, deviceId: enrollment.deviceId, token: enrollment.token });
    pendingEnrollmentLink = `cpdevice://enroll?${params}`;
    localStorage.cpPendingEnrollmentLink = pendingEnrollmentLink;
    refreshEnrollmentHandoff();
    link.href = apiUrl("/api/enrollment/android-agent");
    link.download = "cp-device-agent.apk";
    alert("APK download started. After installation, return here and tap Open Installed Agent to auto-fill Device ID and Token.");
    setTimeout(() => { location.href = pendingEnrollmentLink; }, 2500);
  }
  document.body.appendChild(link);
  link.click();
  link.remove();
}

const enrollUserButton = $("enrollUser");
const openAgentUserButton = $("openAgentUser");
if (enrollUserButton) enrollUserButton.onclick = () => enroll().catch((error) => alert(error.message || "Enrollment failed"));
if (openAgentUserButton) openAgentUserButton.onclick = () => {
  if (!pendingEnrollmentLink) return alert("Tap Enroll / Download first.");
  location.href = pendingEnrollmentLink;
};
refreshEnrollmentHandoff();

function commandTypeForSelected(type) {
  if (!selected || selected.platform !== "ios") return type;
  if (type === "screen.control.request") return "screen.share.request";
  return type;
}

function unsupportedIosFeature(type) {
  return selected && selected.platform === "ios" && ["file.list", "mobile.data.on"].includes(type);
}

function livePreviewUnavailable() {
  return selected && selected.platform === "ios";
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
      const type = button.dataset.feature;
      if (!["screen.control.request", "screen.share.request"].includes(commandTypeForSelected(type)) && !hasPaidAccessForSelected()) return openSubscriptionPage();
      const result = await command(type, { path: "/sdcard", requestedAt: new Date().toISOString() });
      if (!result) return;
      setTimeout(() => loadDashboard().catch(() => {}), 2500);
      if (type === "screen.control.request" && !livePreviewUnavailable()) openLive();
      if (type === "screen.control.request" && livePreviewUnavailable()) alert("iPhone screen viewing uses Apple-approved screen-share/MDM workflows. The request was queued; live remote control like Android is not available from a web profile alone.");
    } catch (error) {
      alert(error.message || "Command failed");
    }
  };
});

async function fetchUserLiveFrame() {
  if (!selected) return;
  const response = await fetch(apiUrl(`/api/live/${encodeURIComponent(selected.id)}/frame?t=${Date.now()}`), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(response.status === 404 ? "No live frame yet. Open CP DEVICE Agent and tap Start Live Screen." : "Live frame unavailable");
  const blob = await response.blob();
  const previous = userFrame.src;
  userFrame.src = URL.createObjectURL(blob);
  userFrame.alt = "Live device screen streaming";
  if (previous.startsWith("blob:")) URL.revokeObjectURL(previous);
}

function openLive() {
  if (ws) ws.close();
  if (livePollTimer) clearInterval(livePollTimer);
  const poll = () => fetchUserLiveFrame().catch((error) => { userFrame.alt = error.message; });
  poll();
  livePollTimer = setInterval(poll, 1200);
  const wsBase = (API_BASE || location.origin).replace("https://", "wss://").replace("http://", "ws://");
  ws = new WebSocket(`${wsBase}/ws/live?deviceId=${selected.id}&adminToken=${encodeURIComponent(token)}`);
  ws.binaryType = "blob";
  ws.onmessage = (event) => {
    const previous = userFrame.src;
    userFrame.src = URL.createObjectURL(event.data);
    userFrame.alt = "Live device screen streaming";
    if (previous.startsWith("blob:")) URL.revokeObjectURL(previous);
  };
  ws.onerror = () => {};
}

// allow tapping the live frame to send remote touch events (user-initiated)
if (userFrameEl) {
  userFrameEl.addEventListener("click", (ev) => {
    if (!selected) return;
    const rect = userFrameEl.getBoundingClientRect();
    const x = Math.round(((ev.clientX - rect.left) / rect.width) * 720);
    const y = Math.round(((ev.clientY - rect.top) / rect.height) * 1280);
    command("screen.tap", { x, y, requestedAt: new Date().toISOString() }).then(() => setTimeout(loadDashboard, 1000)).catch((err) => alert(err.message || err));
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
if (homeEl) homeEl.onclick = () => show("dashboard");

document.querySelectorAll("[data-plan]").forEach((button) => {
  button.onclick = async () => {
    const provider = preferredProvider();
    openCheckout(button.dataset.plan, provider);
  };
});

const logoutUser = $("logoutUser");
if (logoutUser) logoutUser.onclick = () => {
  if (ws) ws.close();
  if (livePollTimer) clearInterval(livePollTimer);
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
