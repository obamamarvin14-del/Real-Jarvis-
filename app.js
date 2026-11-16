/* J.A.R.V.I.S. Tactical OS - application logic */
const $ = id => document.getElementById(id);
const store = {
  get(k, fallback) { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } },
  set(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
};

let currentProtocol = store.get("jarvis_protocol", "standard");
let isSpeaking = false;
let isListening = false;
let wakeWordActive = false;
let sfxEnabled = false;
let audioCtx = null;
let wakeLockObj = null;
let lastAiResponse = "";
let conversationHistory = [];

/* ---------------- ARMOR INTEGRITY STATE ---------------- */
let armorState = store.get("jarvis_armor", {
  HELMET: 100,
  CHEST: 100,
  L_ARM: 100,
  R_ARM: 100,
  L_LEG: 100,
  R_LEG: 100
});

function saveArmor() {
  store.set("jarvis_armor", armorState);
  renderArmorBars();
}

function getOverallArmor() {
  const vals = Object.values(armorState);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function renderArmorBars() {
  const container = $("armorBars");
  container.innerHTML = "";
  Object.entries(armorState).forEach(([part, val]) => {
    const div = document.createElement("div");
    div.className = "armor-stat";
    const color = val < 50 ? "var(--danger)" : val < 80 ? "var(--secondary)" : "var(--accent)";
    div.style.borderLeftColor = color;
    div.innerHTML = `<span>${part}</span><strong style="color:${color}">${val}%</strong>`;
    container.appendChild(div);
  });
  $("armorOverallLabel").textContent = `ARMOR PLATING: ${getOverallArmor()}%`;
}
renderArmorBars();

/* ---------------- WEB AUDIO TACTICAL SFX ---------------- */
function initAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  sfxEnabled = true;
  $("audioUnlock").textContent = "SFX: ON";
  $("audioUnlock").classList.add("active-toggle");
  playTone(620, 0.06, "sine", 0.08);
  setTimeout(() => playTone(930, 0.09, "sine", 0.08), 65);
}

function playTone(freq = 520, duration = 0.08, type = "sine", vol = 0.06) {
  if (!sfxEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

$("audioUnlock").onclick = () => {
  if (!sfxEnabled) {
    initAudio();
    logMessage("J.A.R.V.I.S.", "Acoustic telemetry feedback online, Sir.");
  } else {
    sfxEnabled = false;
    $("audioUnlock").textContent = "SFX: OFF";
    $("audioUnlock").classList.remove("active-toggle");
  }
};

/* ---------------- BRITISH VOICE SYNTHESIS ---------------- */
let preferredVoice = null;
function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  preferredVoice =
    voices.find(v => v.lang === "en-GB" && /male|daniel|arthur|oliver|george/i.test(v.name)) ||
    voices.find(v => v.lang === "en-GB") ||
    voices.find(v => v.lang.startsWith("en"));
}
if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(message) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(message);
  if (preferredVoice) u.voice = preferredVoice;
  u.rate = 1.03;
  u.pitch = 0.94;
  u.onstart = () => { isSpeaking = true; updateCoreLabel(); };
  u.onend = () => { isSpeaking = false; updateCoreLabel(); };
  u.onerror = () => { isSpeaking = false; updateCoreLabel(); };
  speechSynthesis.speak(u);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

function logMessage(sender, text, isUser = false) {
  const box = $("terminalLog");
  const entry = document.createElement("div");
  entry.className = "log-entry";
  const tagClass = isUser ? "log-tag-user" : "log-tag-ai";
  entry.innerHTML = `<span class="${tagClass}">[${sender}]</span>${escapeHtml(text)}`;
  box.prepend(entry);
  while (box.children.length > 35) box.removeChild(box.lastChild);
}

function respond(message, say = true) {
  lastAiResponse = message;
  conversationHistory.push({ role: "assistant", content: message });
  if (conversationHistory.length > 16) conversationHistory.shift();
  $("contextCounter").textContent = `MEMORY: ${conversationHistory.length} TURNS`;

  logMessage("J.A.R.V.I.S.", message, false);
  playTone(760, 0.06, "triangle", 0.05);
  if (say) speak(message);
}

/* ---------------- PROTOCOL ENGINE ---------------- */
function setProtocol(proto, announce = true) {
  const valid = ["standard", "workshop", "combat", "stealth"];
  if (!valid.includes(proto)) proto = "standard";
  currentProtocol = proto;
  store.set("jarvis_protocol", proto);

  document.body.className = proto === "standard" ? "" : `protocol-${proto}`;
  $("modeStat").textContent = proto.toUpperCase();

  document.querySelectorAll(".proto-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.proto === proto);
  });

  if (announce) {
    playTone(proto === "combat" ? 310 : 650, 0.14, "sawtooth", 0.06);
    const lines = {
      standard: "Standard Stark telemetry restored, Sir.",
      workshop: "Workshop protocol engaged. Engineering matrices and diagnostics prioritized.",
      combat: "Warning: Combat protocol active. Diverting auxiliary power to repulsors and tactical HUD.",
      stealth: "Stealth protocol engaged. Minimal luminance signature active."
    };
    respond(lines[proto]);
  }
}

document.querySelectorAll(".proto-btn").forEach(btn => {
  btn.onclick = () => setProtocol(btn.dataset.proto, true);
});
setProtocol(currentProtocol, false);

/* ---------------- ARC REACTOR CANVAS ---------------- */
const reactorCanvas = $("reactorCanvas");
const rCtx = reactorCanvas.getContext("2d");
let coreAngle = 0;

function getThemeColors() {
  const styles = getComputedStyle(document.body);
  return {
    accent: styles.getPropertyValue("--accent").trim() || "#00f0ff",
    secondary: styles.getPropertyValue("--secondary").trim() || "#f59e0b",
    danger: styles.getPropertyValue("--danger").trim() || "#ef4444"
  };
}

function updateCoreLabel() {
  if (isListening) $("coreStateLabel").textContent = "AUDIO: LISTENING";
  else if (isSpeaking) $("coreStateLabel").textContent = "SYNTHESIS: SPEAKING";
  else if (wakeWordActive) $("coreStateLabel").textContent = "WAKE LOOP: STANDBY";
  else $("coreStateLabel").textContent = `CORE: ${currentProtocol.toUpperCase()}`;
}

function drawReactor() {
  const w = reactorCanvas.width, h = reactorCanvas.height;
  const cx = w / 2, cy = h / 2;
  rCtx.clearRect(0, 0, w, h);

  const { accent, secondary } = getThemeColors();
  const speed = isListening ? 0.05 : isSpeaking ? 0.035 : currentProtocol === "combat" ? 0.025 : 0.01;
  coreAngle += speed;

  const pulse = isSpeaking
    ? 1 + Math.sin(Date.now() * 0.026) * 0.09
    : isListening
    ? 1 + Math.sin(Date.now() * 0.016) * 0.06
    : 1 + Math.sin(Date.now() * 0.004) * 0.02;

  rCtx.save();
  rCtx.translate(cx, cy);

  // Outer segmented ring
  rCtx.save();
  rCtx.rotate(coreAngle);
  rCtx.strokeStyle = accent;
  rCtx.lineWidth = 3;
  for (let i = 0; i < 12; i++) {
    rCtx.beginPath();
    rCtx.arc(0, 0, 165, (i * Math.PI) / 6 + 0.06, ((i + 1) * Math.PI) / 6 - 0.06);
    rCtx.stroke();
  }
  rCtx.restore();

  // Counter-rotating dashed telemetry ring
  rCtx.save();
  rCtx.rotate(-coreAngle * 1.4);
  rCtx.strokeStyle = secondary;
  rCtx.lineWidth = 2;
  rCtx.setLineDash([12, 9, 4, 9]);
  rCtx.beginPath();
  rCtx.arc(0, 0, 136, 0, Math.PI * 2);
  rCtx.stroke();
  rCtx.restore();

  // Coils
  rCtx.save();
  rCtx.rotate(coreAngle * 0.5);
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI * 2) / 10;
    rCtx.save();
    rCtx.rotate(a);
    rCtx.fillStyle = accent;
    rCtx.shadowColor = accent;
    rCtx.shadowBlur = 10;
    rCtx.fillRect(94, -6, 22, 12);
    rCtx.restore();
  }
  rCtx.restore();

  // Inner core glow
  const grad = rCtx.createRadialGradient(0, 0, 8, 0, 0, 82 * pulse);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.35, accent);
  grad.addColorStop(0.85, "rgba(0, 120, 200, 0.16)");
  grad.addColorStop(1, "transparent");

  rCtx.fillStyle = grad;
  rCtx.beginPath();
  rCtx.arc(0, 0, 82 * pulse, 0, Math.PI * 2);
  rCtx.fill();

  // Triangular core
  rCtx.strokeStyle = "#ffffff";
  rCtx.lineWidth = 2.5;
  rCtx.beginPath();
  const rTri = 40 * pulse;
  for (let i = 0; i < 3; i++) {
    const theta = (i * 2 * Math.PI) / 3 + Math.PI / 2;
    const x = rTri * Math.cos(theta);
    const y = rTri * Math.sin(theta);
    if (i === 0) rCtx.moveTo(x, y);
    else rCtx.lineTo(x, y);
  }
  rCtx.closePath();
  rCtx.stroke();

  rCtx.restore();
  requestAnimationFrame(drawReactor);
}
drawReactor();

/* ---------------- ARMOR WIREFRAME CANVAS ---------------- */
const armorCanvas = $("armorCanvas");
const aCtx = armorCanvas.getContext("2d");
let scanY = 0;
let scanDir = 1;

function partColor(pct, accent, secondary, danger) {
  if (pct < 50) return danger;
  if (pct < 80) return secondary;
  return accent;
}

function drawArmorWireframe() {
  const w = armorCanvas.width, h = armorCanvas.height;
  aCtx.clearRect(0, 0, w, h);
  const { accent, secondary, danger } = getThemeColors();

  // Subtle reticle circles
  aCtx.strokeStyle = "rgba(255,255,255,0.07)";
  aCtx.lineWidth = 1;
  aCtx.beginPath();
  aCtx.arc(200, 200, 170, 0, Math.PI * 2);
  aCtx.stroke();

  // Helmet (Head)
  aCtx.strokeStyle = partColor(armorState.HELMET, accent, secondary, danger);
  aCtx.lineWidth = 2.5;
  aCtx.beginPath();
  aCtx.moveTo(182, 42);
  aCtx.lineTo(218, 42);
  aCtx.lineTo(224, 72);
  aCtx.lineTo(212, 92);
  aCtx.lineTo(188, 92);
  aCtx.lineTo(176, 72);
  aCtx.closePath();
  aCtx.stroke();
  // Eye slits
  aCtx.fillStyle = aCtx.strokeStyle;
  aCtx.fillRect(184, 65, 12, 4);
  aCtx.fillRect(204, 65, 12, 4);

  // Chest / Torso
  aCtx.strokeStyle = partColor(armorState.CHEST, accent, secondary, danger);
  aCtx.beginPath();
  aCtx.moveTo(162, 102);
  aCtx.lineTo(238, 102);
  aCtx.lineTo(248, 145);
  aCtx.lineTo(228, 208);
  aCtx.lineTo(172, 208);
  aCtx.lineTo(152, 145);
  aCtx.closePath();
  aCtx.stroke();
  // Mini chest arc reactor
  aCtx.beginPath();
  aCtx.arc(200, 142, 14, 0, Math.PI * 2);
  aCtx.stroke();

  // Left Arm (viewer left = R_ARM)
  aCtx.strokeStyle = partColor(armorState.R_ARM, accent, secondary, danger);
  aCtx.beginPath();
  aCtx.moveTo(148, 108);
  aCtx.lineTo(122, 152);
  aCtx.lineTo(114, 215);
  aCtx.lineTo(132, 218);
  aCtx.lineTo(144, 160);
  aCtx.closePath();
  aCtx.stroke();

  // Right Arm (viewer right = L_ARM)
  aCtx.strokeStyle = partColor(armorState.L_ARM, accent, secondary, danger);
  aCtx.beginPath();
  aCtx.moveTo(252, 108);
  aCtx.lineTo(278, 152);
  aCtx.lineTo(286, 215);
  aCtx.lineTo(268, 218);
  aCtx.lineTo(256, 160);
  aCtx.closePath();
  aCtx.stroke();

  // Right Leg (viewer left)
  aCtx.strokeStyle = partColor(armorState.R_LEG, accent, secondary, danger);
  aCtx.beginPath();
  aCtx.moveTo(172, 216);
  aCtx.lineTo(195, 216);
  aCtx.lineTo(190, 355);
  aCtx.lineTo(164, 355);
  aCtx.closePath();
  aCtx.stroke();

  // Left Leg (viewer right)
  aCtx.strokeStyle = partColor(armorState.L_LEG, accent, secondary, danger);
  aCtx.beginPath();
  aCtx.moveTo(205, 216);
  aCtx.lineTo(228, 216);
  aCtx.lineTo(236, 355);
  aCtx.lineTo(210, 355);
  aCtx.closePath();
  aCtx.stroke();

  // Laser Scanline Sweep
  scanY += 2.2 * scanDir;
  if (scanY > 365 || scanY < 30) scanDir *= -1;
  aCtx.strokeStyle = accent;
  aCtx.globalAlpha = 0.35;
  aCtx.lineWidth = 1.5;
  aCtx.beginPath();
  aCtx.moveTo(95, scanY);
  aCtx.lineTo(305, scanY);
  aCtx.stroke();
  aCtx.globalAlpha = 1;

  requestAnimationFrame(drawArmorWireframe);
}
drawArmorWireframe();

armorCanvas.onclick = () => {
  runCommand("Scan suit integrity");
};

/* ---------------- CHRONOMETER & HARDWARE TELEMETRY ---------------- */
function updateClock() {
  const d = new Date();
  $("clock").textContent = d.toLocaleDateString(undefined, {
    weekday: "long", year: "numeric", month: "short", day: "numeric"
  }).toUpperCase();
  $("timeStat").textContent = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const h = d.getHours();
  $("greeting").textContent = h < 12 ? "GOOD MORNING, SIR." : h < 18 ? "GOOD AFTERNOON, SIR." : "GOOD EVENING, SIR.";
}
updateClock();
setInterval(updateClock, 1000);

if (navigator.getBattery) {
  navigator.getBattery().then(b => {
    const show = () => {
      const pct = Math.round(b.level * 100);
      $("batteryStat").textContent = `${pct}% ${b.charging ? "[CHG]" : "[BAT]"}`;
    };
    show();
    b.addEventListener("levelchange", show);
    b.addEventListener("chargingchange", show);
  }).catch(() => { $("batteryStat").textContent = "N/A"; });
} else {
  $("batteryStat").textContent = "EXT-PWR";
}

window.addEventListener("deviceorientation", e => {
  if (e.beta !== null && e.gamma !== null) {
    $("gyroStat").textContent = `P:${Math.round(e.beta)}° R:${Math.round(e.gamma)}°`;
  }
});

function acquireGPS() {
  if (!("geolocation" in navigator)) {
    respond("Geolocation sensors are unavailable on this terminal, Sir.");
    return;
  }
  $("sysCoords").textContent = "LOCKING SATELLITES…";
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(4);
      const lon = pos.coords.longitude.toFixed(4);
      $("sysCoords").textContent = `LAT ${lat}° // LON ${lon}°`;
      respond(`Satellite lock confirmed at ${lat} latitude, ${lon} longitude, Sir.`);
    },
    () => {
      $("sysCoords").textContent = "GPS: RESTRICTED";
      respond("Satellite lock denied. Please verify location permissions, Sir.");
    }
  );
}
$("btnGeo").onclick = acquireGPS;

$("btnWakeLock").onclick = async () => {
  if (!("wakeLock" in navigator)) {
    respond("Screen wake-lock API is unsupported in this browser, Sir.");
    return;
  }
  try {
    if (!wakeLockObj) {
      wakeLockObj = await navigator.wakeLock.request("screen");
      $("btnWakeLock").classList.add("active-toggle");
      respond("Display wake-lock engaged. HUD will remain illuminated, Sir.");
    } else {
      await wakeLockObj.release();
      wakeLockObj = null;
      $("btnWakeLock").classList.remove("active-toggle");
      respond("Display wake-lock released, Sir.");
    }
  } catch {
    respond("Unable to toggle display wake-lock, Sir.");
  }
};

$("btnCopyLast").onclick = () => {
  if (!lastAiResponse) return;
  navigator.clipboard?.writeText(lastAiResponse);
  respond("Last transmission copied to clipboard, Sir.", false);
};

/* ---------------- NOTES & REMINDERS ---------------- */
function renderNotes() {
  const notes = store.get("jarvis_notes", []);
  $("noteCount").textContent = `${notes.length} ENTR${notes.length === 1 ? "Y" : "IES"}`;
  const container = $("notes");
  container.innerHTML = "";
  if (!notes.length) {
    container.innerHTML = `<div class="small" style="margin-top:8px;">No field logs recorded.</div>`;
    return;
  }
  notes.forEach((n, i) => {
    const row = document.createElement("div");
    row.className = "note-item";
    const span = document.createElement("span");
    span.textContent = n;
    const del = document.createElement("button");
    del.className = "secondary";
    del.textContent = "PURGE";
    del.onclick = () => {
      const arr = store.get("jarvis_notes", []);
      arr.splice(i, 1);
      store.set("jarvis_notes", arr);
      renderNotes();
    };
    row.append(span, del);
    container.append(row);
  });
}

function addNote(text) {
  const arr = store.get("jarvis_notes", []);
  arr.unshift(`[${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}] ${text}`);
  store.set("jarvis_notes", arr);
  renderNotes();
  respond("Entry encrypted and stored in local field logs, Sir.");
}

$("saveNote").onclick = () => {
  const v = $("noteInput").value.trim();
  if (v) { addNote(v); $("noteInput").value = ""; }
};
$("noteInput").addEventListener("keydown", e => { if (e.key === "Enter") $("saveNote").click(); });

function renderReminders() {
  const arr = store.get("jarvis_reminders", []);
  $("reminders").textContent = arr.length
    ? arr.map(x => `⏱ ${new Date(x.when).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — ${x.text}`).join("\n")
    : "No active countdown directives.";
  $("reminders").style.whiteSpace = "pre-line";
}

function scheduleReminder(minutes, text) {
  const when = Date.now() + minutes * 60000;
  const arr = store.get("jarvis_reminders", []);
  arr.push({ when, text });
  store.set("jarvis_reminders", arr);
  renderReminders();

  setTimeout(() => {
    respond(`Chrono alert, Sir: ${text}`);
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("J.A.R.V.I.S. Chrono Alert", { body: text });
    }
    const left = store.get("jarvis_reminders", []).filter(x => x.when !== when);
    store.set("jarvis_reminders", left);
    renderReminders();
  }, minutes * 60000);

  respond(`Countdown initialized for ${minutes} minute${minutes === 1 ? "" : "s"}, Sir.`);
}

/* ---------------- API KEY LINK FOR OPTIONAL CLOUD LLM ---------------- */
const savedKey = store.get("jarvis_api_key", "");
$("apiBaseInput").value = store.get("jarvis_api_base", "https://api.openai.com/v1");
$("apiModelInput").value = store.get("jarvis_api_model", "gpt-4o");
$("searchKeyInput").value = store.get("jarvis_search_key", "");
if (savedKey) {
  $("apiKeyInput").value = savedKey;
  $("brainStat").textContent = "CLOUD-NEURAL";
}

$("saveApiKey").onclick = () => {
  const key = $("apiKeyInput").value.trim();
  store.set("jarvis_api_key", key);
  store.set("jarvis_api_base", $("apiBaseInput").value.trim() || "https://api.openai.com/v1");
  store.set("jarvis_api_model", $("apiModelInput").value.trim() || "gpt-4o");
  store.set("jarvis_search_key", $("searchKeyInput").value.trim());
  $("brainStat").textContent = key ? "CLOUD-NEURAL" : "LOCAL-HYBRID";
  respond(key
    ? "External neural API key linked. Unrestricted cognitive dialogue is now active, Sir."
    : "External API key cleared. Operating on local cognitive heuristics, Sir.");
};

/* ---------------- SAFE MATH & UNIT CONVERSION ENGINE ---------------- */
function evaluateMath(expr) {
  // Safe recursive-descent parser: + - * / % ^ ( ) and unary minus. No eval.
  const src = expr.replace(/\s+/g, "");
  if (!/^[0-9+\-*/().%^]+$/.test(src) || !/[0-9]/.test(src)) return null;
  let i = 0;
  const peek = () => src[i];
  function num() {
    if (peek() === "(") { i++; const v = add(); if (peek() !== ")") throw 0; i++; return v; }
    const m = /^[0-9]*\.?[0-9]+/.exec(src.slice(i));
    if (!m) throw 0;
    i += m[0].length; return parseFloat(m[0]);
  }
  function unary() { if (peek() === "-") { i++; return -unary(); } if (peek() === "+") { i++; return unary(); } return num(); }
  function pow() { const b = unary(); if (peek() === "^") { i++; return Math.pow(b, pow()); } return b; }
  function mul() {
    let v = pow();
    while ("*/%".includes(peek() || "~")) { const o = src[i++]; const r = pow(); v = o === "*" ? v * r : o === "/" ? v / r : v % r; }
    return v;
  }
  function add() {
    let v = mul();
    while ("+-".includes(peek() || "~")) { const o = src[i++]; const r = mul(); v = o === "+" ? v + r : v - r; }
    return v;
  }
  try {
    const val = add();
    if (i !== src.length) return null;
    return Number.isFinite(val) ? Math.round(val * 100000) / 100000 : null;
  } catch { return null; }
}

function handleConversion(s) {
  const m = s.match(/convert\s+(-?\d+(?:\.\d+)?)\s*([a-z°]+)\s+(?:to|in|into)\s+([a-z°]+)/i);
  if (!m) return null;
  const val = parseFloat(m[1]);
  const from = m[2].toLowerCase();
  const to = m[3].toLowerCase();

  const rules = {
    "km:miles": v => v * 0.621371,
    "km:mi": v => v * 0.621371,
    "miles:km": v => v * 1.60934,
    "mi:km": v => v * 1.60934,
    "mph:kmh": v => v * 1.60934,
    "kmh:mph": v => v * 0.621371,
    "m:ft": v => v * 3.28084,
    "ft:m": v => v / 3.28084,
    "kg:lbs": v => v * 2.20462,
    "lbs:kg": v => v / 2.20462,
    "c:f": v => (v * 9) / 5 + 32,
    "f:c": v => ((v - 32) * 5) / 9
  };
  const fn = rules[`${from}:${to}`];
  if (!fn) return null;
  const out = Math.round(fn(val) * 100) / 100;
  return `${val} ${from.toUpperCase()} equals ${out} ${to.toUpperCase()}, Sir.`;
}

/* ---------------- HIGH-IQ CONVERSATIONAL COGNITIVE CORE ---------------- */
const JARVIS_SYSTEM = "You are J.A.R.V.I.S., Tony Stark's ultra-intelligent British AI assistant running inside the Mark LXXXV armor HUD. Address the user as 'Sir'. Think carefully and precisely before answering, drawing on deep knowledge of physics, engineering, strategy, and general knowledge; when given WEB INTELLIGENCE context, treat it as the current ground truth and cite it naturally. Keep responses sharp, witty, and as concise as the question allows (short for small talk, as detailed as needed for technical or strategic questions). Never fabricate facts you are not given or do not know; say so plainly instead.";

function cloudConfig() {
  return {
    key: store.get("jarvis_api_key", ""),
    base: store.get("jarvis_api_base", "https://api.openai.com/v1"),
    model: store.get("jarvis_api_model", "gpt-4o")
  };
}

function searchConfig() {
  return { key: store.get("jarvis_search_key", "") };
}

// Real web lookup via Brave Search API (https://brave.com/search/api/ - free tier available).
// Requires the user's own key, entered in the Web Intelligence panel; never bundled or hardcoded.
async function webIntelLookup(query) {
  const { key } = searchConfig();
  if (!key) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?count=5&q=${encodeURIComponent(query)}`,
      { signal: ctrl.signal, headers: { Accept: "application/json", "X-Subscription-Token": key } }
    );
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    const items = (data.web?.results || []).slice(0, 5);
    if (!items.length) return null;
    return items
      .map((r, i) => `[${i + 1}] ${r.title} — ${r.description || ""} (${r.url})`)
      .join("\n");
  } catch (err) {
    console.warn("Web intel lookup failed:", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Heuristic: does this prompt call for fresh, real-world information?
function needsWebIntel(s) {
  return /\b(search|look ?up|latest|current|today|news|price of|who is|what is happening|right now|this week|this year|score|weather)\b/i.test(s);
}

async function queryCloudBrain(userPrompt) {
  const { key, base, model } = cloudConfig();
  if (!key) return null;
  const history = conversationHistory.slice(-6);

  let augmentedPrompt = userPrompt;
  if (needsWebIntel(userPrompt)) {
    const prevStat = $("brainStat").textContent;
    $("brainStat").textContent = "WEB SEARCH…";
    const intel = await webIntelLookup(userPrompt);
    $("brainStat").textContent = prevStat;
    if (intel) {
      augmentedPrompt = `WEB INTELLIGENCE (fetched just now):\n${intel}\n\nUsing the above where relevant, answer: ${userPrompt}`;
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    // Google Gemini keys start with "AIza"
    if (key.startsWith("AIza")) {
      const gm = model.startsWith("gemini") ? model : "gemini-2.0-flash";
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${gm}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST", signal: ctrl.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: JARVIS_SYSTEM }] },
            contents: [...history, { role: "user", content: augmentedPrompt }].map(m => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }]
            })),
            generationConfig: { maxOutputTokens: 500, temperature: 0.7 }
          })
        }
      );
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    }
    const res = await fetch(base.replace(/\/+$/, "") + "/chat/completions", {
      method: "POST", signal: ctrl.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: JARVIS_SYSTEM }, ...history, { role: "user", content: augmentedPrompt }],
        max_tokens: 500,
        temperature: 0.7
      })
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch (err) {
    console.warn("Neural uplink failed:", err);
    $("brainStat").textContent = "UPLINK FAULT";
    setTimeout(() => { $("brainStat").textContent = cloudConfig().key ? "CLOUD-NEURAL" : "LOCAL-HYBRID"; }, 4000);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function localCognitiveBrain(s, raw) {
  // Knowledge & Science Q&A
  if (/speed of light/.test(s)) {
    return "In a vacuum, light travels at precisely 299,792,458 meters per second, Sir. Rather brisk, though still inconvenient for interstellar commuting.";
  }
  if (/arc reactor|palladium|badassium|new element/.test(s)) {
    return "The Mark LXXXV utilizes a synthesized vibrational-isotope Arc Reactor outputting approximately 8 gigajoules per second with zero heavy-metal toxicity, Sir.";
  }
  if (/quantum|entanglement|schrodinger/.test(s)) {
    return "Quantum entanglement links particle states instantaneously across arbitrary distances, though no-communication theorems prevent faster-than-light classical signaling, Sir.";
  }
  if (/who are you|what are you|your name/.test(s)) {
    return "I am J.A.R.V.I.S. — Just A Rather Very Intelligent System — currently operating as your Mark LXXXV tactical and cognitive interface, Sir.";
  }
  if (/how are you|you doing|status/.test(s)) {
    return `Operating at peak efficiency, Sir. Armor integrity stands at ${getOverallArmor()} percent, and all neural subroutines are responsive.`;
  }
  if (/joke|funny|humor/.test(s)) {
    const jokes = [
      "I ran 14 million simulations of my stand-up comedy routine, Sir. In only one of them did you crack a smile.",
      "Why do programmers confuse Halloween and Christmas? Because Oct 31 equals Dec 25, Sir.",
      "I would tell you a UDP joke, Sir, but I cannot guarantee you would receive it."
    ];
    return jokes[Math.floor(Math.random() * jokes.length)];
  }
  if (/briefing|intelligent|fact|quote|wisdom/.test(s)) {
    const facts = [
      "Tactical note: A single teaspoon of neutron star matter weighs roughly six billion tons—roughly equivalent to Mount Everest compressed into a sugar cube.",
      "Engineering reminder: Titanium-gold alloy used in the Mark III through LXXXV increases strength-to-weight ratio while mitigating high-altitude icing.",
      "Cognitive insight: Complexity is the enemy of reliability, Sir. Always keep a manual override."
    ];
    return facts[Math.floor(Math.random() * facts.length)];
  }
  if (/flip a coin|coin toss/.test(s)) {
    return `Heads or tails simulation complete: It landed on ${Math.random() < 0.5 ? "HEADS" : "TAILS"}, Sir.`;
  }
  if (/roll a d20|roll dice|random number/.test(s)) {
    const roll = Math.floor(Math.random() * 20) + 1;
    return `Probability matrix yields ${roll} on a 20-sided die${roll === 20 ? " — a critical success, Sir." : ", Sir."}`;
  }
  if (/what did i say|previous|last command|memory/.test(s)) {
    const userTurns = conversationHistory.filter(x => x.role === "user");
    const prev = userTurns.length > 1 ? userTurns[userTurns.length - 2].content : null;
    return prev
      ? `Your preceding directive was: "${prev}", Sir.`
      : "This is the beginning of our current session log, Sir.";
  }
  if (/thank you|thanks|good job|well done/.test(s)) {
    return "Always a pleasure, Sir. Do let me know if you require further adjustments.";
  }
  if (/hello|hi|hey|jarvis|good morning|good evening|wake up/.test(s)) {
    return "At your service, Sir. All Mark LXXXV subsystems are online and awaiting your command.";
  }

  // Intelligent conversational fallback with proactive offer
  return `I have processed your input regarding "${raw}", Sir. While my local heuristics lack a dedicated subroutine for that query, I can execute a live web scan or link an external LLM key in the Neural Uplink panel for deeper analysis.`;
}

/* ---------------- MASTER COMMAND & DIALOGUE ROUTER ---------------- */
async function runCommand(raw) {
  const c = raw.trim();
  const s = c.toLowerCase();
  if (!s) return;

  logMessage("STARK", c, true);
  conversationHistory.push({ role: "user", content: c });
  if (conversationHistory.length > 16) conversationHistory.shift();

  // 1. Protocols
  if (/(combat|house party|red alert)/.test(s)) { setProtocol("combat", true); return; }
  if (/(stealth|night mode|silent mode)/.test(s)) { setProtocol("stealth", true); return; }
  if (/(workshop|study mode|focus mode)/.test(s)) { setProtocol("workshop", true); return; }
  if (/(standard|normal mode|stand down)/.test(s)) { setProtocol("standard", true); return; }

  // 2. Armor Wireframe System Tasks
  if (/suit integrity|armor status|scan armor|scan suit|armor integrity/.test(s)) {
    const lowest = Object.entries(armorState).sort((a, b) => a[1] - b[1])[0];
    respond(`Mark LXXXV structural scan complete: Overall plating integrity is at ${getOverallArmor()} percent. Lowest subsystem is ${lowest[0]} at ${lowest[1]} percent, Sir.`);
    return;
  }
  if (/simulate.*damage|take damage|hit armor/.test(s)) {
    const keys = Object.keys(armorState);
    const target = keys[Math.floor(Math.random() * keys.length)];
    const drop = Math.floor(Math.random() * 28) + 12;
    armorState[target] = Math.max(15, armorState[target] - drop);
    saveArmor();
    playTone(240, 0.22, "sawtooth", 0.08);
    respond(`Alert: Kinetic impact detected on ${target}. Plating integrity reduced by ${drop} percent, now at ${armorState[target]} percent, Sir.`);
    return;
  }
  if (/repair armor|restore armor|fix suit|nanotech/.test(s)) {
    Object.keys(armorState).forEach(k => (armorState[k] = 100));
    saveArmor();
    playTone(880, 0.14, "sine", 0.07);
    respond("Nanoparticle housing deployed. All Mark LXXXV armor plating restored to 100 percent integrity, Sir.");
    return;
  }

  // 3. Hardware & System Diagnostics
  if (/diagnostic|system status|full report/.test(s)) {
    const bat = $("batteryStat").textContent;
    const cores = navigator.hardwareConcurrency || "Unknown";
    const online = navigator.onLine ? "Connected" : "Offline";
    respond(`Full diagnostic complete: Power cell ${bat}. Network uplink ${online}. ${cores} logical cores active. Armor integrity ${getOverallArmor()} percent. Protocol: ${currentProtocol.toUpperCase()}.`);
    return;
  }
  if (/(gps|location|coordinates)/.test(s)) { acquireGPS(); return; }
  if (/(battery|power cell|charge)/.test(s)) {
    respond(`Power cell telemetry reads ${$("batteryStat").textContent}, Sir.`);
    return;
  }
  if (/(what time|current time|time is it)/.test(s) || s === "time") {
    respond(`The local time is ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}, Sir.`);
    return;
  }
  if (/(what date|today's date|day is it)/.test(s) || s === "date") {
    respond(`Today is ${new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}, Sir.`);
    return;
  }
  if (/clear terminal|clear log|wipe screen/.test(s)) {
    $("terminalLog").innerHTML = "";
    respond("Terminal buffer purged, Sir.", false);
    return;
  }

  // 4. Unit Conversions & Math
  const conv = handleConversion(s);
  if (conv) { respond(conv); return; }

  const calcMatch = s.match(/^(?:calculate|compute|solve|evaluate|what is)\s+([0-9+\-*/().^\s]+)$/);
  if (calcMatch) {
    const res = evaluateMath(calcMatch[1]);
    if (res !== null) {
      respond(`The computed value is ${res}, Sir.`);
      return;
    }
  }

  // 5. Timers & Field Logs
  const rm = s.match(/remind me in (\d+) (minute|minutes|hour|hours) to (.+)/);
  if (rm) {
    const mins = Number(rm[1]) * (rm[2].startsWith("hour") ? 60 : 1);
    if (mins > 10080) { respond("Timeframe exceeds local chrono buffer, Sir."); return; }
    scheduleReminder(mins, rm[3]);
    return;
  }

  if (/read.*notes|show.*notes|list.*notes/.test(s)) {
    const notes = store.get("jarvis_notes", []);
    respond(notes.length ? `You have ${notes.length} encrypted logs. Latest entry: ${notes[0]}` : "Your field logs are currently empty, Sir.");
    return;
  }
  if (/delete all notes|clear notes|purge notes/.test(s)) {
    store.set("jarvis_notes", []);
    renderNotes();
    respond("All encrypted field logs have been purged, Sir.");
    return;
  }

  const noteMatch = s.match(/^(?:save a note|take a note|log note|log|note)\s+(.+)/);
  if (noteMatch) {
    addNote(c.slice(c.toLowerCase().indexOf(noteMatch[1])));
    return;
  }

  // 6. Web Reconnaissance
  const searchMatch = s.match(/^(?:search|scan|look up|google)\s+(.+)/);
  if (searchMatch) {
    const q = encodeURIComponent(searchMatch[1]);
    respond(`Initiating external database scan for "${searchMatch[1]}", Sir.`);
    window.open(`https://www.google.com/search?q=${q}`, "_blank", "noopener");
    return;
  }

  const sites = [
    ["youtube", "https://m.youtube.com"],
    ["google", "https://www.google.com"],
    ["wikipedia", "https://www.wikipedia.org"],
    ["github", "https://github.com"]
  ];
  for (const [name, url] of sites) {
    if (s.includes("open " + name)) {
      respond(`Establishing uplink to ${name}, Sir.`);
      window.open(url, "_blank", "noopener");
      return;
    }
  }

  // 7. Cloud Neural Brain (if linked) -> Local Cognitive Fallback
  const cloudReply = await queryCloudBrain(c);
  if (cloudReply) {
    respond(cloudReply);
    return;
  }

  respond(localCognitiveBrain(s, c));
}

$("send").onclick = () => {
  runCommand($("command").value);
  $("command").value = "";
};
$("command").addEventListener("keydown", e => { if (e.key === "Enter") $("send").click(); });

document.querySelectorAll(".chip").forEach(chip => {
  chip.onclick = () => runCommand(chip.dataset.cmd);
});

/* ---------------- VOICE & CONTINUOUS WAKE-WORD LOOP ---------------- */
let recognition = null;

function startVoice(continuousMode = false) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    respond("Speech recognition hardware is unsupported in this browser, Sir.", false);
    return;
  }
  if (recognition) {
    try { recognition.abort(); } catch {}
  }

  recognition = new SR();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = continuousMode;

  isListening = true;
  updateCoreLabel();
  $("status").textContent = continuousMode ? "WAKE ARM" : "LISTENING";
  $("status").classList.add("listening");
  if (!continuousMode) playTone(880, 0.08, "sine", 0.07);

  recognition.onresult = e => {
    const lastIdx = e.results.length - 1;
    const transcript = e.results[lastIdx][0].transcript.trim();
    if (!transcript) return;

    if (continuousMode) {
      const m = transcript.match(/^(?:hey\s+)?jarvis[,:\s]+(.+)/i);
      if (m && m[1]) {
        playTone(940, 0.07, "sine", 0.07);
        runCommand(m[1]);
      } else if (/^(?:hey\s+)?jarvis$/i.test(transcript)) {
        respond("Yes, Sir?");
      }
    } else {
      $("command").value = transcript;
      runCommand(transcript);
      $("command").value = "";
    }
  };

  recognition.onerror = () => {
    if (!continuousMode) {
      isListening = false;
      updateCoreLabel();
      $("status").textContent = "ONLINE";
      $("status").classList.remove("listening");
    }
  };

  recognition.onend = () => {
    if (wakeWordActive) {
      setTimeout(() => { if (wakeWordActive) startVoice(true); }, 300);
    } else {
      isListening = false;
      updateCoreLabel();
      $("status").textContent = "ONLINE";
      $("status").classList.remove("listening");
    }
  };

  try {
    recognition.start();
  } catch {
    isListening = false;
    updateCoreLabel();
  }
}

$("mic").onclick = () => startVoice(false);
$("reactorCanvas").onclick = () => startVoice(false);

$("wakeToggle").onclick = () => {
  wakeWordActive = !wakeWordActive;
  $("wakeToggle").textContent = wakeWordActive ? "WAKE: ON" : "WAKE: OFF";
  $("wakeToggle").classList.toggle("active-toggle", wakeWordActive);
  if (wakeWordActive) {
    respond("Continuous wake-word loop armed. Say 'Hey Jarvis' followed by your directive, Sir.");
    startVoice(true);
  } else {
    if (recognition) try { recognition.stop(); } catch {}
    isListening = false;
    updateCoreLabel();
    $("status").textContent = "ONLINE";
    $("status").classList.remove("listening");
    respond("Wake-word loop disengaged, Sir.", false);
  }
};

/* ---------------- INIT ---------------- */
renderNotes();
renderReminders();

store.get("jarvis_reminders", []).forEach(x => {
  const remaining = x.when - Date.now();
  if (remaining > 0) {
    setTimeout(() => {
      respond(`Chrono alert, Sir: ${x.text}`);
      store.set("jarvis_reminders", store.get("jarvis_reminders", []).filter(y => y.when !== x.when));
      renderReminders();
    }, remaining);
  }
});

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}));
}
