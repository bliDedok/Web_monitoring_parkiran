import { SLOT_POS, SLOT_ORI } from "./slots.js";

// Firebase (Realtime Database)
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
import { getDatabase, ref, onValue, update, set } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-database.js";

/** =========================
 *  KONFIG FIREBASE (punyamu)
 *  ========================= */
const firebaseConfig = {
  apiKey: "AIzaSyC2tj9-H7O785TvoL8UAgJd7Kd-yVh6VsQ",
  authDomain: "smart-parking-undiknas.firebaseapp.com",
  databaseURL: "https://smart-parking-undiknas-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "smart-parking-undiknas",
  storageBucket: "smart-parking-undiknas.firebasestorage.app",
  messagingSenderId: "302708781691",
  appId: "1:302708781691:web:c99afcc7a4d841b3f4a8de",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/** =========================
 *  DOM
 *  ========================= */
const mapNormal = document.getElementById("parkMap");
const mapZoom = document.getElementById("parkMapZoom");

const cUnknown = document.getElementById("cUnknown");
const cFree = document.getElementById("cFree");
const cFull = document.getElementById("cFull");

const utilPct = document.getElementById("utilPct");
const utilBar = document.getElementById("utilBar");

const selId = document.getElementById("selId");
const selStatus = document.getElementById("selStatus");

const resetBtn = document.getElementById("resetBtn");
const demoBtn = document.getElementById("demoBtn");

const zoomBtn = document.getElementById("zoomBtn");
const zoomFab = document.getElementById("zoomFab");

const zoomModalEl = document.getElementById("zoomModal");
const zoomModal = zoomModalEl ? new bootstrap.Modal(zoomModalEl) : null;

const zOut = document.getElementById("zOut");
const zIn = document.getElementById("zIn");
const zReset = document.getElementById("zReset");
const zRange = document.getElementById("zRange");
const zPct = document.getElementById("zPct");

// Tambahan (admin.html versi baru)
const connEl = document.getElementById("connStatus");
const lastEl = document.getElementById("lastUpdate");
const demoModeEl = document.getElementById("demoMode");
const adminHint = document.getElementById("adminHint");

let zoomScale = 1;

/** =========================
 *  ONLINE/OFFLINE STATE
 *  ========================= */
let lastTsMs = 0;
let deviceOnline = false;
const OFFLINE_AFTER_SEC = 12;

function normalizeTsToMs(ts) {
  if (ts == null) return 0;
  const n = Number(ts);
  if (!Number.isFinite(n)) return 0;
  return n < 1e12 ? n * 1000 : n; // seconds -> ms
}

function demoAllowed() {
  // kalau device ONLINE dan demoMode OFF => blok demo
  const demoEnabled = demoModeEl ? demoModeEl.checked : true;
  return !(deviceOnline && !demoEnabled);
}

function setDemoControlsDisabled(disabled) {
  resetBtn?.toggleAttribute("disabled", disabled);
  demoBtn?.toggleAttribute("disabled", disabled);

  // teks bantuan
  if (!adminHint) return;
  if (disabled) {
    adminHint.textContent =
      "Perangkat ONLINE: Demo Mode dimatikan. Admin dalam mode read-only agar data sensor tidak tertimpa.";
  } else {
    adminHint.textContent =
      deviceOnline
        ? "Perangkat ONLINE: Demo Mode aktif (hati-hati, bisa menimpa data sensor)."
        : "Perangkat OFFLINE: kamu bisa pakai Demo Mode untuk simulasi.";
  }
}

/** =========================
 *  DATA STATUS (dari Firebase)
 *  ========================= */
let statusBySlot = {}; // {id:"unknown/free/full", ...}

function normalizeStatus(v) {
  return v === "free" || v === "full" ? v : "unknown";
}
function nextStatus(cur) {
  if (cur === "unknown") return "free";
  if (cur === "free") return "full";
  return "unknown";
}
function getStatus(id) {
  return statusBySlot[id] ?? "unknown";
}

function selectSlot(id) {
  selId.textContent = id ?? "-";
  selStatus.textContent = id ? getStatus(id) : "-";
}

function applyStatusToEl(el) {
  const id = el.dataset.id;
  const st = getStatus(id);

  el.classList.remove("free", "full");
  if (st === "free") el.classList.add("free");
  else if (st === "full") el.classList.add("full");

  const stEl = el.querySelector(".st");
  if (stEl) stEl.textContent = st;

  el.title = `${id}: ${st}`;
}

function updateCountsAndUtil() {
  const counts = { unknown: 0, free: 0, full: 0 };
  for (const id of Object.keys(SLOT_POS)) counts[getStatus(id)]++;

  cUnknown.textContent = counts.unknown;
  cFree.textContent = counts.free;
  cFull.textContent = counts.full;

  const detected = counts.free + counts.full;
  const pct = detected === 0 ? 0 : Math.round((counts.full / detected) * 100);

  utilPct.textContent = pct;
  utilBar.style.width = pct + "%";
}

function renderSlots(targetEl) {
  targetEl.querySelectorAll(".slot").forEach((s) => s.remove());

  for (const [id, p] of Object.entries(SLOT_POS)) {
    const el = document.createElement("div");
    el.className = "slot";
    el.dataset.id = id;

    if (SLOT_ORI[id] === "h") el.classList.add("h");

    el.style.left = p.left + "%";
    el.style.top = p.top + "%";
    el.style.width = p.width + "%";
    el.style.height = p.height + "%";

    el.innerHTML = `
      <div class="label">
        <div class="id">${id}</div>
        <span class="st">unknown</span>
      </div>
    `;

    // Klik slot => toggle status => tulis ke Firebase (simulasi)
    el.addEventListener("click", async (ev) => {
      ev.stopPropagation();

      // GUARD: blok demo kalau ONLINE dan demo mode OFF
      if (!demoAllowed()) return;

      const newSt = nextStatus(getStatus(id));
      statusBySlot = { ...statusBySlot, [id]: newSt };
      syncAllSlots();
      updateCountsAndUtil();
      selectSlot(id);

      // Tulis ke Firebase hanya slot ini
      const slotsRef = ref(db, "undiknas/parking/status/slots");
      await update(slotsRef, { [id]: newSt });

      // (opsional) update ts juga supaya admin/user melihat "baru"
      await update(ref(db, "undiknas/parking/status"), { ts: Date.now() });
    });

    applyStatusToEl(el);
    targetEl.appendChild(el);
  }
}

function syncAllSlots() {
  document
    .querySelectorAll("#parkMap .slot, #parkMapZoom .slot")
    .forEach(applyStatusToEl);
}

/** =========================
 *  FIREBASE LISTENER
 *  ========================= */
function startFirebaseListener() {
  const statusRef = ref(db, "undiknas/parking/status");
  onValue(statusRef, (snap) => {
    const data = snap.val();
    const slots = data?.slots ?? {};

    // ambil ts untuk ONLINE/OFFLINE
    const tsMs = normalizeTsToMs(data?.ts) || Date.now();
    lastTsMs = tsMs;

    // update status slot sesuai layout
    const next = {};
    for (const id of Object.keys(SLOT_POS)) {
      next[id] = normalizeStatus(slots[id]);
    }
    statusBySlot = next;

    syncAllSlots();
    updateCountsAndUtil();
    selectSlot(null);
  });
}

/** =========================
 *  ONLINE/OFFLINE UI LOOP
 *  ========================= */
function startOnlineLoop() {
  setInterval(() => {
    if (!connEl || !lastEl) return;

    if (!lastTsMs) {
      deviceOnline = false;
      connEl.textContent = "OFFLINE";
      connEl.classList.add("status-offline");
      connEl.classList.remove("status-online");
      lastEl.textContent = "-";
      setDemoControlsDisabled(false); // saat offline demo boleh
      return;
    }

    const diffSec = Math.max(0, Math.floor((Date.now() - lastTsMs) / 1000));
    lastEl.textContent = `${diffSec} dtk lalu`;

    deviceOnline = diffSec <= OFFLINE_AFTER_SEC;

    if (deviceOnline) {
      connEl.textContent = "ONLINE";
      connEl.classList.add("status-online");
      connEl.classList.remove("status-offline");

      // jika demo mode OFF, blok demo
      setDemoControlsDisabled(!demoAllowed());
    } else {
      connEl.textContent = "OFFLINE";
      connEl.classList.add("status-offline");
      connEl.classList.remove("status-online");

      setDemoControlsDisabled(false);
    }
  }, 1000);

  // kalau user toggle demo mode, langsung update state tombol
  demoModeEl?.addEventListener("change", () => {
    setDemoControlsDisabled(!demoAllowed());
  });
}

/* Zoom */
function setZoom(scale) {
  zoomScale = Math.max(1, Math.min(2.2, scale));
  if (mapZoom) mapZoom.style.transform = `scale(${zoomScale})`;
  zPct.textContent = Math.round(zoomScale * 100);
  zRange.value = String(Math.round(zoomScale * 100));
}
function openZoom() {
  zoomModal?.show();
  setZoom(1);
}

zIn?.addEventListener("click", () => setZoom(zoomScale + 0.1));
zOut?.addEventListener("click", () => setZoom(zoomScale - 0.1));
zReset?.addEventListener("click", () => setZoom(1));
zRange?.addEventListener("input", () => setZoom(parseInt(zRange.value, 10) / 100));

zoomBtn?.addEventListener("click", openZoom);
zoomFab?.addEventListener("click", openZoom);
mapNormal?.addEventListener("dblclick", openZoom);

/* Buttons (simulasi) */
async function resetAll() {
  if (!demoAllowed()) return;
  await set(ref(db, "undiknas/parking/status/slots"), {});
  await update(ref(db, "undiknas/parking/status"), { ts: Date.now() });
}
async function demoRandom() {
  if (!demoAllowed()) return;

  const payload = {};
  for (const id of Object.keys(SLOT_POS)) {
    const r = Math.random();
    payload[id] = r < 0.33 ? "unknown" : r < 0.66 ? "free" : "full";
  }
  await set(ref(db, "undiknas/parking/status/slots"), payload);
  await update(ref(db, "undiknas/parking/status"), { ts: Date.now() });
}

resetBtn?.addEventListener("click", resetAll);
demoBtn?.addEventListener("click", demoRandom);

/* init */
renderSlots(mapNormal);
if (mapZoom) renderSlots(mapZoom);
updateCountsAndUtil();
selectSlot(null);
startFirebaseListener();
startOnlineLoop();
