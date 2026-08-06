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
};

let currentKid = null;
let currentFile = null;
let currentTasks = [];
let worksheetCache = {}; // file -> geladenes JSON (vermeidet doppelte fetches)

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
  } catch (err) {
    els.pickerHint.textContent = "Für dich sind noch keine Aufgaben vorbereitet. Frag einen Erwachsenen! 🙈";
  }
}

function renderWorksheetList(worksheets) {
  els.worksheetList.innerHTML = "";
  worksheets.forEach((ws) => {
    const card = document.createElement("button");
    card.className = "worksheet-card" + (ws.erledigt ? " done" : "");
    card.innerHTML = `
      <span class="worksheet-title">${escapeHtml(ws.titel)}</span>
      <span class="worksheet-meta">${ws.anzahl} Aufgaben${ws.erstellt ? " · " + escapeHtml(ws.erstellt) : ""}</span>
      ${ws.erledigt ? '<span class="worksheet-badge">✔ erledigt</span>' : ""}
    `;
    card.addEventListener("click", () => openWorksheet(ws.file));
    els.worksheetList.appendChild(card);
  });
}

// ---------- Schritt 2: Arbeitsblatt öffnen ----------
function openWorksheet(file) {
  currentFile = file;
  const json = worksheetCache[file];
  currentTasks = json.aufgaben || [];

  els.weekLabel.textContent = `📄 ${json.titel || file}`;
  showView();
  renderTasks();
}

function backToPicker() {
  currentFile = null;
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
    `;
    els.taskList.appendChild(card);
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

// ---------- Start ----------
renderTabs();
