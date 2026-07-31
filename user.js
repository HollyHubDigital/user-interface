let token = "";
let me = null;
let selected = null;
let ws = null;

const API_BASE = (window.CP_DEVICE_CONFIG && window.CP_DEVICE_CONFIG.API_BASE_URL) || "";
const $ = (id) => document.getElementById(id);
const apiUrl = (path) => `${API_BASE}${path}`;

async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  if (!response.ok) throw Object.assign(new Error(body.error || "Request failed"), body);
  return body;
}

function show(sectionId) {
  ["auth", "dashboard", "subscriptions", "checkout"].forEach((id) => $(id).classList.toggle("hidden", id !== sectionId));
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
  await api("/api/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email: email.value, username: username.value, phone: phone.value, password: password.value })
  });
  $("switchAuth").click();
};

$("loginForm").onsubmit = async (event) => {
  event.preventDefault();
  const response = await api("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login: loginUser.value, password: loginPass.value })
  });
  token = response.token;
  me = response.user;
  sessionStorage.cpUserToken = token;
  await loadDashboard();
};

$("forgot").onclick = () => resetModal.showModal();
$("saveReset").onclick = async () => {
  await api("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ login: resetLogin.value, currentPassword: currentPassword.value, newPassword: newPassword.value, confirmNewPassword: confirmNewPassword.value })
  });
  resetModal.close();
};

async function loadDashboard() {
  const response = await api("/api/user/devices");
  show("dashboard");
  userDevices.innerHTML = "";
  response.devices.forEach((device) => {
    const card = document.createElement("div");
    card.className = "device-card";
    card.innerHTML = `<b>${device.name}</b><small>${device.platform} · ${device.status}</small>`;
    card.onclick = () => { selected = device; loadDashboard(); };
    if (selected && selected.id === device.id) card.style.outline = "2px solid var(--orange)";
    userDevices.appendChild(card);
  });
  renderFiles(response.files || []);
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
  const details = {
    platform: /android/i.test(navigator.userAgent) ? "android" : "ios",
    name: "User Android Device",
    serial: `WEB-${Date.now()}`,
    ownerConsent: true,
    capabilities: { browserEnrollment: true },
    info: { userAgent: navigator.userAgent }
  };
  const enrollment = await api("/api/user/enroll-browser", { method: "POST", body: JSON.stringify(details) });
  const params = new URLSearchParams({ serverUrl: API_BASE || location.origin, deviceId: enrollment.deviceId, token: enrollment.token });
  const link = document.createElement("a");
  link.href = apiUrl("/api/enrollment/android-agent");
  link.download = "cp-device-agent.apk";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => { location.href = `cpdevice://enroll?${params}`; }, 2500);
}

$("enrollUser").onclick = enroll;

async function command(type, payload = {}) {
  if (!selected) return alert("Select device first");
  try {
    return await api("/api/user/commands", { method: "POST", body: JSON.stringify({ deviceIds: [selected.id], type, payload }) });
  } catch (error) {
    if (error.subscriptionRequired) return openSubscriptionPage();
    throw error;
  }
}

document.querySelectorAll("[data-feature]").forEach((button) => {
  button.onclick = async () => {
    const type = button.dataset.feature;
    if (type !== "screen.control.request" && !hasPaidAccess()) return openSubscriptionPage();
    await command(type, { path: "/sdcard", requestedAt: new Date().toISOString() });
    if (type === "screen.control.request") openLive();
  };
});

function openLive() {
  if (ws) ws.close();
  const wsBase = (API_BASE || location.origin).replace("https://", "wss://").replace("http://", "ws://");
  ws = new WebSocket(`${wsBase}/ws/live?deviceId=${selected.id}&adminToken=${encodeURIComponent(token)}`);
  ws.binaryType = "blob";
  ws.onmessage = (event) => { userFrame.src = URL.createObjectURL(event.data); };
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
token = sessionStorage.cpUserToken || "";
if (token) api("/api/auth/me").then((response) => { me = response.user; loadDashboard(); }).catch(() => {});




