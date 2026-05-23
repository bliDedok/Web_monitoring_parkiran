import { SLOT_POS, SLOT_ORI } from "./slots.js";

const mapNormal = document.getElementById("parkMap");
const mapZoom = document.getElementById("parkMapZoom");

const cUnknown = document.getElementById("cUnknown");
const cFree = document.getElementById("cFree");
const cFull = document.getElementById("cFull");

const availNum = document.getElementById("availNum");
const fullNum = document.getElementById("fullNum");
const unkNum = document.getElementById("unkNum");

const availableText = document.getElementById("availableText");
const recText = document.getElementById("recText");
const recDetailBtn = document.getElementById("recDetailBtn");
const zoneSummaryEl = document.getElementById("zoneSummary");

/* Slot detail modal */
const slotModalEl = document.getElementById("slotModal");
const slotModal = slotModalEl ? new bootstrap.Modal(slotModalEl) : null;

const mSlotId = document.getElementById("mSlotId");
const mSlotZone = document.getElementById("mSlotZone");
const mSlotStatus = document.getElementById("mSlotStatus");
const mSlotSensor = document.getElementById("mSlotSensor");
const mLastUpdate = document.getElementById("mLastUpdate");
const mLastChange = document.getElementById("mLastChange");

const showOnlyActiveEl = document.getElementById("showOnlyActive");

const zoomBtn = document.getElementById("zoomBtn");
const zoomFab = document.getElementById("zoomFab");

const zoomModalEl = document.getElementById("zoomModal");
const zoomModal = zoomModalEl ? new bootstrap.Modal(zoomModalEl) : null;

const zOut = document.getElementById("zOut");
const zIn = document.getElementById("zIn");
const zReset = document.getElementById("zReset");
const zRange = document.getElementById("zRange");
const zPct = document.getElementById("zPct");

let zoomScale = 1;

/** ===== STATUS SLOT (diisi dari Firebase listener) ===== */
let statusBySlot = {};         // {A2:"free/full/unknown", ...}
let sensorSlots = new Set();   // slot yang terdeteksi ada datanya (sensor aktif)
let lastUpdateMs = 0;          // timestamp terakhir update (dari listener)
let lastChangeBySlot = {};     // {A2: ms, ...} waktu terakhir status slot berubah
let recommendedId = null;      // slot rekomendasi saat ini

/** Koordinat "gerbang masuk" (persentase terhadap denah).
 *  Default: bawah-tengah. Kamu bisa ubah sesuai denah kampusmu.
 */
const ENTRANCE = { left: 50, top: 5 }; // gerbang masuk dari atas (posisi % pada peta)

function normalizeStatus(v) {
  return v === "free" || v === "full" ? v : "unknown";
}
function getStatus(id) {
  return statusBySlot[id] ?? "unknown";
}

function displayStatus(id) {
  // bedakan antara unknown karena "belum ada sensor" vs unknown dari sensor aktif
  if (!sensorSlots.has(id)) return "no sensor";
  return getStatus(id);
}

function applyStatusToEl(el) {
  const id = el.dataset.id;
  const st = getStatus(id);

  el.classList.remove("free", "full");
  if (st === "free") el.classList.add("free");
  else if (st === "full") el.classList.add("full");

  const stEl = el.querySelector(".st");
  if (stEl) stEl.textContent = displayStatus(id);

  el.title = `${id}: ${displayStatus(id)}`;
function openSlotModal(id) {
  if (!slotModal) return;

  const st = getStatus(id);
  const readable =
    st === "free" ? "Kosong" : st === "full" ? "Terisi" : "Unknown";

  if (mSlotId) mSlotId.textContent = id;
  if (mSlotZone) mSlotZone.textContent = zoneOf(id);
  if (mSlotStatus) mSlotStatus.textContent = readable;

  const sensorInfo = sensorSlots.has(id) ? "Aktif" : "Belum terpasang";
  if (mSlotSensor) mSlotSensor.textContent = sensorInfo;

  if (mLastUpdate) mLastUpdate.textContent = relSecText(lastUpdateMs);

  const chMs = lastChangeBySlot[id] || 0;
  if (mLastChange) mLastChange.textContent = chMs ? relSecText(chMs) : "-";

  slotModal.show();
}

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

    applyStatusToEl(el);

    // klik slot untuk detail
    el.addEventListener("click", () => openSlotModal(id));

    targetEl.appendChild(el);
  }
}

function updateCounts() {
  const totalSlots = Object.keys(SLOT_POS).length;

  // Hitung untuk sensor aktif
  let freeActive = 0;
  let fullActive = 0;
  let unknownActive = 0;

  for (const id of sensorSlots) {
    const st = getStatus(id);
    if (st === "free") freeActive++;
    else if (st === "full") fullActive++;
    else unknownActive++;
  }

  // Slot tanpa sensor
  const noSensor = Math.max(0, totalSlots - sensorSlots.size);

  // Untuk badge atas (unknown = no sensor + unknown pada sensor)
  const unknownAll = noSensor + unknownActive;

  cFree.textContent = freeActive;
  cFull.textContent = fullActive;
  cUnknown.textContent = unknownAll;

  // Panel kanan (sesuai label)
  availNum.textContent = freeActive;
  fullNum.textContent = fullActive;
  unkNum.textContent = noSensor;

  availableText.textContent = freeActive;
function updateZoneSummary() {
  if (!zoneSummaryEl) return;

  const zones = ["A", "B", "C", "D"];
  const stats = {};
  for (const z of zones) stats[z] = { free: 0, full: 0, unknown: 0, active: 0 };

  for (const id of sensorSlots) {
    const z = zoneOf(id);
    if (!stats[z]) stats[z] = { free: 0, full: 0, unknown: 0, active: 0 };
    const st = getStatus(id);
    stats[z].active += 1;
    if (st === "free") stats[z].free += 1;
    else if (st === "full") stats[z].full += 1;
    else stats[z].unknown += 1;
  }

  zoneSummaryEl.innerHTML = zones
    .map((z) => {
      const s = stats[z];
      const label = `Zona ${z}`;
      return `
        <div class="zone-row p-2 border rounded-4 bg-white">
          <div class="d-flex justify-content-between align-items-center">
            <div class="fw-semibold">${label}</div>
            <div class="small text-muted">${s.active} slot</div>
          </div>
          <div class="d-flex gap-2 flex-wrap mt-1">
            <span class="badge text-bg-success app-pill">Kosong: ${s.free}</span>
            <span class="badge text-bg-danger app-pill">Terisi: ${s.full}</span>
            <span class="badge text-bg-secondary app-pill">Unknown: ${s.unknown}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

}

function slotCenter(id) {
  const p = SLOT_POS[id];
  return {
    x: p.left + p.width / 2,
    y: p.top + p.height / 2,
  };
function relSecText(ms) {
  if (!ms) return "-";
  const diffSec = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  return `${diffSec} dtk lalu`;
}

function zoneOf(id) {
  return String(id || "-").charAt(0).toUpperCase();
}

}

function updateRecommendation() {
  if (!recText) return;

  let bestId = null;
  let bestD2 = Infinity;

  for (const id of sensorSlots) {
    if (getStatus(id) !== "free") continue;
    const c = slotCenter(id);
    const dx = c.x - ENTRANCE.left;
    const dy = c.y - ENTRANCE.top;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestId = id;
    }
  }

  recommendedId = bestId;
  recText.textContent = bestId ? `${bestId} (kosong)` : "Tidak ada slot kosong";

  // tombol detail rekomendasi
  if (recDetailBtn) {
    recDetailBtn.disabled = !bestId;
  }

  // highlight slot rekomendasi
  const applyHighlight = (mapEl) => {
    if (!mapEl) return;
    mapEl.querySelectorAll(".slot").forEach((el) => {
      el.classList.toggle("recommended", !!bestId && el.dataset.id === bestId);
    });
  };
  applyHighlight(mapNormal);
  applyHighlight(mapZoom);
}

function applyFilter() {
  const onlyActive = !!showOnlyActiveEl?.checked;

  const applyTo = (mapEl) => {
    if (!mapEl) return;
    mapEl.querySelectorAll(".slot").forEach((el) => {
      const id = el.dataset.id;
      const show = !onlyActive || sensorSlots.has(id);
      el.style.display = show ? "" : "none";
    });
  };

  applyTo(mapNormal);
  applyTo(mapZoom);
}

function refreshAllSlots() {
  mapNormal?.querySelectorAll(".slot").forEach(applyStatusToEl);
  mapZoom?.querySelectorAll(".slot").forEach(applyStatusToEl);
  updateCounts();
  updateZoneSummary();
  updateRecommendation();
  applyFilter();
}

/** Dipanggil oleh index.html: window.applyStatus(slots, ts) */
/** Dipanggil oleh index.html: window.applyStatus(slots, ts) */
window.applyStatus = (slots, tsMs) => {
  lastUpdateMs = Number(tsMs) || Date.now();

  const keys = Object.keys(slots ?? {});
  sensorSlots = new Set(keys);

  const next = {};
  for (const id of Object.keys(SLOT_POS)) {
    next[id] = normalizeStatus(slots?.[id]);
  }

  // catat waktu perubahan status (local, tanpa ubah backend)
  for (const id of Object.keys(SLOT_POS)) {
    const prev = statusBySlot[id] ?? "unknown";
    const cur = next[id];
    if (prev !== cur) {
      lastChangeBySlot[id] = Date.now();
    }
  }

  statusBySlot = next;

  refreshAllSlots();
};

/* ===== Rekomendasi detail button ===== */
(function initRecDetail() {
  if (!recDetailBtn) return;
  recDetailBtn.addEventListener("click", () => {
    if (recommendedId) openSlotModal(recommendedId);
  });
})();

/* ===== Filter toggle persistence ===== */
(function initFilterToggle() {
  if (!showOnlyActiveEl) return;

  const saved = localStorage.getItem("showOnlyActive") === "1";
  showOnlyActiveEl.checked = saved;

  showOnlyActiveEl.addEventListener("change", () => {
    localStorage.setItem("showOnlyActive", showOnlyActiveEl.checked ? "1" : "0");
    applyFilter();
  });
})();

/* ===== Zoom ===== */
function setZoom(scale) {
  zoomScale = Math.max(1, Math.min(2.2, scale));
  if (mapZoom) mapZoom.style.transform = `scale(${zoomScale})`;
  if (zPct) zPct.textContent = Math.round(zoomScale * 100);
  if (zRange) zRange.value = String(Math.round(zoomScale * 100));
}

function openZoom() {
  zoomModal?.show();
  setZoom(1);
}

zoomBtn?.addEventListener("click", openZoom);
zoomFab?.addEventListener("click", openZoom);

zIn?.addEventListener("click", () => setZoom(zoomScale + 0.1));
zOut?.addEventListener("click", () => setZoom(zoomScale - 0.1));
zReset?.addEventListener("click", () => setZoom(1));
zRange?.addEventListener("input", () => setZoom(parseInt(zRange.value, 10) / 100));

/* init */
renderSlots(mapNormal);
if (mapZoom) renderSlots(mapZoom);
updateCounts();
updateRecommendation();
applyFilter();
