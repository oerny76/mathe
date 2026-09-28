// KIDS, Bereiche und der Supabase-Client kommen aus shared.js (vor diesem
// Skript geladen).

// Jede Kind-Seite (/tj/, /mj/) lädt dieses Skript per relativem Pfad – die
// Basis-URL (Repo-Root) wird daraus abgeleitet, damit "data/..."-Fetches
// unabhängig vom aufrufenden Unterordner immer die Root-Daten treffen.
const APP_BASE = new URL(".", document.currentScript.src);

const els = {
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
  puzzlePicker: document.getElementById("puzzle-picker"),
  puzzleFrame: document.getElementById("puzzle-frame"),
  puzzleImage: document.getElementById("puzzle-image"),
  puzzleGrid: document.getElementById("puzzle-grid"),
  puzzleDownloadBtn: document.getElementById("puzzle-download"),
  puzzleCanvas: document.getElementById("puzzle-canvas"),
  backlogToggle: document.getElementById("backlog-toggle"),
  classicPicker: document.getElementById("classic-picker"),
};

let currentKid = null;
let currentFile = null;
let currentTasks = [];
let currentWorksheet = null;
let currentBild = null; // aktuelles Wochenbild (Puzzle-Gamification)
let currentWeekFiles = []; // Arbeitsblätter (file+bereich) der aktuellen Wochenbild-Woche, ein Eintrag pro Puzzle-Teil
let worksheetCache = {}; // file -> geladenes JSON (vermeidet doppelte fetches)

// Seitenverhältnis eines Wochenbilds aus seinem SVG-viewBox ableiten (z.B. 3:4
// fürs iPad-Hintergrundbild oder A4-Hochformat fürs Ausmalbild), statt es
// hart zu verdrahten – Fallback 3:4, falls kein viewBox gefunden wird.
function parseViewBox(svg) {
  const match = svg && svg.match(/viewBox="([\d.\s]+)"/);
  if (match) {
    const parts = match[1].trim().split(/\s+/).map(Number);
    if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }
  return { width: 1200, height: 1600 };
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

// Zusätzlich zu localStorage (offline, sofort verfügbar) auch nach Supabase
// schreiben, damit Eltern den Fortschritt geräteübergreifend sehen können.
// Fire-and-forget: schlägt der Sync fehl (z.B. kein Netz), bleibt die App für
// das Kind trotzdem voll nutzbar, es fehlt nur der Eltern-Seite dieser Versuch.
// Nur bei Erfolg wird "synced" im localStorage-Eintrag gesetzt – das macht
// backfillUnsyncedProgress() unten sicher wiederholbar (kein doppelter Upload).
function syncAttempt(kidId, file, worksheetMeta, progress) {
  if (!supabaseClient) return;
  supabaseClient
    .from("attempts")
    .insert({
      kid_id: kidId,
      worksheet_file: file,
      bereich: worksheetMeta?.bereich || null,
      woche: worksheetMeta?.woche || null,
      correct_count: progress.correctCount,
      total: progress.total,
      answers: progress.answers,
      completed_at: progress.completedAt || new Date().toISOString(),
    })
    .then(({ error }) => {
      if (error) {
        console.warn("Konnte Ergebnis nicht synchronisieren:", error);
        return;
      }
      saveProgress(kidId, file, { ...progress, synced: true });
    });
}

// Fortschritt nachträglich hochladen, der lokal schon fertig ist, aber noch
// nie erfolgreich synchronisiert wurde – z.B. weil ein Kind heute schon
// Aufgaben gelöst hat, bevor dieses Update (oder eine Internetverbindung)
// auf dem Tablet verfügbar war. Läuft bei jedem Öffnen der Kind-Seite mit
// und ist dank des "synced"-Flags idempotent, also gefahrlos wiederholbar.
function backfillUnsyncedProgress(kidId, worksheets) {
  worksheets.forEach((ws) => {
    const progress = loadProgress(kidId, ws.file);
    if (!progress || progress.synced || !progress.total || progress.correctCount == null) return;
    syncAttempt(kidId, ws.file, { bereich: ws.bereich, woche: ws.woche }, progress);
  });
}

// ---------- Schritt 1: Kind wählen -> Bild-Einstiegsseite oder Liste ----------
async function selectKid(kid) {
  currentKid = kid;

  showPicker();
  els.puzzlePicker.hidden = true;
  els.classicPicker.hidden = false;
  els.pickerHint.textContent = "Aufgaben werden geladen …";
  els.worksheetList.innerHTML = "";

  const indexPath = new URL(`data/${kid.id}/index.json`, APP_BASE);

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
          const wRes = await fetch(new URL(`data/${kid.id}/${file}`, APP_BASE), { cache: "no-store" });
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
    backfillUnsyncedProgress(kid.id, valid);
    await setupPickerView(kid, index, valid);
  } catch (err) {
    els.pickerHint.textContent = "Für dich sind noch keine Aufgaben vorbereitet. Frag einen Erwachsenen! 🙈";
  }
}

// ---------- Einstiegsseite: Wochenbild-Puzzle (bevorzugt) oder klassische Liste ----------
async function setupPickerView(kid, index, worksheets) {
  currentBild = null;
  currentWeekFiles = [];

  if (index.aktuellesBild) {
    try {
      const res = await fetch(new URL(`data/${kid.id}/${index.aktuellesBild}`, APP_BASE), { cache: "no-store" });
      if (!res.ok) throw new Error("Kein Wochenbild gefunden");
      currentBild = await res.json();
    } catch {
      currentBild = null;
    }
  }

  if (currentBild) {
    // Jedes Arbeitsblatt dieser Woche ist ein Puzzle-Teil – unabhängig davon, wie
    // sich die Woche auf die Bereiche verteilt (z.B. 2 Lesen + 2 Rechnen).
    currentWeekFiles = worksheets
      .filter((ws) => ws.woche === currentBild.woche)
      .sort((a, b) => a.file.localeCompare(b.file));
  }

  if (currentBild && currentWeekFiles.length > 0) {
    // Bild-Einstiegsseite: nur das Bild, Aufgaben stecken in den anklickbaren Teilen.
    els.puzzlePicker.hidden = false;
    els.puzzleImage.innerHTML = currentBild.svg || "";
    const vb = parseViewBox(currentBild.svg);
    els.puzzleFrame.style.aspectRatio = `${vb.width} / ${vb.height}`;
    renderPuzzleGrid();

    const backlog = worksheets.filter((ws) => !currentWeekFiles.includes(ws));
    els.classicPicker.hidden = true;
    els.backlogToggle.hidden = backlog.length === 0;
    els.backlogToggle.textContent = "📚 Weitere Übungen";
    els.pickerHint.textContent = "Weitere Übungen zum Vertiefen:";
    renderWorksheetList(backlog);
  } else {
    // Fallback: kein Wochenbild vorhanden (z.B. Marlene) -> klassische Liste wie bisher.
    els.puzzlePicker.hidden = true;
    els.classicPicker.hidden = false;
    els.backlogToggle.hidden = true;
    els.pickerHint.textContent = "Wähle eine Aufgabe aus:";
    renderWorksheetList(worksheets);
  }
}

function renderPuzzleGrid() {
  if (!currentBild) return;

  els.puzzleGrid.innerHTML = "";
  let allDone = currentWeekFiles.length > 0;

  currentWeekFiles.forEach((ws) => {
    const total = (worksheetCache[ws.file]?.aufgaben || []).length;
    const progress = loadProgress(currentKid.id, ws.file);
    const correct = progress ? progress.correctCount : 0;
    const fraction = total > 0 ? Math.min(correct / total, 1) : 0;
    if (fraction < 1) allDone = false;

    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "puzzle-tile" + (fraction >= 1 ? " done" : "");
    tile.setAttribute("aria-label", `${ws.titel} – ${correct} von ${total} richtig`);
    tile.innerHTML = `
      <span class="puzzle-tile-scrim" style="opacity: ${1 - fraction}"></span>
      <span class="puzzle-tile-content">
        <span>${BEREICH_ICONS[ws.bereich] || "❓"}</span>
        <span class="puzzle-tile-label">${escapeHtml(bereichLabel(ws.bereich).replace(/^\S+\s/, ""))}</span>
        <span class="puzzle-tile-fraction">${correct}/${total}</span>
      </span>
    `;
    tile.addEventListener("click", () => openWorksheet(ws.file));
    els.puzzleGrid.appendChild(tile);
  });

  els.puzzleFrame.classList.toggle("complete", allDone);
  els.puzzleDownloadBtn.hidden = !allDone;
}

function downloadPuzzleImage() {
  if (!currentBild?.svg || !currentKid) return;

  const { width: vbWidth, height: vbHeight } = parseViewBox(currentBild.svg);

  const targetLongSide = 3300; // hochauflösend genug für iPad-Hintergrund oder A4-Druck (~280dpi)
  const scale = targetLongSide / Math.max(vbWidth, vbHeight);
  const width = Math.round(vbWidth * scale);
  const height = Math.round(vbHeight * scale);

  const svgBlob = new Blob([currentBild.svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);
  const img = new Image();

  img.onload = () => {
    const canvas = els.puzzleCanvas;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);

    canvas.toBlob((blob) => {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `${currentKid.name}-bild-${currentBild.woche || "aktuell"}.png`;
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
    card.dataset.taskId = task.id;

    const savedAnswer = saved?.answers?.[task.id] ?? "";

    // Bereits beantwortete Aufgaben sofort als richtig/falsch markieren, damit
    // das Kind beim erneuten Öffnen direkt sieht, was noch zu korrigieren ist –
    // ohne extra "Fertig"-Klick und ohne die Eingabe zu sperren.
    let initialState = "";
    if (savedAnswer !== "") {
      initialState = normalizeAnswer(savedAnswer) === normalizeAnswer(task.loesung) ? " correct" : " wrong";
    }
    card.className = "task-card" + initialState;

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

  const progress = {
    answers,
    correctCount,
    total: currentTasks.length,
    completedAt: new Date().toISOString(),
  };
  saveProgress(currentKid.id, currentFile, progress);
  syncAttempt(currentKid.id, currentFile, currentWorksheet, progress);

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
els.backlogToggle.addEventListener("click", () => {
  const nowHidden = !els.classicPicker.hidden;
  els.classicPicker.hidden = nowHidden;
  els.backlogToggle.textContent = nowHidden ? "📚 Weitere Übungen" : "🧩 Übungen ausblenden";
});

// ---------- Start ----------
// Jede Kind-Seite trägt ihre feste Kind-ID am <body> (data-kid-id) statt einer
// Namensschild-Auswahl – so hat jedes Kind seine eigene Seite (/tj/, /mj/).
const activeKid = KIDS.find((k) => k.id === document.body.dataset.kidId);
selectKid(activeKid);
