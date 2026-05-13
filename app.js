const DEFAULT_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  FUNCTIONS_BASE_URL: "",
  DASHBOARD_LOGIN_URL: window.location.origin + window.location.pathname,
  DEMO_MODE: true,
  POLL_INTERVAL_MS: 8000
};

const CONFIG = { ...DEFAULT_CONFIG, ...(window.DFMS_CONFIG || {}) };
const PLACEHOLDER_RE = /your-|example|project-ref/i;
const EVENT_TYPES = ["Awake", "Drowsy", "Yawn"];
const FATIGUE_TYPES = ["Drowsy", "Yawn"];
const COLORS = {
  Awake: "#16a34a",
  Drowsy: "#dc2626",
  Yawn: "#f59e0b"
};

const storageKeys = {
  driverToken: "dfms.driverToken.v1",
  driverProfile: "dfms.driverProfile.v1",
  role: "dfms.role.v1",
  layout: "dfms.layout.v1"
};

const state = {
  role: "",
  driverToken: "",
  adminToken: "",
  driver: null,
  device: null,
  drivers: [],
  devices: [],
  logs: [],
  sessions: [],
  pollTimer: null,
  charts: {
    today: null,
    daily: null,
    weekly: null
  }
};

const dom = {
  authScreen: document.getElementById("authScreen"),
  appShell: document.getElementById("appShell"),
  driverAuthTab: document.getElementById("driverAuthTab"),
  adminAuthTab: document.getElementById("adminAuthTab"),
  driverLoginForm: document.getElementById("driverLoginForm"),
  adminLoginForm: document.getElementById("adminLoginForm"),
  driverEmail: document.getElementById("driverEmail"),
  driverSerial: document.getElementById("driverSerial"),
  adminEmail: document.getElementById("adminEmail"),
  adminPassword: document.getElementById("adminPassword"),
  authMessage: document.getElementById("authMessage"),
  demoNotice: document.getElementById("demoNotice"),
  accountMode: document.getElementById("accountMode"),
  pageTitle: document.getElementById("pageTitle"),
  connectionPill: document.getElementById("connectionPill"),
  refreshBtn: document.getElementById("refreshBtn"),
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
  adminNavBtn: document.getElementById("adminNavBtn"),
  navButtons: [...document.querySelectorAll(".nav-btn")],
  views: [...document.querySelectorAll(".view")],
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
  downloadExcelBtn: document.getElementById("downloadExcelBtn"),
  activateDeviceForm: document.getElementById("activateDeviceForm"),
  driverNameInput: document.getElementById("driverNameInput"),
  driverEmailInput: document.getElementById("driverEmailInput"),
  serialInput: document.getElementById("serialInput"),
  registerInventoryBtn: document.getElementById("registerInventoryBtn"),
  adminActionMessage: document.getElementById("adminActionMessage"),
  adminDriverCount: document.getElementById("adminDriverCount"),
  adminDeviceCount: document.getElementById("adminDeviceCount"),
  adminTodayCount: document.getElementById("adminTodayCount"),
  adminDeviceSearch: document.getElementById("adminDeviceSearch"),
  adminDeviceSearchCount: document.getElementById("adminDeviceSearchCount"),
  devicesTable: document.getElementById("devicesTable")
};

function isConfigured() {
  return Boolean(
    CONFIG.SUPABASE_URL &&
      CONFIG.SUPABASE_ANON_KEY &&
      CONFIG.FUNCTIONS_BASE_URL &&
      !PLACEHOLDER_RE.test(CONFIG.SUPABASE_URL) &&
      !PLACEHOLDER_RE.test(CONFIG.SUPABASE_ANON_KEY)
  );
}

function demoMode() {
  return CONFIG.DEMO_MODE || !isConfigured();
}

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeSerial(value) {
  return String(value || "").trim().toUpperCase();
}

function setMessage(element, message, type = "") {
  if (!element) return;
  element.textContent = message;
  element.className = `form-message ${type}`.trim();
}

function setAuthMode(mode) {
  const driver = mode === "driver";
  dom.driverAuthTab.classList.toggle("active", driver);
  dom.adminAuthTab.classList.toggle("active", !driver);
  dom.driverLoginForm.classList.toggle("hidden", !driver);
  dom.adminLoginForm.classList.toggle("hidden", driver);
  setMessage(dom.authMessage, "");
}

function defaultLayoutMode() {
  return window.matchMedia("(max-width: 760px)").matches ? "mobile" : "desktop";
}

function applyLayoutMode(mode) {
  const selectedMode = mode === "mobile" ? "mobile" : "desktop";
  document.body.dataset.layout = selectedMode;
  localStorage.setItem(storageKeys.layout, selectedMode);
  dom.desktopLayoutBtn?.classList.toggle("active", selectedMode === "desktop");
  dom.mobileLayoutBtn?.classList.toggle("active", selectedMode === "mobile");
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

function statusClass(status) {
  const text = String(status || "Awake").toLowerCase();
  if (text.includes("drowsy")) return "drowsy";
  if (text.includes("yawn")) return "yawn";
  return "awake";
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

function mondayOf(date = new Date()) {
  const copy = new Date(date);
  const day = copy.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + offset);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysAgo(days, hour = 9, minute = 15) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

function makeDemoData() {
  const driver = {
    id: "5fffe221-5e7e-4855-89b7-6a7a014729a3",
    name: "Omar Hassan",
    email: "driver@example.com",
    created_at: daysAgo(18)
  };
  const device = {
    id: "68156499-5f62-4336-a1b1-aa42cae55498",
    serial_number: "DFMS-8H42K9",
    driver_id: driver.id,
    status: "active",
    activated_at: daysAgo(14),
    drivers: driver
  };
  const logs = [
    ["Awake", 0.97, 0, 8, 12],
    ["Yawn", 0.82, 0, 8, 33],
    ["Drowsy", 0.91, 0, 9, 5],
    ["Yawn", 0.78, 1, 17, 20],
    ["Drowsy", 0.88, 2, 21, 8],
    ["Yawn", 0.8, 3, 10, 40],
    ["Drowsy", 0.94, 4, 22, 12],
    ["Yawn", 0.76, 5, 14, 24],
    ["Drowsy", 0.89, 6, 19, 52]
  ].map(([eventType, confidence, days, hour, minute], index) => ({
    id: crypto.randomUUID ? crypto.randomUUID() : `demo-log-${index}`,
    driver_id: driver.id,
    device_id: device.id,
    timestamp: daysAgo(days, hour, minute),
    event_type: eventType,
    confidence,
    status: eventType,
    frame_url: "",
    session_id: "demo-session-a",
    drivers: driver,
    devices: { serial_number: device.serial_number }
  }));

  return {
    driver,
    drivers: [
      driver,
      {
        id: "f83e728f-2c3e-4f8e-b404-ac590ee77b0b",
        name: "Maya Ali",
        email: "maya@example.com",
        created_at: daysAgo(8)
      }
    ],
    device,
    devices: [
      device,
      {
        id: "e56f4327-1794-4852-a108-33777ed5b154",
        serial_number: "DFMS-4Q91AZ",
        driver_id: "f83e728f-2c3e-4f8e-b404-ac590ee77b0b",
        status: "disabled",
        activated_at: daysAgo(8),
        drivers: { name: "Maya Ali", email: "maya@example.com" }
      }
    ],
    logs,
    sessions: [
      {
        id: "demo-session-a",
        driver_id: driver.id,
        device_id: device.id,
        started_at: daysAgo(0, 8, 0),
        ended_at: null,
        total_drowsy_events: 1,
        total_yawn_events: 1
      },
      {
        id: "demo-session-b",
        driver_id: driver.id,
        device_id: device.id,
        started_at: daysAgo(1, 16, 30),
        ended_at: daysAgo(1, 18, 20),
        total_drowsy_events: 0,
        total_yawn_events: 1
      }
    ]
  };
}

function applyDemoData(role = "driver") {
  const demo = makeDemoData();
  state.driver = demo.driver;
  state.device = demo.device;
  state.drivers = demo.drivers;
  state.devices = demo.devices;
  state.logs = role === "admin" ? demo.logs : demo.logs.filter((log) => log.driver_id === demo.driver.id);
  state.sessions = demo.sessions;
}

function createSupabaseClient(accessToken = "") {
  if (!window.supabase?.createClient) {
    throw new Error("Supabase client library is not loaded.");
  }
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  };
  if (accessToken) {
    options.global = {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    };
  }
  return window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, options);
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
    throw new Error(payload.error || payload.message || `Request failed with ${response.status}`);
  }
  return payload;
}

async function driverLogin(event) {
  event.preventDefault();
  const email = normalizeEmail(dom.driverEmail.value);
  const serial = normalizeSerial(dom.driverSerial.value);
  if (!email || !serial) {
    setMessage(dom.authMessage, "Enter the driver email and permanent device serial number.", "error");
    return;
  }

  setMessage(dom.authMessage, "Opening dashboard...");
  try {
    if (demoMode()) {
      applyDemoData("driver");
      state.role = "driver";
      state.driverToken = "demo-driver-token";
    } else {
      const payload = await callFunction("driver-login", {
        email,
        serial_number: serial
      });
      state.role = "driver";
      state.driverToken = payload.access_token;
      state.driver = payload.driver;
      state.device = payload.device;
      localStorage.setItem(storageKeys.driverToken, state.driverToken);
      localStorage.setItem(storageKeys.driverProfile, JSON.stringify({ driver: state.driver, device: state.device }));
      localStorage.setItem(storageKeys.role, "driver");
      await refreshDriverData();
    }
    showApp("driver");
  } catch (error) {
    setMessage(dom.authMessage, error.message, "error");
  }
}

async function adminLogin(event) {
  event.preventDefault();
  const email = normalizeEmail(dom.adminEmail.value);
  const password = dom.adminPassword.value;
  if (!demoMode() && (!email || !password)) {
    setMessage(dom.authMessage, "Enter the admin email and password.", "error");
    return;
  }

  setMessage(dom.authMessage, "Opening admin console...");
  try {
    state.role = "admin";
    if (demoMode()) {
      applyDemoData("admin");
      state.adminToken = "demo-admin-token";
    } else {
      const client = createSupabaseClient();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.adminToken = data.session.access_token;
      localStorage.setItem(storageKeys.role, "admin");
      await refreshAdminData();
    }
    showApp("admin");
    switchView("adminView");
  } catch (error) {
    setMessage(dom.authMessage, error.message, "error");
  }
}

async function refreshDriverData() {
  if (demoMode()) {
    applyDemoData("driver");
    renderAll();
    return;
  }
  if (!state.driverToken) return;
  const client = createSupabaseClient(state.driverToken);
  const [driverResult, deviceResult, logResult, sessionResult] = await Promise.all([
    client.from("drivers").select("*").limit(1).maybeSingle(),
    client.from("devices").select("*").order("activated_at", { ascending: false }).limit(1).maybeSingle(),
    client
      .from("detection_logs")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(500),
    client
      .from("driving_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20)
  ]);
  const error = driverResult.error || deviceResult.error || logResult.error || sessionResult.error;
  if (error) throw error;
  state.driver = driverResult.data || state.driver;
  state.device = deviceResult.data || state.device;
  state.logs = (logResult.data || []).map((log) => ({
    ...log,
    drivers: state.driver,
    devices: { serial_number: state.device?.serial_number || "" }
  }));
  state.sessions = sessionResult.data || [];
  renderAll();
}

async function refreshAdminData() {
  if (demoMode()) {
    applyDemoData("admin");
    renderAll();
    return;
  }
  const client = createSupabaseClient(state.adminToken);
  const [driversResult, devicesResult, logsResult, sessionsResult] = await Promise.all([
    client.from("drivers").select("*").order("created_at", { ascending: false }),
    client.from("devices").select("*, drivers(name,email)").order("created_at", { ascending: false }),
    client
      .from("detection_logs")
      .select("*, drivers(name,email), devices(serial_number)")
      .order("timestamp", { ascending: false })
      .limit(1000),
    client
      .from("driving_sessions")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(100)
  ]);
  const error = driversResult.error || devicesResult.error || logsResult.error || sessionsResult.error;
  if (error) throw error;
  state.drivers = driversResult.data || [];
  state.devices = devicesResult.data || [];
  state.logs = logsResult.data || [];
  state.sessions = sessionsResult.data || [];
  renderAll();
}

async function refreshData() {
  try {
    if (state.role === "admin") {
      await refreshAdminData();
    } else {
      await refreshDriverData();
    }
    setConnectionText();
  } catch (error) {
    dom.connectionPill.textContent = "Connection error";
    dom.connectionPill.className = "pill danger";
    console.error(error);
  }
}

function showApp(role) {
  state.role = role;
  dom.authScreen.classList.add("hidden");
  dom.appShell.classList.remove("hidden");
  dom.adminNavBtn.classList.toggle("hidden", role !== "admin");
  dom.accountMode.textContent = role === "admin" ? "Administrator console" : "Driver dashboard";
  dom.pageTitle.textContent = role === "admin" ? "Fleet Administration" : "Live Monitoring";
  renderMenuAccount();
  setConnectionText();
  renderAll();
  startPolling();
}

function switchView(viewId) {
  dom.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
  dom.navButtons.forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  const titles = {
    driverView: "Live Monitoring",
    analyticsView: "Analytics",
    logsView: "Event Logs",
    adminView: "Fleet Administration"
  };
  dom.pageTitle.textContent = titles[viewId] || "Dashboard";
}

function setConnectionText() {
  if (demoMode()) {
    dom.connectionPill.textContent = "Demo mode";
    dom.connectionPill.className = "pill warning";
    dom.demoNotice.textContent =
      "Demo mode is active because config.js is missing or DEMO_MODE is true. Copy config.example.js to config.js for Supabase.";
  } else {
    dom.connectionPill.textContent = "Connected to Supabase";
    dom.connectionPill.className = "pill success";
    dom.demoNotice.textContent = "";
  }
}

function latestLog() {
  return state.logs
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];
}

function fatigueLogs(logs = state.logs) {
  return logs.filter((log) => FATIGUE_TYPES.includes(log.event_type));
}

function todayLogs(logs = state.logs) {
  const today = todayKey();
  return logs.filter((log) => todayKey(new Date(log.timestamp)) === today);
}

function currentSessionLogs() {
  const latest = latestLog();
  if (!latest?.session_id) return todayLogs();
  const session = state.sessions.find((record) => record.id === latest.session_id) || null;
  const logs = sessionLogs(session);
  return logs.length ? logs : state.logs.filter((log) => log.session_id === latest.session_id);
}

function currentSessionRecord() {
  const latest = latestLog();
  if (latest?.session_id) {
    return state.sessions.find((session) => session.id === latest.session_id) || null;
  }
  return state.sessions[0] || null;
}

function eventCounts(logs) {
  return logs.reduce(
    (counts, log) => {
      if (log.event_type === "Drowsy") counts.Drowsy += 1;
      if (log.event_type === "Yawn") counts.Yawn += 1;
      if (FATIGUE_TYPES.includes(log.event_type)) counts.total += 1;
      return counts;
    },
    { Drowsy: 0, Yawn: 0, total: 0 }
  );
}

function renderDriverStatus() {
  const latest = latestLog();
  const status = latest?.status || latest?.event_type || "Awake";
  const cls = statusClass(status);
  const confidence = latest?.confidence == null ? 0 : Math.round(Number(latest.confidence) * 100);
  const sessionCounts = eventCounts(currentSessionLogs());

  dom.statusCard.className = `status-card ${cls}`;
  dom.currentStatus.textContent = status;
  dom.latestTimestamp.textContent = formatTime(latest?.timestamp);
  dom.confidenceScore.textContent = latest ? `${confidence}%` : "0%";
  dom.deviceSerial.textContent = state.device?.serial_number || latest?.devices?.serial_number || "Unassigned";
  dom.deviceStatusPill.textContent = state.device?.status || "active";
  dom.deviceStatusPill.className = `pill ${state.device?.status === "disabled" ? "danger" : "success"}`;
  dom.sessionDrowsy.textContent = sessionCounts.Drowsy;
  dom.sessionYawn.textContent = sessionCounts.Yawn;
  dom.sessionTotal.textContent = sessionCounts.total;
  dom.sessionDuration.textContent = sessionDurationText(currentSessionRecord(), currentSessionLogs());

  if (latest?.frame_url) {
    dom.framePreview.innerHTML = `<img alt="Latest device inference frame" src="${escapeAttribute(latest.frame_url)}" />`;
  } else {
    dom.framePreview.innerHTML = `
      <div>
        <strong>No frame available</strong>
        <span>Optional image preview appears here when frame_url is sent.</span>
      </div>
    `;
  }
}

function renderLogsTable() {
  const rows = state.logs
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((log) => {
      const driverName = log.drivers?.name || state.driver?.name || "Driver";
      const serial = log.devices?.serial_number || state.device?.serial_number || log.device_id || "";
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

function adminDeviceSearchText(device) {
  const driver = device.drivers || findDriver(device.driver_id) || {};
  const activatedText = device.activated_at ? formatTime(device.activated_at) : "Not claimed yet";
  return [
    device.id,
    device.serial_number,
    device.status,
    activatedText,
    driver.name,
    driver.email
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function renderAdmin() {
  const todayCount = fatigueLogs(todayLogs()).length;
  dom.adminDriverCount.textContent = state.drivers.length;
  dom.adminDeviceCount.textContent = state.devices.length;
  dom.adminTodayCount.textContent = todayCount;
  const query = String(dom.adminDeviceSearch?.value || "").trim().toLowerCase();
  const devices = query
    ? state.devices.filter((device) => adminDeviceSearchText(device).includes(query))
    : state.devices;
  if (dom.adminDeviceSearchCount) {
    dom.adminDeviceSearchCount.textContent = query
      ? `Showing ${devices.length} of ${state.devices.length}`
      : `${state.devices.length} devices`;
  }
  const rows = devices.map((device) => {
    const driverName = device.drivers?.name || findDriver(device.driver_id)?.name || "Unassigned";
    const driverEmail = device.drivers?.email || findDriver(device.driver_id)?.email || "";
    return `
      <tr>
        <td>${escapeHtml(device.serial_number)}</td>
        <td>${escapeHtml(driverName)}</td>
        <td>${escapeHtml(driverEmail)}</td>
        <td><span class="event-badge ${device.status === "disabled" ? "drowsy" : "awake"}">${escapeHtml(device.status)}</span></td>
        <td>${escapeHtml(device.activated_at ? formatTime(device.activated_at) : "Not claimed yet")}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-device-action="disable" data-device-id="${escapeAttribute(device.id)}">Disable</button>
            <button type="button" data-device-action="reset_token" data-device-id="${escapeAttribute(device.id)}">Reset Token</button>
            <button type="button" data-device-action="activate" data-device-id="${escapeAttribute(device.id)}">Activate</button>
          </div>
        </td>
      </tr>
    `;
  });
  dom.devicesTable.innerHTML = rows.join("") || `<tr><td colspan="6">${query ? "No matching devices found." : "No devices registered yet."}</td></tr>`;
}

function findDriver(driverId) {
  return state.drivers.find((driver) => driver.id === driverId);
}

function destroyChart(name) {
  if (state.charts[name]) {
    state.charts[name].destroy();
    state.charts[name] = null;
  }
}

function renderCharts() {
  if (!window.Chart) return;
  destroyChart("today");
  destroyChart("daily");
  destroyChart("weekly");

  const todayCounts = eventCounts(todayLogs());
  state.charts.today = new Chart(dom.todayPieChart, {
    type: "doughnut",
    data: {
      labels: ["Drowsy", "Yawn"],
      datasets: [
        {
          data: [todayCounts.Drowsy, todayCounts.Yawn],
          backgroundColor: [COLORS.Drowsy, COLORS.Yawn],
          borderWidth: 0
        }
      ]
    },
    options: chartBaseOptions()
  });

  const dailyRows = lastNDays(7).map((date) => {
    const key = todayKey(date);
    const counts = eventCounts(state.logs.filter((log) => todayKey(new Date(log.timestamp)) === key));
    return { label: key.slice(5), ...counts };
  });
  state.charts.daily = makeBarLineChart(dom.dailyChart, dailyRows);

  const monday = mondayOf();
  const weeklyRows = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = todayKey(date);
    const counts = eventCounts(state.logs.filter((log) => todayKey(new Date(log.timestamp)) === key));
    return { label: date.toLocaleDateString(undefined, { weekday: "short" }), ...counts };
  });
  state.charts.weekly = makeBarLineChart(dom.weeklyChart, weeklyRows);
}

function chartBaseOptions() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#10213f",
          font: { weight: "bold" }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { precision: 0, color: "#60728d" },
        grid: { color: "rgba(15, 91, 215, 0.10)" }
      },
      x: {
        ticks: { color: "#60728d" },
        grid: { display: false }
      }
    }
  };
}

function makeBarLineChart(canvas, rows) {
  return new Chart(canvas, {
    data: {
      labels: rows.map((row) => row.label),
      datasets: [
        {
          type: "bar",
          label: "Total",
          data: rows.map((row) => row.total),
          backgroundColor: "rgba(15, 91, 215, 0.26)",
          borderRadius: 8
        },
        {
          type: "line",
          label: "Drowsy",
          data: rows.map((row) => row.Drowsy),
          borderColor: COLORS.Drowsy,
          backgroundColor: COLORS.Drowsy,
          tension: 0.35
        },
        {
          type: "line",
          label: "Yawn",
          data: rows.map((row) => row.Yawn),
          borderColor: COLORS.Yawn,
          backgroundColor: COLORS.Yawn,
          tension: 0.35
        }
      ]
    },
    options: chartBaseOptions()
  });
}

function lastNDays(count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (count - index - 1));
    date.setHours(0, 0, 0, 0);
    return date;
  });
}

function renderAll() {
  renderMenuAccount();
  renderDriverStatus();
  renderLogsTable();
  renderSessionSummary();
  renderAdmin();
  renderCharts();
}

async function activateDevice(event) {
  event.preventDefault();
  const driverName = dom.driverNameInput.value.trim();
  const driverEmail = normalizeEmail(dom.driverEmailInput.value);
  const serial = normalizeSerial(dom.serialInput.value);
  setMessage(dom.adminActionMessage, "Activating device...");
  try {
    if (demoMode()) {
      const id = crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}`;
      const driverId = crypto.randomUUID ? crypto.randomUUID() : `driver-${Date.now()}`;
      const serialNumber = serial || `DFMS-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      state.drivers.unshift({ id: driverId, name: driverName, email: driverEmail, created_at: new Date().toISOString() });
      state.devices.unshift({
        id,
        serial_number: serialNumber,
        driver_id: driverId,
        status: "active",
        activated_at: new Date().toISOString(),
        drivers: { name: driverName, email: driverEmail }
      });
      setMessage(dom.adminActionMessage, `Demo activation created. Serial: ${serialNumber}. Device token: demo-token-${serialNumber}`, "success");
    } else {
      const payload = await callFunction(
        "admin-activate-device",
        {
          driver_name: driverName,
          driver_email: driverEmail,
          serial_number: serial || null,
          dashboard_url: CONFIG.DASHBOARD_LOGIN_URL
        },
        state.adminToken
      );
      setMessage(
        dom.adminActionMessage,
        `Device activated. Serial: ${payload.serial_number}. Device token shown once: ${payload.device_token}`,
        "success"
      );
      await refreshAdminData();
    }
    dom.activateDeviceForm.reset();
    renderAll();
  } catch (error) {
    setMessage(dom.adminActionMessage, error.message, "error");
  }
}

async function registerInventoryDevice() {
  const serial = normalizeSerial(dom.serialInput.value);
  setMessage(dom.adminActionMessage, "Registering printed device...");
  try {
    if (demoMode()) {
      const id = crypto.randomUUID ? crypto.randomUUID() : `device-${Date.now()}`;
      const serialNumber = serial || `DFMS-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
      const deviceToken = `demo-token-${serialNumber}`;
      state.devices.unshift({
        id,
        serial_number: serialNumber,
        driver_id: null,
        status: "registered",
        activated_at: null,
        drivers: null
      });
      setMessage(
        dom.adminActionMessage,
        `Inventory device registered. Print serial: ${serialNumber}. Store token inside device once: ${deviceToken}`,
        "success"
      );
    } else {
      const payload = await callFunction(
        "admin-register-device",
        { serial_number: serial || null },
        state.adminToken
      );
      setMessage(
        dom.adminActionMessage,
        `Inventory device registered. Print serial: ${payload.serial_number}. Store token inside device once: ${payload.device_token}`,
        "success"
      );
      await refreshAdminData();
    }
    dom.serialInput.value = "";
    renderAll();
  } catch (error) {
    setMessage(dom.adminActionMessage, error.message, "error");
  }
}

async function handleDeviceAction(event) {
  const button = event.target.closest("[data-device-action]");
  if (!button) return;
  const action = button.dataset.deviceAction;
  const deviceId = button.dataset.deviceId;
  if (!deviceId) return;

  try {
    if (demoMode()) {
      const device = state.devices.find((item) => item.id === deviceId);
      if (device) {
        device.status = action === "disable" ? "disabled" : "active";
      }
      setMessage(dom.adminActionMessage, `Demo device action completed: ${action}.`, "success");
    } else {
      const payload = await callFunction("admin-device-action", { device_id: deviceId, action }, state.adminToken);
      const suffix = payload.device_token ? ` New token shown once: ${payload.device_token}` : "";
      setMessage(dom.adminActionMessage, `${payload.message || "Device updated."}${suffix}`, "success");
      await refreshAdminData();
    }
    renderAll();
  } catch (error) {
    setMessage(dom.adminActionMessage, error.message, "error");
  }
}

function exportRows() {
  return state.logs
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .map((log) => ({
      timestamp: log.timestamp,
      driver: log.drivers?.name || state.driver?.name || "",
      email: log.drivers?.email || state.driver?.email || "",
      serial_number: log.devices?.serial_number || state.device?.serial_number || "",
      event_type: log.event_type,
      confidence: log.confidence,
      status: log.status,
      frame_url: log.frame_url || "",
      session_id: log.session_id || ""
    }));
}

function downloadCsv() {
  const rows = exportRows();
  const headers = Object.keys(rows[0] || {
    timestamp: "",
    driver: "",
    email: "",
    serial_number: "",
    event_type: "",
    confidence: "",
    status: "",
    frame_url: "",
    session_id: ""
  });
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "driver-fatigue-logs.csv");
}

function downloadExcel() {
  const rows = exportRows();
  if (!window.XLSX) {
    downloadCsv();
    return;
  }
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 20 },
    { wch: 28 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 32 },
    { wch: 24 }
  ];
  XLSX.utils.book_append_sheet(workbook, worksheet, "Detection Logs");
  const data = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  downloadBlob(
    new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
    "driver-fatigue-logs.xlsx"
  );
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  if (state.role === "admin") return normalizeEmail(dom.adminEmail?.value) || "Admin console";
  return (
    state.driver?.email ||
    state.device?.drivers?.email ||
    state.logs.find((log) => log.drivers?.email)?.drivers?.email ||
    normalizeEmail(dom.driverEmail?.value) ||
    ""
  );
}

function connectedName() {
  return state.driver?.name || "Driver";
}

function connectedSerial() {
  return state.device?.serial_number || state.logs.find((log) => log.devices?.serial_number)?.devices?.serial_number || "";
}

function renderMenuAccount() {
  const email = connectedEmail() || "Email not loaded";
  if (dom.actionAccountEmail) dom.actionAccountEmail.textContent = email;
  if (dom.mobileAccountEmail) dom.mobileAccountEmail.textContent = email;
}

function renderDriverInfoValues() {
  const isDriver = state.role === "driver";
  const serial = isDriver ? connectedSerial() || "Not connected" : "Driver Access only";
  const email = isDriver ? connectedEmail() || "Email not loaded" : "Sign in from Driver Access";
  const name = isDriver ? connectedName() || "Driver" : "Driver account";
  if (dom.profileSerial) dom.profileSerial.value = serial;
  if (dom.profileEmail) dom.profileEmail.value = isDriver ? connectedEmail() : "";
  if (dom.profileName) dom.profileName.value = isDriver ? connectedName() : "";
  if (dom.profileSerialText) dom.profileSerialText.textContent = serial;
  if (dom.profileEmailText) dom.profileEmailText.textContent = email;
  if (dom.profileNameText) dom.profileNameText.textContent = name;
}

function setDriverInfoEditMode(editing) {
  const canEdit = state.role === "driver";
  const active = editing && canEdit;
  dom.driverInfoReadOnly?.classList.toggle("hidden", active);
  dom.driverInfoEditFields?.classList.toggle("hidden", !active);
  dom.driverInfoEditBtn?.classList.toggle("hidden", active || !canEdit);
  if (active) dom.profileName?.focus();
}

function openDriverInfo() {
  closeMenus();
  renderDriverInfoValues();
  setDriverInfoEditMode(false);
  setMessage(dom.driverInfoMessage, state.role === "admin" ? "Driver info editing is available from Driver Access." : "");
  dom.driverInfoModal.classList.remove("hidden");
  dom.driverInfoEditBtn?.focus();
}

function closeDriverInfo() {
  setDriverInfoEditMode(false);
  dom.driverInfoModal.classList.add("hidden");
}

async function saveDriverInfo(event) {
  event.preventDefault();
  if (state.role !== "driver") {
    setMessage(dom.driverInfoMessage, "Sign in with Driver Access to edit driver info.", "error");
    return;
  }
  const name = String(dom.profileName.value || "").trim().replace(/\s+/g, " ");
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
      localStorage.setItem(storageKeys.driverProfile, JSON.stringify({ driver: state.driver, device: state.device }));
    }
    dom.driverEmail.value = email;
    dom.accountMode.textContent = state.driver?.name ? `Driver dashboard: ${state.driver.name}` : "Driver dashboard";
    renderAll();
    renderDriverInfoValues();
    setDriverInfoEditMode(false);
    setMessage(dom.driverInfoMessage, "Driver info updated.", "success");
  } catch (error) {
    setMessage(dom.driverInfoMessage, error.message, "error");
  }
}

function startPolling() {
  stopPolling();
  if (!state.role) return;
  state.pollTimer = window.setInterval(refreshData, Number(CONFIG.POLL_INTERVAL_MS) || 8000);
}

function stopPolling() {
  if (state.pollTimer) {
    window.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

async function signOut() {
  closeMenus();
  stopPolling();
  state.role = "";
  state.driverToken = "";
  state.adminToken = "";
  state.driver = null;
  state.device = null;
  state.logs = [];
  state.sessions = [];
  localStorage.removeItem(storageKeys.driverToken);
  localStorage.removeItem(storageKeys.driverProfile);
  localStorage.removeItem(storageKeys.role);
  try {
    if (!demoMode()) await createSupabaseClient().auth.signOut();
  } catch {
    // Ignore sign-out network failures; local session state is already cleared.
  }
  dom.authScreen.classList.remove("hidden");
  dom.appShell.classList.add("hidden");
  setAuthMode("driver");
}

function bindEvents() {
  dom.driverAuthTab.addEventListener("click", () => setAuthMode("driver"));
  dom.adminAuthTab.addEventListener("click", () => setAuthMode("admin"));
  dom.driverLoginForm.addEventListener("submit", driverLogin);
  dom.adminLoginForm.addEventListener("submit", adminLogin);
  dom.signOutBtn.addEventListener("click", signOut);
  dom.refreshBtn.addEventListener("click", refreshData);
  dom.actionMenuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleActionMenu();
  });
  dom.actionRefreshBtn?.addEventListener("click", async () => {
    closeMenus();
    await refreshData();
  });
  dom.actionSignOutBtn?.addEventListener("click", signOut);
  dom.mobileMenuBtn?.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleMobileMenu();
  });
  dom.mobileRefreshBtn?.addEventListener("click", async () => {
    closeMobileMenu();
    await refreshData();
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
  dom.desktopLayoutBtn?.addEventListener("click", () => applyLayoutMode("desktop"));
  dom.mobileLayoutBtn?.addEventListener("click", () => applyLayoutMode("mobile"));
  dom.navButtons.forEach((button) => button.addEventListener("click", () => {
    closeMenus();
    switchView(button.dataset.view);
  }));
  dom.downloadCsvBtn.addEventListener("click", downloadCsv);
  dom.downloadExcelBtn.addEventListener("click", downloadExcel);
  dom.activateDeviceForm.addEventListener("submit", activateDevice);
  dom.registerInventoryBtn?.addEventListener("click", registerInventoryDevice);
  dom.adminDeviceSearch?.addEventListener("input", renderAdmin);
  dom.devicesTable.addEventListener("click", handleDeviceAction);
}

async function restoreSession() {
  if (demoMode()) return;
  const role = localStorage.getItem(storageKeys.role);
  if (role !== "driver") return;
  const token = localStorage.getItem(storageKeys.driverToken);
  const profile = JSON.parse(localStorage.getItem(storageKeys.driverProfile) || "{}");
  if (!token) return;
  state.role = "driver";
  state.driverToken = token;
  state.driver = profile.driver || null;
  state.device = profile.device || null;
  try {
    await refreshDriverData();
    showApp("driver");
  } catch {
    localStorage.removeItem(storageKeys.driverToken);
    localStorage.removeItem(storageKeys.driverProfile);
    localStorage.removeItem(storageKeys.role);
  }
}

async function boot() {
  bindEvents();
  applyLayoutMode(localStorage.getItem(storageKeys.layout) || defaultLayoutMode());
  setAuthMode("driver");
  setConnectionText();
  dom.driverEmail.value = "driver@example.com";
  dom.driverSerial.value = "DFMS-8H42K9";
  await restoreSession();
}

boot();
