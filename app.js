import { SLOT_POS, SLOT_ORI } from "./slots.js";

/* ====== Element refs ====== */
const mapNormal = document.getElementById("parkMap");
const mapZoom = document.getElementById("parkMapZoom");

const cUnknown = document.getElementById("cUnknown");
const cFree = document.getElementById("cFree");
const cFull = document.getElementById("cFull");

const utilPct = document.getElementById("utilPct");
const utilBar = document.getElementById("utilBar");

const selId = document.getElementById("selId");
const selStatus = document.getElementById("selStatus");

const mSelId = document.getElementById("mSelId");
const mSelStatus = document.getElementById("mSelStatus");

const resetBtn = document.getElementById("resetBtn");
const demoBtn = document.getElementById("demoBtn");

const mResetBtn = document.getElementById("mResetBtn");
const mDemoBtn = document.getElementById("mDemoBtn");

const zoomBtn = document.getElementById("zoomBtn");
const zoomFab = document.getElementById("zoomFab");

const zoomModalEl = document.getElementById("zoomModal");
const zoomModal = zoomModalEl ? new bootstrap.Modal(zoomModalEl) : null;

const sheetEl = document.getElementById("slotSheet");
const sheet = sheetEl ? new bootstrap.Offcanvas(sheetEl) : null;

/* Zoom controls */
const zOut = document.getElementById("zOut");
const zIn = document.getElementById("zIn");
const zReset = document.getElementById("zReset");
const zRange = document.getElementById("zRange");
const zPct = document.getElementById("zPct");

/* ====== State ====== */
const statusBySlot = {};

// contoh status awal (ubah sesuai sensor kamu)
statusBySlot.A3 = "full";
statusBySlot.B2 = "free";
statusBySlot.C3 = "full";
statusBySlot.D1 = "free";

let lastSelected = null;
let zoomScale = 1;

/* ====== Helpers ====== */
function nextStatus(cur) {
  if (cur === "unknown") return "free";
  if (cur === "free") return "full";
  return "unknown";
}
function getStatus(id) {
  return statusBySlot[id] ?? "unknown";
}

function selectSlot(id) {
  lastSelected = id;
  const st = id ? getStatus(id) : "-";

  if (selId) selId.textContent = id || "-";
  if (selStatus) selStatus.textContent = id ? st : "-";

  if (mSelId) mSelId.textContent = id || "-";
  if (mSelStatus) mSelStatus.textContent = id ? st : "-";
}

function applyStatusToEl(el) {
  const id = el.dataset.id;
  const st = getStatus(id);

  el.classList.remove("free", "full");
  if (st === "free") el.classList.add("free");
  else if (st === "full") el.classList.add("full");

  const stEl = el.querySelector(".st");
  if (stEl) stEl.textContent = st;

  // tooltip text (buat desktop hover)
  el.title = `${id}: ${st}`;
}

function updateCountsAndUtil() {
  const counts = { unknown: 0, free: 0, full: 0 };
  for (const id of Object.keys(SLOT_POS)) counts[getStatus(id)]++;

  cUnknown.textContent = counts.unknown;
  cFree.textContent = counts.free;
  cFull.textContent = counts.full;

  // util = full / (full+free) yang bukan unknown
  const detected = counts.full + counts.free;
  const pct = detected === 0 ? 0 : Math.round((counts.full / detected) * 100);

  utilPct.textContent = pct;
  utilBar.style.width = pct + "%";
}

function renderSlots(targetEl) {
  // clear existing
  targetEl.querySelectorAll(".slot").forEach(s => s.remove());

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

    el.addEventListener("click", (ev) => {
      ev.stopPropagation();

      // toggle status
      statusBySlot[id] = nextStatus(getStatus(id));

      // sync all
      syncAllSlots();
      updateCountsAndUtil();
      selectSlot(id);

      // mobile: buka bottom sheet biar status kelihatan
      if (window.matchMedia("(max-width: 991px)").matches) sheet?.show();
    });

    applyStatusToEl(el);
    targetEl.appendChild(el);
  }
}

function syncAllSlots() {
  document.querySelectorAll("#parkMap .slot, #parkMapZoom .slot").forEach(applyStatusToEl);
}

/* ====== Zoom logic ====== */
function setZoom(scale) {
  zoomScale = Math.max(1, Math.min(2.2, scale));
  if (mapZoom) mapZoom.style.transform = `scale(${zoomScale})`;
  if (zPct) zPct.textContent = Math.round(zoomScale * 100);
  if (zRange) zRange.value = String(Math.round(zoomScale * 100));
}

/* ====== Init render ====== */
renderSlots(mapNormal);
if (mapZoom) renderSlots(mapZoom);
updateCountsAndUtil();
selectSlot(null);

/* ====== Buttons ====== */
function resetAll() {
  for (const id of Object.keys(SLOT_POS)) delete statusBySlot[id];
  syncAllSlots();
  updateCountsAndUtil();
  selectSlot(null);
}

function demoRandom() {
  for (const id of Object.keys(SLOT_POS)) {
    const r = Math.random();
    statusBySlot[id] = r < 0.33 ? "unknown" : r < 0.66 ? "free" : "full";
  }
  syncAllSlots();
  updateCountsAndUtil();
  if (lastSelected) selectSlot(lastSelected);
}

resetBtn?.addEventListener("click", resetAll);
demoBtn?.addEventListener("click", demoRandom);
mResetBtn?.addEventListener("click", resetAll);
mDemoBtn?.addEventListener("click", demoRandom);

/* ====== Open zoom modal ====== */
function openZoom() {
  zoomModal?.show();
  // reset zoom tiap buka biar enak
  setZoom(1);
}
zoomBtn?.addEventListener("click", openZoom);
zoomFab?.addEventListener("click", openZoom);

// Bonus: double click denah normal untuk zoom
mapNormal?.addEventListener("dblclick", openZoom);

/* ====== Zoom controls ====== */
zIn?.addEventListener("click", () => setZoom(zoomScale + 0.1));
zOut?.addEventListener("click", () => setZoom(zoomScale - 0.1));
zReset?.addEventListener("click", () => setZoom(1));
zRange?.addEventListener("input", () => setZoom(parseInt(zRange.value, 10) / 100));

/* Tooltip bootstrap (desktop) - optional, aman walau gak kepakai */
document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach(el => new bootstrap.Tooltip(el));
