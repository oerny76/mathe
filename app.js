// ---------- Konfiguration ----------
// Hier die beiden Kinder eintragen. "id" muss zum Ordnernamen unter /data passen.
const KIDS = [
  { id: "kind1", name: "TJ", color: "var(--chalk-pink)" },
  { id: "kind2", name: "MJ", color: "var(--chalk-blue)" },
];

const els = {
  tabs: document.getElementById("kid-tabs"),
  picker: document.getElementById("worksheet-picker"),
  pickerHint: document.getElementById("picker-hint"),
  worksheetList: document.getElementById("worksheet-list"),
  view: document.getElementById("worksheet-view"),
  backBtn: document.getElementById("back-btn"),
  statusPanel: document.getElementById("status-panel"),
  weekLabel: document.getElementById("week-label"),
  progressLabel: document.getElementById("progress-label"),
  taskList: document.getElementById("task-list"),
  checkBtn: document.getElementById("check-btn"),
  retryBtn: document.getElementById("retry-btn"),
  resultBanner: document.getElementById("result-banner"),
  puzzleSection: document.getElementById("puzzle"),
  puzzleTitle: document.getElementById("puzzle-title"),
  puzzleImage: document.getElementById("puzzle-image"),
  puzzleGrid: document.getElementById("puzzle-grid"),
  puzzleStatus: document.getElementById("puzzle-status"),
  puzzleDownloadBtn: document.getElementById("puzzle-download"),
  puzzleCanvas: document.getElementById("puzzle-canvas"),
};

let currentKid = null;
let currentFile = null;
let currentTasks = [];
let currentWorksheet = null;
let currentBild = null; // aktuelles Wochenbild (Puzzle-Gamification)
let currentWeekMap = {}; // bereich -> file, das zum aktuellen Wochenbild gehört
let worksheetCache = {}; // file -> geladenes JSON (vermeidet doppelte fetches)

// ---------- Bereiche (Themen-Kategorien) ----------
const BEREICH_ORDER = ["einmaleins", "grundrechenarten", "kopfrechnen", "lesen"];
const BEREICH_LABELS = {
  einmaleins: "✖️ Einmaleins",
  grundrechenarten: "➕➖ Grundrechenarten",
  kopfrechnen: "🧠 Kopfrechnen",
  lesen: "📖 Lesen",
};
const BEREICH_ICONS = {
  einmaleins: "✖️",
  grundrechenarten: "➕➖",
  kopfrechnen: "🧠",
  lesen: "📖",
};

function bereichLabel(bereich) {
  return BEREICH_LABELS[bereich] || bereich;
}

// ---------- Fortschritt (localStorage) ----------
function progressKey(kidId, file) {
  return `mathe-pwa:${kidId}:${file}`;
}

function saveProgress(kidId, file, data) {
  try {
    localStorage.setItem(progressKey(kidId, file), JSON.stringify(data));
  } catch (e) {
    console.warn("Konnte Fortschritt nicht speichern:", e);
  }
}

function loadProgress(kidId, file) {
  try {
    const raw = localStorage.getItem(progressKey(kidId, file));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ---------- Namensschilder (Tabs) rendern ----------
function renderTabs() {
  els.tabs.innerHTML = "";
  KIDS.forEach((kid) => {
    const btn = document.createElement("button");
    btn.className = "kid-tab";
    btn.style.setProperty("--kid-color", kid.color);
    btn.textContent = kid.name;
    btn.addEventListener("click", () => selectKid(kid));
    els.tabs.appendChild(btn);
  });
}

function setActiveTab(kidId) {
  [...els.tabs.children].forEach((btn, i) => {
    btn.classList.toggle("active", KIDS[i].id === kidId);
  });
}

// ---------- Schritt 1: Kind wählen -> Liste der vorhandenen Arbeitsblätter ----------
async function selectKid(kid) {
  currentKid = kid;
  setActiveTab(kid.id);

  showPicker();
  els.pickerHint.textContent = "Aufgaben werden geladen …";
  els.worksheetList.innerHTML = "";

  const indexPath = `data/${kid.id}/index.json`;

  try {
    const res = await fetch(indexPath, { cache: "no-store" });
    if (!res.ok) throw new Error("Kein Verzeichnis gefunden");
    const index = await res.json();
    const files = index.files || [];

    if (files.length === 0) {
      els.pickerHint.textContent = "Für dich sind noch keine Aufgaben vorbereitet. Frag einen Erwachsenen! 🙈";
      return;
    }

    // Metadaten jedes Arbeitsblatts laden (Titel, Anzahl Aufgaben, erledigt?)
    const worksheets = await Promise.all(
      files.map(async (file) => {
        try {
          const wRes = await fetch(`data/${kid.id}/${file}`, { cache: "no-store" });
          const wJson = await wRes.json();
          worksheetCache[file] = wJson;
          const progress = loadProgress(kid.id, file);
          return {
            file,
            titel: wJson.titel || file,
            erstellt: wJson.erstellt || wJson.woche || "",
            anzahl: (wJson.aufgaben || []).length,
            bereich: wJson.bereich || null,
            woche: wJson.woche || null,
            erledigt: progress ? progress.correctCount === progress.total : false,
          };
        } catch {
          return null;
        }
      })
    );

    const valid = worksheets.filter(Boolean).sort((a, b) => (a.erstellt < b.erstellt ? 1 : -1));
    els.pickerHint.textContent = "Wähle eine Aufgabe aus:";
    renderWorksheetList(valid);
    await loadPuzzle(kid, index, valid);
  } catch (err) {
    els.pickerHint.textContent = "Für dich sind noch keine Aufgaben vorbereitet. Frag einen Erwachsenen! 🙈";
    els.puzzleSection.hidden = true;
  }
}

// ---------- Wochenbild-Puzzle (Gamification) ----------
async function loadPuzzle(kid, index, worksheets) {
  currentBild = null;
  currentWeekMap = {};

  if (!index.aktuellesBild) {
    els.puzzleSection.hidden = true;
    return;
  }

  try {
    const res = await fetch(`data/${kid.id}/${index.aktuellesBild}`, { cache: "no-store" });
    if (!res.ok) throw new Error("Kein Wochenbild gefunden");
    currentBild = await res.json();
  } catch {
    els.puzzleSection.hidden = true;
    return;
  }

  BEREICH_ORDER.forEach((key) => {
    const match = worksheets.find((ws) => ws.bereich === key && ws.woche === currentBild.woche);
    if (match) currentWeekMap[key] = match.file;
  });

  if (Object.keys(currentWeekMap).length === 0) {
    els.puzzleSection.hidden = true;
    return;
  }

  els.puzzleSection.hidden = false;
  els.puzzleTitle.textContent = `🧩 ${currentBild.titel || "Dein Wochenbild"}`;
  els.puzzleImage.innerHTML = currentBild.svg || "";
  renderPuzzleGrid();
}

function renderPuzzleGrid() {
  if (!currentBild) return;

  const keys = BEREICH_ORDER.filter((key) => currentWeekMap[key]);
  els.puzzleGrid.innerHTML = "";
  let doneCount = 0;

  keys.forEach((key) => {
    const file = currentWeekMap[key];
    const total = (worksheetCache[file]?.aufgaben || []).length;
    const progress = loadProgress(currentKid.id, file);
    const erledigt = progress ? progress.correctCount === total : false;
    if (erledigt) doneCount++;

    const tile = document.createElement("div");
    tile.className = "puzzle-tile" + (erledigt ? " revealed" : "");
    tile.innerHTML = `
      <span>${BEREICH_ICONS[key] || "❓"}</span>
      <span class="puzzle-tile-label">${escapeHtml(bereichLabel(key).replace(/^\S+\s/, ""))}</span>
    `;
    els.puzzleGrid.appendChild(tile);
  });

  const total = keys.length;
  els.puzzleStatus.textContent =
    doneCount === total
      ? "🎉 Alle Teile aufgedeckt – dein Bild ist fertig!"
      : `${doneCount} von ${total} Teilen aufgedeckt`;

  els.puzzleSection.classList.toggle("complete", doneCount === total && total > 0);
  els.puzzleDownloadBtn.hidden = !(doneCount === total && total > 0);
}

function downloadPuzzleImage() {
  if (!currentBild?.svg || !currentKid) return;

  const svgBlob = new Blob([currentBild.svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  img.onload = () => {
    const size = 2000;
    const canvas = els.puzzleCanvas;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(img, 0, 0, size, size);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${currentKid.name}-wochenbild-${currentBild.woche || "aktuell"}.png`;
      link.click();
      URL.revokeObjectURL(link.href);
    }, "image/png");
  };

  img.src = url;
}

function renderWorksheetCard(ws) {
  const card = document.createElement("button");
  card.className = "worksheet-card" + (ws.erledigt ? " done" : "");
  card.innerHTML = `
    <span class="worksheet-title">${escapeHtml(ws.titel)}</span>
    <span class="worksheet-meta">${ws.anzahl} Aufgaben${ws.erstellt ? " · " + escapeHtml(ws.erstellt) : ""}</span>
    ${ws.erledigt ? '<span class="worksheet-badge">✔ erledigt</span>' : ""}
  `;
  card.addEventListener("click", () => openWorksheet(ws.file));
  return card;
}

function renderWorksheetList(worksheets) {
  els.worksheetList.innerHTML = "";

  const hasBereiche = worksheets.some((ws) => ws.bereich);
  if (!hasBereiche) {
    worksheets.forEach((ws) => els.worksheetList.appendChild(renderWorksheetCard(ws)));
    return;
  }

  const groups = new Map();
  worksheets.forEach((ws) => {
    const key = ws.bereich || "sonstiges";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(ws);
  });

  const orderedKeys = [
    ...BEREICH_ORDER.filter((key) => groups.has(key)),
    ...[...groups.keys()].filter((key) => !BEREICH_ORDER.includes(key)).sort(),
  ];

  orderedKeys.forEach((key) => {
    const heading = document.createElement("h2");
    heading.className = "bereich-heading";
    heading.textContent = key === "sonstiges" ? "Weitere Aufgaben" : bereichLabel(key);
    els.worksheetList.appendChild(heading);

    const group = document.createElement("div");
    group.className = "bereich-group";
    groups.get(key).forEach((ws) => group.appendChild(renderWorksheetCard(ws)));
    els.worksheetList.appendChild(group);
  });
}

// ---------- Schritt 2: Arbeitsblatt öffnen ----------
function openWorksheet(file) {
  currentFile = file;
  const json = worksheetCache[file];
  currentWorksheet = json;
  currentTasks = json.aufgaben || [];

  els.weekLabel.textContent = `📄 ${json.titel || file}`;
  showView();
  renderTasks();
}

function backToPicker() {
  currentFile = null;
  currentWorksheet = null;
  showPicker();
}

function showPicker() {
  els.picker.hidden = false;
  els.view.hidden = true;
}

function showView() {
  els.picker.hidden = true;
  els.view.hidden = false;
  els.resultBanner.hidden = true;
  els.retryBtn.hidden = true;
}

// ---------- Aufgaben rendern ----------
function renderTasks() {
  els.taskList.innerHTML = "";
  const saved = loadProgress(currentKid.id, currentFile);

  if (currentWorksheet?.text) {
    const readingBox = document.createElement("div");
    readingBox.className = "reading-text";
    readingBox.innerHTML = `<p class="reading-text-title">📖 Lies zuerst den Text:</p><p>${escapeHtml(currentWorksheet.text).replace(/\n+/g, "</p><p>")}</p>`;
    els.taskList.appendChild(readingBox);
  }

  currentTasks.forEach((task, index) => {
    const card = document.createElement("div");
    card.className = "task-card";
    card.dataset.taskId = task.id;

    const savedAnswer = saved?.answers?.[task.id] ?? "";

    card.innerHTML = `
      <span class="task-number">Aufgabe ${index + 1} von ${currentTasks.length}</span>
      <p class="task-question">${escapeHtml(task.frage)}</p>
      <div class="task-input-row">
        <input
          type="text"
          inputmode="decimal"
          autocomplete="off"
          placeholder="Deine Antwort"
          value="${escapeHtml(String(savedAnswer))}"
          data-task-id="${task.id}"
        />
        <span class="task-mark" aria-hidden="true"></span>
      </div>
      <button type="button" class="scratch-toggle" data-task-id="${task.id}">✏️ Rechenfeld</button>
      <textarea
        class="scratch-pad"
        placeholder="Hier kannst du rechnen …"
        rows="3"
        hidden
      ></textarea>
    `;
    els.taskList.appendChild(card);
  });

  els.taskList.querySelectorAll(".scratch-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pad = btn.nextElementSibling;
      const isHidden = pad.hasAttribute("hidden");
      if (isHidden) {
        pad.removeAttribute("hidden");
        btn.textContent = "✏️ Rechenfeld ausblenden";
      } else {
        pad.setAttribute("hidden", "");
        btn.textContent = "✏️ Rechenfeld";
      }
    });
  });

  els.checkBtn.hidden = currentTasks.length === 0;
  els.progressLabel.textContent = `${currentTasks.length} Aufgaben`;
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Auswertung ----------
function normalizeAnswer(value) {
  return String(value).trim().replace(",", ".").toLowerCase();
}

function checkAnswers() {
  let correctCount = 0;
  const answers = {};

  currentTasks.forEach((task) => {
    const input = els.taskList.querySelector(`input[data-task-id="${task.id}"]`);
    const card = input.closest(".task-card");
    const given = normalizeAnswer(input.value);
    const expected = normalizeAnswer(task.loesung);

    answers[task.id] = input.value;

    card.classList.remove("correct", "wrong");
    if (given !== "" && given === expected) {
      card.classList.add("correct");
      correctCount++;
    } else {
      card.classList.add("wrong");
    }
    input.disabled = true;
  });

  saveProgress(currentKid.id, currentFile, {
    answers,
    correctCount,
    total: currentTasks.length,
    completedAt: new Date().toISOString(),
  });

  showResult(correctCount, currentTasks.length);
  els.checkBtn.hidden = true;
  els.retryBtn.hidden = false;

  if (currentBild) renderPuzzleGrid();
}

function showResult(correct, total) {
  const banner = els.resultBanner;
  banner.hidden = false;
  banner.classList.toggle("needs-practice", correct < total);

  if (correct === total) {
    banner.textContent = `🎉 Super gemacht! Alle ${total} Aufgaben richtig!`;
  } else {
    banner.textContent = `Du hast ${correct} von ${total} richtig. Schau dir die roten Aufgaben nochmal an – du schaffst das! 💪`;
  }
}

function retry() {
  els.resultBanner.hidden = true;
  els.retryBtn.hidden = true;
  renderTasks();
}

// ---------- Events ----------
els.checkBtn.addEventListener("click", checkAnswers);
els.retryBtn.addEventListener("click", retry);
els.backBtn.addEventListener("click", backToPicker);
els.puzzleDownloadBtn.addEventListener("click", downloadPuzzleImage);

// ---------- Start ----------
renderTabs();
