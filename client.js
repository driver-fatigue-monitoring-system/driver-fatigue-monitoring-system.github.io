const CONFIG = window.DFMS_CONFIG || {};

const storageKeys = {
  driverToken: "dfms-client-driver-token",
  role: "dfms-client-role",
  layout: "dfms-client-layout"
};

const state = {
  driverToken: "",
  driver: null,
  device: null,
  logs: [],
  sessions: [],
  charts: {}
};

const dom = {
  authScreen: document.getElementById("authScreen"),
  appShell: document.getElementById("appShell"),
  driverLoginForm: document.getElementById("driverLoginForm"),
  driverEmailGroup: document.getElementById("driverEmailGroup"),
  driverEmail: document.getElementById("driverEmail"),
  driverNameGroup: document.getElementById("driverNameGroup"),
  driverName: document.getElementById("driverName"),
  driverSerial: document.getElementById("driverSerial"),
  authMessage: document.getElementById("authMessage"),
  demoNotice: document.getElementById("demoNotice"),
  accountMode: document.getElementById("accountMode"),
  pageTitle: document.getElementById("pageTitle"),
  connectionPill: document.getElementById("connectionPill"),
  refreshBtn: document.getElementById("refreshBtn"),
  authDesktopLayoutBtn: document.getElementById("authDesktopLayoutBtn"),
  authMobileLayoutBtn: document.getElementById("authMobileLayoutBtn"),
  desktopLayoutBtn: document.getElementById("desktopLayoutBtn"),
  mobileLayoutBtn: document.getElementById("mobileLayoutBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  actionMenuBtn: document.getElementById("actionMenuBtn"),
  actionMenu: document.getElementById("actionMenu"),
  actionAccountEmail: document.getElementById("actionAccountEmail"),
  actionRefreshBtn: document.getElementById("actionRefreshBtn"),
  actionSignOutBtn: document.getElementById("actionSignOutBtn"),
  mobileMenuBtn: document.getElementById("mobileMenuBtn"),
  mobileActionMenu: document.getElementById("mobileActionMenu"),
  mobileAccountEmail: document.getElementById("mobileAccountEmail"),
  mobileRefreshBtn: document.getElementById("mobileRefreshBtn"),
  mobileSignOutBtn: document.getElementById("mobileSignOutBtn"),
  driverInfoBtn: document.getElementById("driverInfoBtn"),
  mobileDriverInfoBtn: document.getElementById("mobileDriverInfoBtn"),
  driverInfoModal: document.getElementById("driverInfoModal"),
  driverInfoForm: document.getElementById("driverInfoForm"),
  driverInfoEditBtn: document.getElementById("driverInfoEditBtn"),
  driverInfoCloseBtn: document.getElementById("driverInfoCloseBtn"),
  driverInfoCancelBtn: document.getElementById("driverInfoCancelBtn"),
  driverInfoReadOnly: document.getElementById("driverInfoReadOnly"),
  driverInfoEditFields: document.getElementById("driverInfoEditFields"),
  profileSerial: document.getElementById("profileSerial"),
  profileSerialText: document.getElementById("profileSerialText"),
  profileEmail: document.getElementById("profileEmail"),
  profileEmailText: document.getElementById("profileEmailText"),
  profileName: document.getElementById("profileName"),
  profileNameText: document.getElementById("profileNameText"),
  driverInfoMessage: document.getElementById("driverInfoMessage"),
  navButtons: document.querySelectorAll(".nav-btn"),
  views: document.querySelectorAll(".view"),
  statusCard: document.getElementById("statusCard"),
  currentStatus: document.getElementById("currentStatus"),
  latestTimestamp: document.getElementById("latestTimestamp"),
  confidenceScore: document.getElementById("confidenceScore"),
  deviceSerial: document.getElementById("deviceSerial"),
  deviceStatusPill: document.getElementById("deviceStatusPill"),
  framePreview: document.getElementById("framePreview"),
  sessionDrowsy: document.getElementById("sessionDrowsy"),
  sessionYawn: document.getElementById("sessionYawn"),
  sessionTotal: document.getElementById("sessionTotal"),
  sessionDuration: document.getElementById("sessionDuration"),
  todayPieChart: document.getElementById("todayPieChart"),
  dailyChart: document.getElementById("dailyChart"),
  weeklyChart: document.getElementById("weeklyChart"),
  sessionSummary: document.getElementById("sessionSummary"),
  logsTable: document.getElementById("logsTable"),
  downloadCsvBtn: document.getElementById("downloadCsvBtn"),
  downloadExcelBtn: document.getElementById("downloadExcelBtn")
};

function demoMode() {
  return Boolean(CONFIG.DEMO_MODE);
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function normalizeSerial(value) {
  return String(value || "").trim().toUpperCase();
}

function setMessage(element, message, type = "") {
  element.textContent = message || "";
  element.className = `form-message ${type}`.trim();
}

function formatTime(value) {
  if (!value) return "No events yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid time";
  return date.toLocaleString();
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(milliseconds || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function logDateRange(logs = []) {
  const dates = logs.map((log) => validDate(log.timestamp)).filter(Boolean);
  if (!dates.length) return { start: null, end: null };
  const times = dates.map((date) => date.getTime());
  return {
    start: new Date(Math.min(...times)),
    end: new Date(Math.max(...times))
  };
}

function sessionLogs(session) {
  if (!session) return [];
  const sessionId = String(session.id || "");
  const exactLogs = sessionId
    ? state.logs.filter((log) => String(log.session_id || "") === sessionId)
    : [];
  if (exactLogs.length) return exactLogs;

  const start = validDate(session.started_at);
  if (!start) return [];
  const explicitEnd = validDate(session.ended_at);
  const nextStart = state.sessions
    .map((record) => validDate(record.started_at))
    .filter((date) => date && date > start)
    .sort((a, b) => a - b)[0];
  const end = explicitEnd || nextStart || null;
  return state.logs.filter((log) => {
    const timestamp = validDate(log.timestamp);
    if (!timestamp) return false;
    if (timestamp < start) return false;
    if (explicitEnd) return timestamp <= explicitEnd;
    return end ? timestamp < end : true;
  });
}

function sessionDurationText(session, logs = []) {
  const sessionLogRange = logDateRange(logs.length ? logs : sessionLogs(session));
  const start = validDate(session?.started_at) || sessionLogRange.start;
  const end = validDate(session?.ended_at) || sessionLogRange.end;
  if (!start) return "0s";
  if (!end) return "0s";
  return formatDuration(end - start);
}

function todayKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function connectedEmail() {
  return state.driver?.email || normalizeEmail(dom.driverEmail?.value) || "";
}

function connectedName() {
  return state.driver?.name || normalizeName(dom.driverName?.value) || "";
}

function connectedSerial() {
  return state.device?.serial_number || normalizeSerial(dom.driverSerial?.value) || "";
}

function renderMenuAccount() {
  const email = connectedEmail() || "Email not loaded";
  if (dom.actionAccountEmail) dom.actionAccountEmail.textContent = email;
  if (dom.mobileAccountEmail) dom.mobileAccountEmail.textContent = email;
}

function renderDriverInfoValues() {
  const serial = connectedSerial() || "Not connected";
  const email = connectedEmail() || "Email not loaded";
  const name = connectedName() || "Driver";
  if (dom.profileSerial) dom.profileSerial.value = serial;
  if (dom.profileEmail) dom.profileEmail.value = connectedEmail();
  if (dom.profileName) dom.profileName.value = connectedName();
  if (dom.profileSerialText) dom.profileSerialText.textContent = serial;
  if (dom.profileEmailText) dom.profileEmailText.textContent = email;
  if (dom.profileNameText) dom.profileNameText.textContent = name;
}

function setDriverInfoEditMode(editing) {
  dom.driverInfoReadOnly?.classList.toggle("hidden", editing);
  dom.driverInfoEditFields?.classList.toggle("hidden", !editing);
  dom.driverInfoEditBtn?.classList.toggle("hidden", editing);
  if (editing) dom.profileName?.focus();
}

function openDriverInfo() {
  closeMenus();
  renderDriverInfoValues();
  setDriverInfoEditMode(false);
  setMessage(dom.driverInfoMessage, "");
  dom.driverInfoModal.classList.remove("hidden");
  dom.driverInfoEditBtn?.focus();
}

function closeDriverInfo() {
  setDriverInfoEditMode(false);
  dom.driverInfoModal.classList.add("hidden");
}

async function saveDriverInfo(event) {
  event.preventDefault();
  const name = normalizeName(dom.profileName.value);
  const email = normalizeEmail(dom.profileEmail.value);
  if (!name) {
    setMessage(dom.driverInfoMessage, "Enter the driver name.", "error");
    return;
  }
  if (!email) {
    setMessage(dom.driverInfoMessage, "Enter the driver email.", "error");
    return;
  }

  setMessage(dom.driverInfoMessage, "Saving driver info...");
  try {
    if (demoMode()) {
      state.driver = { ...(state.driver || {}), name, email };
    } else {
      const payload = await callFunction("driver-update-profile", { name, email }, state.driverToken);
      state.driverToken = payload.access_token || state.driverToken;
      state.driver = payload.driver || state.driver;
      state.device = payload.device || state.device;
      localStorage.setItem(storageKeys.driverToken, state.driverToken);
    }
    dom.driverEmail.value = email;
    dom.driverName.value = name;
    dom.accountMode.textContent = state.driver?.name ? `Driver dashboard: ${state.driver.name}` : "Driver dashboard";
    renderAll();
    renderDriverInfoValues();
    setDriverInfoEditMode(false);
    setMessage(dom.driverInfoMessage, "Driver info updated.", "success");
  } catch (error) {
    setMessage(dom.driverInfoMessage, error.message, "error");
  }
}

function createSupabaseClient(token = "") {
  return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  });
}

async function callFunction(name, body, token = "") {
  const response = await fetch(`${CONFIG.FUNCTIONS_BASE_URL}/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(CONFIG.SUPABASE_ANON_KEY ? { apikey: CONFIG.SUPABASE_ANON_KEY } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body || {})
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const requestError = new Error(payload.error || payload.message || `Request failed with ${response.status}`);
    requestError.status = response.status;
    requestError.code = payload.code;
    requestError.needsEmail = Boolean(payload.needs_email);
    requestError.needsDriverName = Boolean(payload.needs_driver_name);
    throw requestError;
  }
  return payload;
}

function statusClass(status) {
  if (status === "Drowsy") return "drowsy";
  if (status === "Yawn") return "yawn";
  return "awake";
}

function fatigueLogs(logs = state.logs) {
  return logs.filter((log) => ["Drowsy", "Yawn"].includes(log.event_type || log.status));
}

function todayLogs() {
  const key = todayKey();
  return state.logs.filter((log) => todayKey(new Date(log.timestamp)) === key);
}

function switchView(viewId) {
  dom.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  dom.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  const labels = {
    driverView: "Live Monitoring",
    analyticsView: "Analytics",
    logsView: "Event Logs"
  };
  dom.pageTitle.textContent = labels[viewId] || "Dashboard";
}

function defaultLayoutMode() {
  return window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop";
}

function applyLayoutMode(mode) {
  const selectedMode = mode === "mobile" ? "mobile" : "desktop";
  document.body.dataset.layout = selectedMode;
  [dom.desktopLayoutBtn, dom.authDesktopLayoutBtn].forEach((button) => {
    button?.classList.toggle("active", selectedMode === "desktop");
  });
  [dom.mobileLayoutBtn, dom.authMobileLayoutBtn].forEach((button) => {
    button?.classList.toggle("active", selectedMode === "mobile");
  });
  localStorage.setItem(storageKeys.layout, selectedMode);
}

function closeMobileMenu() {
  dom.mobileActionMenu?.classList.add("hidden");
  dom.mobileMenuBtn?.classList.remove("open");
  dom.mobileMenuBtn?.setAttribute("aria-expanded", "false");
}

function closeActionMenu() {
  dom.actionMenu?.classList.add("hidden");
  dom.actionMenuBtn?.classList.remove("open");
  dom.actionMenuBtn?.setAttribute("aria-expanded", "false");
}

function closeMenus() {
  closeMobileMenu();
  closeActionMenu();
}

function toggleMobileMenu() {
  const shouldOpen = dom.mobileActionMenu?.classList.contains("hidden");
  closeActionMenu();
  dom.mobileActionMenu?.classList.toggle("hidden", !shouldOpen);
  dom.mobileMenuBtn?.classList.toggle("open", Boolean(shouldOpen));
  dom.mobileMenuBtn?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

function toggleActionMenu() {
  const shouldOpen = dom.actionMenu?.classList.contains("hidden");
  closeMobileMenu();
  dom.actionMenu?.classList.toggle("hidden", !shouldOpen);
  dom.actionMenuBtn?.classList.toggle("open", Boolean(shouldOpen));
  dom.actionMenuBtn?.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
}

async function driverLogin(event) {
  event.preventDefault();
  const email = normalizeEmail(dom.driverEmail.value);
  const driverName = normalizeName(dom.driverName.value);
  const serial = normalizeSerial(dom.driverSerial.value);
  const emailIsVisible = !dom.driverEmailGroup.classList.contains("hidden");
  const nameIsVisible = !dom.driverNameGroup.classList.contains("hidden");
  if (!serial) {
    setMessage(dom.authMessage, "Enter the serial number printed on the device.", "error");
    return;
  }
  if (emailIsVisible && !email) {
    setMessage(dom.authMessage, "Enter your email once to activate this device.", "error");
    return;
  }
  if (nameIsVisible && !driverName) {
    setMessage(dom.authMessage, "Enter your name once to activate this device.", "error");
    return;
  }

  setMessage(dom.authMessage, "Opening dashboard...");
  try {
    if (demoMode()) {
      applyDemoData();
      if (driverName) state.driver.name = driverName;
      state.driverToken = "demo-driver-token";
    } else {
      const loginBody = { serial_number: serial };
      if (email) loginBody.email = email;
      if (driverName) loginBody.driver_name = driverName;
      const payload = await callFunction("driver-login", loginBody);
      state.driverToken = payload.access_token;
      state.driver = payload.driver;
      state.device = payload.device;
      localStorage.setItem(storageKeys.driverToken, state.driverToken);
      localStorage.setItem(storageKeys.role, "driver");
      await refreshDriverData();
    }
    showApp();
  } catch (error) {
    if (error.needsEmail || error.code === "DRIVER_PROFILE_REQUIRED") {
      dom.driverEmailGroup.classList.remove("hidden");
      dom.driverEmail.required = true;
      dom.driverNameGroup.classList.remove("hidden");
      dom.driverName.required = true;
      dom.driverEmail.focus();
    } else if (error.needsDriverName || error.code === "DRIVER_NAME_REQUIRED") {
      dom.driverNameGroup.classList.remove("hidden");
      dom.driverName.required = true;
      dom.driverName.focus();
    }
    setMessage(dom.authMessage, error.message, "error");
  }
}

async function refreshDriverData() {
  if (demoMode()) {
    applyDemoData();
    renderAll();
    return;
  }
  const client = createSupabaseClient(state.driverToken);
  const [driverResult, deviceResult, logResult, sessionResult] = await Promise.all([
    client.from("drivers").select("*").limit(1).maybeSingle(),
    client.from("devices").select("*").order("activated_at", { ascending: false }).limit(1).maybeSingle(),
    client.from("detection_logs").select("*").order("timestamp", { ascending: false }).limit(500),
    client.from("driving_sessions").select("*").order("started_at", { ascending: false }).limit(20)
  ]);
  const error = driverResult.error || deviceResult.error || logResult.error || sessionResult.error;
  if (error) throw error;
  state.driver = driverResult.data || state.driver;
  state.device = deviceResult.data || state.device;
  state.logs = logResult.data || [];
  state.sessions = sessionResult.data || [];
  renderAll();
}

function showApp() {
  dom.authScreen.classList.add("hidden");
  dom.appShell.classList.remove("hidden");
  dom.accountMode.textContent = state.driver?.name ? `Driver dashboard: ${state.driver.name}` : "Driver dashboard";
  renderMenuAccount();
  if (dom.connectionPill) {
    dom.connectionPill.textContent = demoMode() ? "Demo mode" : "Connected";
    dom.connectionPill.classList.add("success");
  }
  switchView("driverView");
  renderAll();
}

function signOut() {
  closeMenus();
  localStorage.removeItem(storageKeys.driverToken);
  localStorage.removeItem(storageKeys.role);
  state.driverToken = "";
  state.driver = null;
  state.device = null;
  state.logs = [];
  state.sessions = [];
  dom.authScreen.classList.remove("hidden");
  dom.appShell.classList.add("hidden");
  setMessage(dom.authMessage, "");
}

function renderDriver() {
  const latest = state.logs[0];
  const status = latest?.event_type || "Awake";
  const confidence = latest?.confidence == null ? 0 : Math.round(Number(latest.confidence) * 100);
  dom.statusCard.className = `status-card ${statusClass(status)}`;
  dom.currentStatus.textContent = status;
  dom.latestTimestamp.textContent = latest ? formatTime(latest.timestamp) : "No events yet";
  dom.confidenceScore.textContent = `${confidence}%`;
  dom.deviceSerial.textContent = state.device?.serial_number || "Not connected";
  dom.deviceStatusPill.textContent = state.device?.status || "unknown";
  dom.deviceStatusPill.className = `pill ${state.device?.status === "active" ? "success" : ""}`.trim();

  const currentSession = state.sessions[0] || null;
  const sessionSource = currentSession ? sessionLogs(currentSession) : state.logs;
  const drowsy = sessionSource.filter((log) => log.event_type === "Drowsy").length;
  const yawn = sessionSource.filter((log) => log.event_type === "Yawn").length;
  dom.sessionDrowsy.textContent = drowsy;
  dom.sessionYawn.textContent = yawn;
  dom.sessionTotal.textContent = drowsy + yawn;
  dom.sessionDuration.textContent = sessionDurationText(currentSession, sessionSource);

  if (latest?.frame_url) {
    dom.framePreview.innerHTML = `<img src="${escapeAttribute(latest.frame_url)}" alt="Latest device frame" />`;
  } else {
    dom.framePreview.innerHTML = `
      <div>
        <strong>No frame available</strong>
        <span>Optional image preview appears here when frame_url is sent.</span>
      </div>
    `;
  }
}

function renderLogs() {
  const rows = state.logs.map((log) => {
    const driverName = state.driver?.name || "Driver";
    const serial = state.device?.serial_number || log.device_id || "";
    const eventClass = statusClass(log.event_type);
    const confidence = log.confidence == null ? "" : `${Math.round(Number(log.confidence) * 100)}%`;
    return `
      <tr>
        <td>${escapeHtml(formatTime(log.timestamp))}</td>
        <td>${escapeHtml(driverName)}</td>
        <td>${escapeHtml(serial)}</td>
        <td><span class="event-badge ${eventClass}">${escapeHtml(log.event_type)}</span></td>
        <td>${escapeHtml(confidence)}</td>
        <td>${escapeHtml(log.status || log.event_type)}</td>
      </tr>
    `;
  });
  dom.logsTable.innerHTML = rows.join("") || `<tr><td colspan="6">No device events have been received yet.</td></tr>`;
}

function renderSessionSummary() {
  const rows = state.sessions.map((session) => `
    <div class="summary-item">
      <strong>${escapeHtml(formatTime(session.started_at))}</strong>
      <span>${session.ended_at ? escapeHtml(formatTime(session.ended_at)) : "Active"}</span>
      <span>Duration: ${escapeHtml(sessionDurationText(session, sessionLogs(session)))}</span>
      <span>Drowsy: ${Number(session.total_drowsy_events || 0)}</span>
      <span>Yawn: ${Number(session.total_yawn_events || 0)}</span>
    </div>
  `);
  dom.sessionSummary.innerHTML = rows.join("") || `<div class="summary-item">No driving sessions yet.</div>`;
}

function destroyChart(name) {
  if (state.charts[name]) {
    state.charts[name].destroy();
    state.charts[name] = null;
  }
}

function renderCharts() {
  if (!window.Chart) return;
  const today = fatigueLogs(todayLogs());
  const todayDrowsy = today.filter((log) => log.event_type === "Drowsy").length;
  const todayYawn = today.filter((log) => log.event_type === "Yawn").length;

  destroyChart("todayPie");
  state.charts.todayPie = new Chart(dom.todayPieChart, {
    type: "doughnut",
    data: {
      labels: ["Drowsy", "Yawn"],
      datasets: [{ data: [todayDrowsy, todayYawn], backgroundColor: ["#dc2626", "#f59e0b"], borderWidth: 0 }]
    },
    options: { responsive: true, maintainAspectRatio: false }
  });

  const dailyMap = new Map();
  fatigueLogs().forEach((log) => {
    const key = todayKey(new Date(log.timestamp));
    dailyMap.set(key, (dailyMap.get(key) || 0) + 1);
  });
  const dailyLabels = [...dailyMap.keys()].sort().slice(-10);
  const dailyData = dailyLabels.map((key) => dailyMap.get(key));

  destroyChart("daily");
  state.charts.daily = new Chart(dom.dailyChart, {
    type: "bar",
    data: {
      labels: dailyLabels.length ? dailyLabels : ["No data"],
      datasets: [{ label: "Detections", data: dailyData.length ? dailyData : [0], backgroundColor: "#0f5bd7", borderRadius: 8 }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });

  const weekLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekly = Array(7).fill(0);
  fatigueLogs().forEach((log) => {
    const day = new Date(log.timestamp).getDay();
    const index = day === 0 ? 6 : day - 1;
    weekly[index] += 1;
  });

  destroyChart("weekly");
  state.charts.weekly = new Chart(dom.weeklyChart, {
    type: "line",
    data: {
      labels: weekLabels,
      datasets: [{ label: "Detections", data: weekly, borderColor: "#0f5bd7", backgroundColor: "rgba(15,91,215,0.15)", fill: true, tension: 0.35 }]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
  });
}

function renderAll() {
  renderMenuAccount();
  renderDriver();
  renderLogs();
  renderSessionSummary();
  renderCharts();
}

function csvRows() {
  return [
    ["Time", "Driver", "Device", "Event", "Confidence", "Status"],
    ...state.logs.map((log) => [
      formatTime(log.timestamp),
      state.driver?.name || "Driver",
      state.device?.serial_number || "",
      log.event_type,
      log.confidence,
      log.status || log.event_type
    ])
  ];
}

function downloadCsv() {
  const content = csvRows().map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `dfms_logs_${todayKey()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function downloadExcel() {
  if (!window.XLSX) {
    downloadCsv();
    return;
  }
  const worksheet = XLSX.utils.aoa_to_sheet(csvRows());
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Detection Logs");
  XLSX.writeFile(workbook, `dfms_logs_${todayKey()}.xlsx`);
}

function applyDemoData() {
  const driver = {
    id: "demo-driver",
    name: "Demo Driver",
    email: "driver@example.com",
    created_at: new Date().toISOString()
  };
  const device = {
    id: "demo-device",
    serial_number: "DFMS-8H42K9",
    driver_id: driver.id,
    status: "active",
    activated_at: new Date().toISOString()
  };
  const now = Date.now();
  state.driver = driver;
  state.device = device;
  state.logs = [
    { id: "demo-1", timestamp: new Date(now - 8 * 60 * 1000).toISOString(), event_type: "Yawn", confidence: 0.82, status: "Yawn" },
    { id: "demo-2", timestamp: new Date(now - 35 * 60 * 1000).toISOString(), event_type: "Drowsy", confidence: 0.91, status: "Drowsy" }
  ];
  state.sessions = [];
}

function bindEvents() {
  dom.driverLoginForm.addEventListener("submit", driverLogin);
  dom.signOutBtn.addEventListener("click", signOut);
  dom.refreshBtn.addEventListener("click", refreshDriverData);
  dom.actionMenuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleActionMenu();
  });
  dom.actionRefreshBtn?.addEventListener("click", async () => {
    closeMenus();
    await refreshDriverData();
  });
  dom.actionSignOutBtn?.addEventListener("click", signOut);
  dom.mobileMenuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMobileMenu();
  });
  dom.mobileRefreshBtn?.addEventListener("click", async () => {
    closeMobileMenu();
    await refreshDriverData();
  });
  dom.mobileSignOutBtn?.addEventListener("click", signOut);
  dom.driverInfoBtn?.addEventListener("click", openDriverInfo);
  dom.mobileDriverInfoBtn?.addEventListener("click", openDriverInfo);
  dom.driverInfoForm?.addEventListener("submit", saveDriverInfo);
  dom.driverInfoEditBtn?.addEventListener("click", () => {
    setMessage(dom.driverInfoMessage, "");
    setDriverInfoEditMode(true);
  });
  dom.driverInfoCloseBtn?.addEventListener("click", closeDriverInfo);
  dom.driverInfoCancelBtn?.addEventListener("click", () => {
    renderDriverInfoValues();
    setMessage(dom.driverInfoMessage, "");
    setDriverInfoEditMode(false);
  });
  dom.driverInfoModal?.addEventListener("click", (event) => {
    if (event.target === dom.driverInfoModal) closeDriverInfo();
  });
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".mobile-menu-wrap") && !event.target.closest(".action-menu-wrap")) closeMenus();
  });
  [dom.desktopLayoutBtn, dom.authDesktopLayoutBtn].forEach((button) => {
    button?.addEventListener("click", () => applyLayoutMode("desktop"));
  });
  [dom.mobileLayoutBtn, dom.authMobileLayoutBtn].forEach((button) => {
    button?.addEventListener("click", () => applyLayoutMode("mobile"));
  });
  dom.navButtons.forEach((button) => button.addEventListener("click", () => {
    closeMenus();
    switchView(button.dataset.view);
  }));
  dom.downloadCsvBtn.addEventListener("click", downloadCsv);
  dom.downloadExcelBtn.addEventListener("click", downloadExcel);
}

async function restoreSession() {
  if (demoMode()) return;
  const token = localStorage.getItem(storageKeys.driverToken);
  const role = localStorage.getItem(storageKeys.role);
  if (!token || role !== "driver") return;
  state.driverToken = token;
  try {
    await refreshDriverData();
    showApp();
  } catch {
    signOut();
  }
}

function boot() {
  if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY || !CONFIG.FUNCTIONS_BASE_URL) {
    CONFIG.DEMO_MODE = true;
    dom.demoNotice.textContent = "Demo mode is active because frontend Supabase config is missing.";
  }
  bindEvents();
  applyLayoutMode(localStorage.getItem(storageKeys.layout) || defaultLayoutMode());
  restoreSession();
}

boot();
