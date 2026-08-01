let token = "";
let me = null;
let selected = null;
let ws = null;
let livePollTimer = null;
let pendingEnrollmentLink = localStorage.cpPendingEnrollmentLink || "";

const API_BASE = (window.CP_DEVICE_CONFIG && window.CP_DEVICE_CONFIG.API_BASE_URL) || "";
const $ = (id) => document.getElementById(id);
const apiUrl = (path) => `${API_BASE}${path}`;

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
  ["auth", "dashboard", "subscriptions", "checkout"].forEach((id) => $(id).classList.toggle("hidden", id !== sectionId));
}

function renderSubscriptionStatus() {
  if (!$("subscriptionStatus") || !me) return;
  const subscription = me.subscription || { plan: "free", expiresAt: null };
  if (subscription.plan === "free" || !subscription.expiresAt) {
    $("subscriptionStatus").textContent = "Plan: Free � screen preview only. Paid features require subscription.";
    return;
  }
  const active = Date.parse(subscription.expiresAt) > Date.now();
  $("subscriptionStatus").textContent = active ? `Plan: ${subscription.plan}. Active until ${new Date(subscription.expiresAt).toLocaleDateString()}.` : "Subscription expired � choose a plan to restore access.";
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

function openSubscriptionPage() {
  show("subscriptions");
}

$("switchAuth").onclick = () => {
  const login = $("loginForm");
  const signup = $("signupForm");
  const showSignup = !signup.classList.contains("active");
  signup.classList.toggle("active", showSignup);
  login.classList.toggle("active", !showSignup);
  login.classList.toggle("slide-up", showSignup);
  $("switchAuth").textContent = showSignup ? "Login" : "Signup";
};

$("signupForm").onsubmit = async (event) => {
  event.preventDefault();
  const normalizedPhone = phone.value.replace(/\s+/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(normalizedPhone)) return alert("Phone number must include country code, e.g. +15551234567");
  try {
    await api("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email: email.value, username: username.value, phone: normalizedPhone, password: password.value })
    });
    alert("Signup successful. Please login.");
    $("switchAuth").click();
  } catch (error) {
    alert(error.message || "Signup failed");
  }
};

$("loginForm").onsubmit = async (event) => {
  event.preventDefault();
  try {
    const response = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ login: loginUser.value, password: loginPass.value })
    });
    token = response.token;
    me = response.user;
    localStorage.cpUserToken = token;
    await loadDashboard();
  } catch {
    alert("Email/Username or Password is not valid");
  }
};

$("forgot").onclick = () => resetModal.showModal();
$("saveReset").onclick = async () => {
  try {
    await api("/api/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ login: resetLogin.value, currentPassword: currentPassword.value, newPassword: newPassword.value, confirmNewPassword: confirmNewPassword.value })
    });
    alert("Password updated. Please login with your new password.");
    resetModal.close();
  } catch (error) {
    alert(error.message || "Password reset failed");
  }
};

async function loadDashboard() {
  const response = await api("/api/user/devices");
  show("dashboard");
  renderSubscriptionStatus();
  userDevices.innerHTML = "";
  response.devices.forEach((device) => {
    const card = document.createElement("div");
    card.className = "device-card";
    card.innerHTML = `<b>${device.name}</b><small>${device.platform} � ${device.status}</small>`;
    card.onclick = () => { selected = device; loadDashboard(); };
    if (selected && selected.id === device.id) card.style.outline = "2px solid var(--orange)";
    userDevices.appendChild(card);
  });
  renderFiles(response.files || []);
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

$("enrollUser").onclick = () => enroll().catch((error) => alert(error.message || "Enrollment failed"));
$("openAgentUser").onclick = () => {
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
      if (!["screen.control.request", "screen.share.request"].includes(commandTypeForSelected(type)) && !hasPaidAccess()) return openSubscriptionPage();
      const result = await command(type, { path: "/sdcard", requestedAt: new Date().toISOString() });
      if (!result) return;
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
  paymentMethod.value = provider;
  checkoutSummary.textContent = `${planLabel(plan)} selected. Recommended provider: ${paymentMethod.options[paymentMethod.selectedIndex].text}.`;
  checkoutStatus.textContent = "";
  show("checkout");
}

confirmPayment.onclick = async () => {
  const paymentId = `pay_${crypto.randomUUID()}`;
  const response = await api("/api/payments/init", {
    method: "POST",
    body: JSON.stringify({ plan: checkoutPlan, provider: paymentMethod.value, paymentId })
  });
  checkoutStatus.textContent = response.checkout.reason || "Payment initialized. Redirect URL will appear here when provider keys are configured.";
};

checkoutBack.onclick = () => show("subscriptions");
document.querySelectorAll("[data-plan]").forEach((button) => {
  button.onclick = async () => {
    const provider = preferredProvider();
    openCheckout(button.dataset.plan, provider);
  };
});

home.onclick = () => show("dashboard");

const logoutUser = $("logoutUser");
if (logoutUser) logoutUser.onclick = () => {
  token = "";
  me = null;
  selected = null;
  localStorage.removeItem("cpUserToken");
  sessionStorage.removeItem("cpUserToken");
  if (ws) ws.close();
  if (livePollTimer) clearInterval(livePollTimer);
  show("auth");
};
token = localStorage.cpUserToken || sessionStorage.cpUserToken || "";
if (token) api("/api/auth/me").then((response) => { me = response.user; loadDashboard(); }).catch(() => {});






document.querySelectorAll("[data-toggle-password]").forEach((button) => {
  button.onclick = () => {
    const input = $(button.dataset.togglePassword);
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.classList.toggle("password-visible", !showing);
    button.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  };
});
