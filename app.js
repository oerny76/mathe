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
  lueckenToggle: document.getElementById("luecken-toggle"),
  lueckenPanel: document.getElementById("luecken-panel"),
  lueckenList: document.getElementById("luecken-list"),
  sprintStartBtn: document.getElementById("sprint-start-btn"),
  sprintTodayHint: document.getElementById("sprint-today-hint"),
  sprintView: document.getElementById("sprint-view"),
  sprintTimer: document.getElementById("sprint-timer"),
  sprintTaskCard: document.getElementById("sprint-task-card"),
  sprintQuestion: document.getElementById("sprint-question"),
  sprintInput: document.getElementById("sprint-input"),
  sprintStopBtn: document.getElementById("sprint-stop-btn"),
  sprintSummary: document.getElementById("sprint-summary"),
  sprintSummaryBanner: document.getElementById("sprint-summary-banner"),
  sprintSummaryClose: document.getElementById("sprint-summary-close"),
  sprintTrendRow: document.getElementById("sprint-trend-row"),
  sprintTrendCompare: document.getElementById("sprint-trend-compare"),
  sprintWeakNote: document.getElementById("sprint-weak-note"),
  sprintDetailsToggle: document.getElementById("sprint-details-toggle"),
  sprintDetailsPanel: document.getElementById("sprint-details-panel"),
  sprintDetailsList: document.getElementById("sprint-details-list"),
  weeklyUsageHint: document.getElementById("weekly-usage-hint"),
};

// Fester Eltern-Code, um eine einzelne Antwort manuell als richtig zu werten
// (z.B. wenn die Auto-Prüfung eine korrekte Eingabe fälschlich ablehnt). Zum
// Ändern hier direkt im Code (in GitHub editierbar) einen neuen vierstelligen
// Zahlencode eintragen.
const PARENT_OVERRIDE_CODE = "4711";

let currentKid = null;
let currentFile = null;
let currentTasks = [];
let currentWorksheet = null;
let currentBild = null; // aktuelles Wochenbild (Puzzle-Gamification)
let currentWeekFiles = []; // Arbeitsblätter (file+bereich) der aktuellen Wochenbild-Woche, ein Eintrag pro Puzzle-Teil
let worksheetCache = {}; // file -> geladenes JSON (vermeidet doppelte fetches)
let lueckenByFile = new Map(); // file -> {bereich, correct_count, total}, für die "Wo stehe ich?"-Übersicht

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

// ---------- "Wo stehe ich?": Erfolgsquote pro Bereich (Lücken-Übersicht) ----------
// Nutzt dieselbe Supabase-Tabelle wie die Eltern-Übersicht, aber aggregiert nach
// Bereich statt nach Arbeitsblatt, damit das Kind sieht, wo es schon stark ist
// und wo sich Üben lohnt – unabhängig davon, ob das jeweilige Arbeitsblatt noch
// in der aktuellen Wochenauswahl steht oder längst aus index.json verschwunden ist.
async function loadAttempts(kid) {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from("attempts")
    .select("worksheet_file, bereich, correct_count, total, completed_at")
    .eq("kid_id", kid.id)
    .order("completed_at", { ascending: true });

  if (error) {
    console.warn("Konnte Lücken-Übersicht nicht laden:", error);
    return [];
  }
  return data || [];
}

function computeBereichStats(latestByFile) {
  const sums = new Map();
  latestByFile.forEach((entry) => {
    if (!entry.bereich || !entry.total) return;
    const s = sums.get(entry.bereich) || { correct: 0, total: 0 };
    s.correct += entry.correct_count;
    s.total += entry.total;
    sums.set(entry.bereich, s);
  });

  const orderedKeys = [
    ...BEREICH_ORDER.filter((key) => sums.has(key)),
    ...[...sums.keys()].filter((key) => !BEREICH_ORDER.includes(key)).sort(),
  ];

  return orderedKeys.map((key) => {
    const { correct, total } = sums.get(key);
    return { bereich: key, correct, total, pct: Math.round((correct / total) * 100) };
  });
}

function lueckenLevel(pct) {
  if (pct >= 85) return { level: "strong", emoji: "💪", text: "Stark!" };
  if (pct >= 60) return { level: "mid", emoji: "🙂", text: "Auf gutem Weg" };
  return { level: "weak", emoji: "🌱", text: "Hier üben wir noch" };
}

function renderLueckenPanel(stats) {
  els.lueckenList.innerHTML = "";

  // Schwächster Bereich zuerst, damit das Kind sofort sieht, wo Üben sich lohnt.
  [...stats]
    .sort((a, b) => a.pct - b.pct)
    .forEach((s) => {
      const tag = lueckenLevel(s.pct);
      const row = document.createElement("div");
      row.className = "luecken-row";
      row.innerHTML = `
        <div class="luecken-row-head">
          <span class="luecken-row-label">${BEREICH_ICONS[s.bereich] || "❓"} ${escapeHtml(
            bereichLabel(s.bereich).replace(/^\S+\s/, "")
          )}</span>
          <span class="luecken-row-tag">${tag.emoji} ${tag.text}</span>
        </div>
        <div class="luecken-bar"><div class="luecken-bar-fill ${tag.level}" style="width: ${s.pct}%"></div></div>
      `;
      els.lueckenList.appendChild(row);
    });
}

function updateLueckenPanel() {
  const stats = computeBereichStats(lueckenByFile);
  renderLueckenPanel(stats);
  els.lueckenToggle.hidden = stats.length === 0;
}

async function initLueckenPanel(kid) {
  const attempts = await loadAttempts(kid);
  attempts.forEach((a) => {
    lueckenByFile.set(a.worksheet_file, { bereich: a.bereich, correct_count: a.correct_count, total: a.total });
  });
  updateLueckenPanel();
}

// ---------- Wochen-Übeziel (z.B. "4 Tage reichen") ----------
// Keine Sperre, nur ein freundlicher Hinweis: Übt das Kind an so vielen
// Kalendertagen einer Woche, wie WEEKLY_USAGE_TARGET vorgibt, zeigt die App
// das lobend an. Alles danach ist freiwillige Extra-Übung, die App bleibt
// an jedem Tag voll nutzbar. Zählt sowohl abgeschlossene Arbeitsblätter
// (checkAnswers) als auch Kopfrechnen-Sprints mit mindestens einer Aufgabe.
const WEEKLY_USAGE_TARGET = 4;

// Gleiche ISO-Kalenderwochen-Berechnung wie in eltern/app.js, damit die
// Wochengrenze (Montag bis Sonntag) überall gleich gezogen wird.
function isoWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function usageWeekKey(kidId) {
  return `mathe-pwa:${kidId}:usage-week:${isoWeekString(new Date())}`;
}

function loadUsageDays(kidId) {
  try {
    const raw = localStorage.getItem(usageWeekKey(kidId));
    const days = raw ? JSON.parse(raw) : [];
    return Array.isArray(days) ? days : [];
  } catch (e) {
    return [];
  }
}

function markUsageDay(kidId) {
  const days = loadUsageDays(kidId);
  const today = todayDateStr();
  if (!days.includes(today)) {
    days.push(today);
    try {
      localStorage.setItem(usageWeekKey(kidId), JSON.stringify(days));
    } catch (e) {
      console.warn("Konnte Übungstag nicht speichern:", e);
    }
  }
  updateWeeklyUsageHint();
}

function updateWeeklyUsageHint() {
  if (!currentKid) return;
  const count = loadUsageDays(currentKid.id).length;

  if (count === 0) {
    els.weeklyUsageHint.hidden = true;
    return;
  }

  els.weeklyUsageHint.hidden = false;
  if (count >= WEEKLY_USAGE_TARGET) {
    els.weeklyUsageHint.textContent = `🎉 Super, diese Woche hast du schon an ${count} Tagen geübt. Alles weitere ist freiwillige Extra-Übung!`;
  } else {
    els.weeklyUsageHint.textContent = `Diese Woche schon an ${count} von ${WEEKLY_USAGE_TARGET} Tagen geübt. Weiter so!`;
  }
}

// ---------- Tägliches Kopfrechnen (10-Minuten-Sprint) ----------
// Lose, ständig neue Kopfrechenaufgaben statt eines festen Arbeitsblatts: Das
// Kind übt 10 Minuten am Stück. Die Hauptmeldung am Ende zeigt bewusst nur
// die Anzahl richtig gelöster Aufgaben (nicht "X von Y"), damit nichts
// demotiviert – Details, Verlauf und Schwachstellen gibt's nur auf Wunsch
// über den "Details ansehen"-Button darunter. Rein clientseitig mit
// localStorage (kein Supabase-Tabellen-Update nötig) und bewusst NICHT Teil
// der "Wo stehe ich?"-Auswertung, da offenes Dauerüben sonst die
// Bereichs-Erfolgsquote verzerren würde.
const SPRINT_DURATION_MS = 10 * 60 * 1000;
const SPRINT_MAX_LEVEL = 12;
const SPRINT_LEVEL_UP_MIN_ATTEMPTS = 12;
const SPRINT_LEVEL_UP_ACCURACY = 0.85;
const SPRINT_HISTORY_DAYS = 7; // für Trend-Anzeige und Schwachstellen-Erkennung
const SPRINT_WEAK_MIN_ATTEMPTS = 4; // Mindestanzahl Versuche eines Typs, bevor er als "schwach" gilt
const SPRINT_WEAK_THRESHOLD = 0.7; // Trefferquote darunter = Übungsbedarf
const SPRINT_WEAK_WEIGHT = 3; // wie viel häufiger der schwache Typ im nächsten Sprint vorkommt

let sprintTimerHandle = null;
let sprintEndAt = null;
let sprintLevel = 1;
let sprintTask = null;
let sprintTaskLog = []; // {typ, frage, loesung, gegeben, richtig} je Aufgabe dieser Runde
let sprintWeakType = null; // zu Rundenbeginn ermittelt, bleibt für die ganze Runde gleich

function sprintLevelKey(kidId) {
  return `mathe-pwa:${kidId}:sprint-level`;
}

function sprintResultKey(kidId, dateStr) {
  return `mathe-pwa:${kidId}:sprint:${dateStr}`;
}

function todayDateStr() {
  return new Date().toISOString().slice(0, 10);
}

function loadSprintLevel(kidId) {
  const raw = localStorage.getItem(sprintLevelKey(kidId));
  const n = raw ? parseInt(raw, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function saveSprintLevel(kidId, level) {
  try {
    localStorage.setItem(sprintLevelKey(kidId), String(level));
  } catch (e) {
    console.warn("Konnte Kopfrechnen-Level nicht speichern:", e);
  }
}

function loadSprintResult(kidId, dateStr) {
  try {
    const raw = localStorage.getItem(sprintResultKey(kidId, dateStr));
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function loadTodaySprintResult(kidId) {
  return loadSprintResult(kidId, todayDateStr());
}

function saveTodaySprintResult(kidId, result) {
  try {
    localStorage.setItem(sprintResultKey(kidId, todayDateStr()), JSON.stringify(result));
  } catch (e) {
    console.warn("Konnte Kopfrechnen-Ergebnis nicht speichern:", e);
  }
}

// Letzte N Tage mit Ergebnis (nicht zwingend lückenlos, nur Tage an denen
// tatsächlich geübt wurde), älteste zuerst – für Trend & Schwachstellen.
function loadRecentSprintResults(kidId, days) {
  const results = [];
  for (let i = 0; i < days; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const result = loadSprintResult(kidId, d.toISOString().slice(0, 10));
    if (result) results.push(result);
  }
  return results.reverse();
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Jeder Eintrag erzeugt für ein gegebenes Level {frage, loesung}. Level 1 =
// Einstieg, bewusst eine Stufe unter dem normalen Wochen-Kopfrechnen-
// Arbeitsblatt, damit das Kind "wieder reinkommt" – steigt langsam an. "typ"
// + "label" werden für Verlauf/Schwachstellen-Auswertung mitgeloggt.
const SPRINT_GENERATORS = [
  {
    typ: "verdoppeln",
    label: "Verdoppeln",
    generate: (level) => {
      const n = randInt(5, 15 + level * 10);
      return { frage: `Verdopple ${n}. Wie viel ist das?`, loesung: String(n * 2) };
    },
  },
  {
    typ: "halbieren",
    label: "Halbieren",
    generate: (level) => {
      const n = randInt(2, 8 + level * 6) * 2;
      return { frage: `Halbiere ${n}. Wie viel ist das?`, loesung: String(n / 2) };
    },
  },
  {
    typ: "addition",
    label: "Plus-Aufgaben",
    generate: (level) => {
      const max = level <= 2 ? 50 : level <= 4 ? 200 : level <= 7 ? 1000 : 10000;
      const a = randInt(Math.round(max / 4), max);
      const b = randInt(Math.round(max / 4), max);
      return { frage: `${a} + ${b} = ?`, loesung: String(a + b) };
    },
  },
  {
    typ: "subtraktion",
    label: "Minus-Aufgaben",
    generate: (level) => {
      const max = level <= 2 ? 50 : level <= 4 ? 200 : level <= 7 ? 1000 : 10000;
      const a = randInt(Math.round(max / 2), max);
      const b = randInt(1, a - 1);
      return { frage: `${a} − ${b} = ?`, loesung: String(a - b) };
    },
  },
  {
    typ: "einmaleins",
    label: "Einmaleins",
    generate: (level) => {
      const maxFactor = Math.min(4 + level, 20);
      const a = randInt(2, maxFactor);
      const b = randInt(2, maxFactor);
      return { frage: `${a} × ${b} = ?`, loesung: String(a * b) };
    },
  },
  {
    typ: "ergaenzen",
    label: "Ergänzen",
    generate: (level) => {
      const ziel = level <= 2 ? 100 : level <= 5 ? 500 : level <= 8 ? 1000 : 10000;
      const n = randInt(1, ziel - 1);
      return { frage: `Ergänze ${n} auf ${ziel}. Wie viel fehlt?`, loesung: String(ziel - n) };
    },
  },
];

function sprintGeneratorLabel(typ) {
  const entry = SPRINT_GENERATORS.find((g) => g.typ === typ);
  return entry ? entry.label : typ;
}

// Ermittelt den Aufgaben-Typ mit der niedrigsten Trefferquote über die
// letzten SPRINT_HISTORY_DAYS Tage (erst ab SPRINT_WEAK_MIN_ATTEMPTS
// Versuchen aussagekräftig), oder null wenn nichts auffällig schwach ist.
function computeWeakSprintType(kidId) {
  const sessions = loadRecentSprintResults(kidId, SPRINT_HISTORY_DAYS);
  const statsByTyp = {};
  sessions.forEach((session) => {
    (session.tasks || []).forEach((t) => {
      if (!statsByTyp[t.typ]) statsByTyp[t.typ] = { correct: 0, attempted: 0 };
      statsByTyp[t.typ].attempted++;
      if (t.richtig) statsByTyp[t.typ].correct++;
    });
  });

  let weakest = null;
  let weakestRate = SPRINT_WEAK_THRESHOLD;
  Object.entries(statsByTyp).forEach(([typ, s]) => {
    if (s.attempted < SPRINT_WEAK_MIN_ATTEMPTS) return;
    const rate = s.correct / s.attempted;
    if (rate < weakestRate) {
      weakestRate = rate;
      weakest = typ;
    }
  });
  return weakest;
}

// Wählt den nächsten Aufgaben-Typ zufällig, gewichtet aber den erkannten
// Schwachpunkt höher, damit darin gezielt mehr geübt wird.
function pickSprintGenerator() {
  const weighted = [];
  SPRINT_GENERATORS.forEach((gen) => {
    const weight = gen.typ === sprintWeakType ? SPRINT_WEAK_WEIGHT : 1;
    for (let i = 0; i < weight; i++) weighted.push(gen);
  });
  return weighted[randInt(0, weighted.length - 1)];
}

function nextSprintTask() {
  const gen = pickSprintGenerator();
  const { frage, loesung } = gen.generate(sprintLevel);
  sprintTask = { typ: gen.typ, frage, loesung };
  els.sprintQuestion.textContent = sprintTask.frage;
  els.sprintInput.value = "";
  els.sprintInput.disabled = false;
  els.sprintTaskCard.classList.remove("correct", "wrong");
  els.sprintInput.focus();
}

function updateSprintTimerDisplay() {
  const remaining = sprintEndAt - Date.now();
  if (remaining <= 0) {
    endSprint();
    return;
  }
  const totalSeconds = Math.ceil(remaining / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  els.sprintTimer.textContent = `${m}:${String(s).padStart(2, "0")}`;
}

function submitSprintAnswer() {
  if (!sprintTask || els.sprintInput.disabled) return;
  const given = els.sprintInput.value;
  const expected = normalizeAnswer(sprintTask.loesung);
  const isCorrect = normalizeAnswer(given) !== "" && normalizeAnswer(given) === expected;

  sprintTaskLog.push({ typ: sprintTask.typ, frage: sprintTask.frage, loesung: sprintTask.loesung, gegeben: given, richtig: isCorrect });

  els.sprintTaskCard.classList.add(isCorrect ? "correct" : "wrong");
  els.sprintInput.disabled = true;

  setTimeout(() => {
    if (sprintEndAt && Date.now() < sprintEndAt) nextSprintTask();
  }, 500);
}

function startSprint() {
  if (!currentKid) return;
  sprintLevel = loadSprintLevel(currentKid.id);
  sprintWeakType = computeWeakSprintType(currentKid.id);
  sprintTaskLog = [];
  sprintEndAt = Date.now() + SPRINT_DURATION_MS;

  els.picker.hidden = true;
  els.view.hidden = true;
  els.sprintSummary.hidden = true;
  els.sprintView.hidden = false;

  nextSprintTask();
  updateSprintTimerDisplay();
  sprintTimerHandle = setInterval(updateSprintTimerDisplay, 250);
}

function endSprint() {
  if (sprintTimerHandle) clearInterval(sprintTimerHandle);
  sprintTimerHandle = null;
  sprintEndAt = null;

  const correct = sprintTaskLog.filter((t) => t.richtig).length;
  const attempted = sprintTaskLog.length;

  if (attempted > 0) markUsageDay(currentKid.id);

  saveTodaySprintResult(currentKid.id, {
    date: todayDateStr(),
    correct,
    attempted,
    level: sprintLevel,
    tasks: sprintTaskLog,
  });

  if (attempted >= SPRINT_LEVEL_UP_MIN_ATTEMPTS && correct / attempted >= SPRINT_LEVEL_UP_ACCURACY) {
    saveSprintLevel(currentKid.id, Math.min(sprintLevel + 1, SPRINT_MAX_LEVEL));
  }

  els.sprintView.hidden = true;
  els.sprintSummary.hidden = false;
  els.sprintSummaryBanner.classList.remove("needs-practice");
  els.sprintSummaryBanner.textContent =
    correct > 0
      ? `🎉 Super gemacht! Du hast heute ${correct} Aufgabe${correct === 1 ? "" : "n"} geschafft.`
      : `Das war ein guter Versuch! Morgen klappt's bestimmt noch besser. 💪`;

  renderSprintTrend(currentKid.id);
  renderSprintDetails({ date: todayDateStr(), correct, attempted, level: sprintLevel, tasks: sprintTaskLog });
  els.sprintDetailsPanel.hidden = true;
  els.sprintDetailsToggle.hidden = attempted === 0;
  els.sprintDetailsToggle.textContent = "📋 Details ansehen";

  updateSprintTodayHint();
}

function stopSprint() {
  if (sprintTimerHandle) clearInterval(sprintTimerHandle);
  sprintTimerHandle = null;
  sprintEndAt = null;
  els.sprintView.hidden = true;
  showPicker();
}

function updateSprintTodayHint() {
  if (!currentKid) return;
  const result = loadTodaySprintResult(currentKid.id);
  if (result) {
    els.sprintTodayHint.hidden = false;
    els.sprintTodayHint.textContent = `Heute schon geschafft: ${result.correct} Aufgabe${result.correct === 1 ? "" : "n"} ✅`;
  } else {
    els.sprintTodayHint.hidden = true;
  }
}

// ---------- Sprint-Zusammenfassung: Trend + Details (nur auf Wunsch sichtbar) ----------
function renderSprintTrend(kidId) {
  const sessions = loadRecentSprintResults(kidId, SPRINT_HISTORY_DAYS); // älteste zuerst, inkl. heute
  els.sprintTrendRow.innerHTML = "";

  if (sessions.length < 2) {
    els.sprintTrendCompare.hidden = true;
  } else {
    const today = sessions[sessions.length - 1];
    const yesterday = sessions[sessions.length - 2];
    let arrow = "➡️";
    let text = "gleich geblieben";
    if (today.correct > yesterday.correct) {
      arrow = "📈";
      text = "stärker geworden";
    } else if (today.correct < yesterday.correct) {
      arrow = "📉";
      text = "etwas weniger als letztes Mal";
    }
    els.sprintTrendCompare.hidden = false;
    els.sprintTrendCompare.textContent = `${arrow} Letztes Mal ${yesterday.correct}, heute ${today.correct} – ${text}.`;
  }

  const maxCorrect = Math.max(1, ...sessions.map((s) => s.correct));
  sessions.forEach((s) => {
    const bar = document.createElement("div");
    bar.className = "sprint-trend-bar";
    const heightPct = Math.round((s.correct / maxCorrect) * 100);
    const day = new Date(s.date).toLocaleDateString("de-DE", { weekday: "short" });
    bar.innerHTML = `
      <span class="sprint-trend-bar-value">${s.correct}</span>
      <span class="sprint-trend-bar-fill" style="height: ${Math.max(heightPct, 6)}%"></span>
      <span class="sprint-trend-bar-day">${day}</span>
    `;
    els.sprintTrendRow.appendChild(bar);
  });

  if (sprintWeakType) {
    els.sprintWeakNote.hidden = false;
    els.sprintWeakNote.textContent = `💡 Beim Thema "${sprintGeneratorLabel(sprintWeakType)}" hakt's gerade öfter – davon kommt morgen etwas mehr dran.`;
  } else {
    els.sprintWeakNote.hidden = true;
  }
}

function renderSprintDetails(session) {
  els.sprintDetailsList.innerHTML = "";

  const summary = document.createElement("p");
  summary.className = "sprint-details-summary";
  summary.textContent = `${session.correct} von ${session.attempted} Aufgaben richtig.`;
  els.sprintDetailsList.appendChild(summary);

  const wrongTasks = (session.tasks || []).filter((t) => !t.richtig);
  if (wrongTasks.length === 0) {
    const allRight = document.createElement("p");
    allRight.className = "subtitle";
    allRight.textContent = session.attempted > 0 ? "Alles richtig gelöst! 🎉" : "Keine Aufgabe bearbeitet.";
    els.sprintDetailsList.appendChild(allRight);
    return;
  }

  const heading = document.createElement("p");
  heading.className = "sprint-details-heading";
  heading.textContent = "Diese Aufgaben waren noch knifflig:";
  els.sprintDetailsList.appendChild(heading);

  wrongTasks.forEach((t) => {
    const row = document.createElement("div");
    row.className = "sprint-detail-row";
    row.innerHTML = `
      <span class="sprint-detail-frage">${escapeHtml(t.frage)}</span>
      <span class="sprint-detail-answers">deine Antwort: ${escapeHtml(t.gegeben || "–")} · richtig: ${escapeHtml(t.loesung)}</span>
    `;
    els.sprintDetailsList.appendChild(row);
  });
}

// ---------- Schritt 1: Kind wählen -> Bild-Einstiegsseite oder Liste ----------
async function selectKid(kid) {
  currentKid = kid;
  initLueckenPanel(kid); // läuft unabhängig von den Arbeitsblättern im Hintergrund mit
  updateSprintTodayHint();
  updateWeeklyUsageHint();

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
      const isCorrect = normalizeAnswer(savedAnswer) === normalizeAnswer(task.loesung) || !!saved?.overrides?.[task.id];
      initialState = isCorrect ? " correct" : " wrong";
    }
    card.className = "task-card" + initialState;

    // Nur bei rein numerischen Lösungen das Ziffernfeld erzwingen (z.B. "27"
    // oder "-3,5") – bei Text-Antworten (Leseverständnis, aber auch
    // Knobelaufgaben wie "spitz"/"stumpf") sonst blockiert das iPad die
    // Buchstabentastatur komplett.
    const isNumericAnswer = /^-?\d+([.,]\d+)?$/.test(String(task.loesung).trim());

    card.innerHTML = `
      <span class="task-number">Aufgabe ${index + 1} von ${currentTasks.length}</span>
      <p class="task-question">${escapeHtml(task.frage)}</p>
      <div class="task-input-row">
        <input
          type="text"
          inputmode="${isNumericAnswer ? "decimal" : "text"}"
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
      <div class="parent-override">
        <button type="button" class="parent-override-toggle" data-task-id="${task.id}">👪 Eltern: als richtig werten</button>
        <div class="parent-override-form" hidden>
          <input type="text" inputmode="numeric" maxlength="4" placeholder="Code" class="parent-override-code" />
          <button type="button" class="parent-override-confirm">OK</button>
          <span class="parent-override-error" hidden>Falscher Code</span>
        </div>
      </div>
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

  els.taskList.querySelectorAll(".parent-override-toggle").forEach((btn) => {
    btn.addEventListener("click", () => {
      const form = btn.nextElementSibling;
      form.hidden = !form.hidden;
      if (!form.hidden) form.querySelector(".parent-override-code").focus();
    });
  });

  els.taskList.querySelectorAll(".parent-override-confirm").forEach((btn) => {
    btn.addEventListener("click", () => confirmParentOverride(btn));
  });

  els.taskList.querySelectorAll(".parent-override-code").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") confirmParentOverride(input.closest(".parent-override-form").querySelector(".parent-override-confirm"));
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
  // Frühere Eltern-Korrekturen (siehe applyParentOverride) bleiben auch über
  // ein "Nochmal versuchen" hinweg als richtig gewertet, solange die Aufgabe
  // nicht neu beantwortet wird.
  const previous = loadProgress(currentKid.id, currentFile);
  const overrides = { ...(previous?.overrides || {}) };

  let correctCount = 0;
  const answers = {};

  currentTasks.forEach((task) => {
    const input = els.taskList.querySelector(`input[data-task-id="${task.id}"]`);
    const card = input.closest(".task-card");
    const given = normalizeAnswer(input.value);
    const expected = normalizeAnswer(task.loesung);

    answers[task.id] = input.value;

    card.classList.remove("correct", "wrong");
    if ((given !== "" && given === expected) || overrides[task.id]) {
      card.classList.add("correct");
      correctCount++;
    } else {
      card.classList.add("wrong");
    }
    input.disabled = true;
  });

  const progress = {
    answers,
    overrides,
    correctCount,
    total: currentTasks.length,
    completedAt: new Date().toISOString(),
  };
  saveProgress(currentKid.id, currentFile, progress);
  syncAttempt(currentKid.id, currentFile, currentWorksheet, progress);
  markUsageDay(currentKid.id);
  lueckenByFile.set(currentFile, {
    bereich: currentWorksheet?.bereich || null,
    correct_count: correctCount,
    total: currentTasks.length,
  });
  updateLueckenPanel();

  showResult(correctCount, currentTasks.length);
  els.checkBtn.hidden = true;
  els.retryBtn.hidden = false;

  if (currentBild) renderPuzzleGrid();
}

// ---------- Eltern-Korrektur einzelner Antworten ----------
// Fällt eine eigentlich richtige Antwort z.B. durch einen Eingabe-/Vergleichsfehler
// als "falsch" auf, können Eltern direkt an dieser Aufgabe mit dem festen Code
// (siehe PARENT_OVERRIDE_CODE oben) manuell auf "richtig" umstellen.
function confirmParentOverride(confirmBtn) {
  const form = confirmBtn.closest(".parent-override-form");
  const codeInput = form.querySelector(".parent-override-code");
  const errorEl = form.querySelector(".parent-override-error");
  const card = confirmBtn.closest(".task-card");
  const taskId = card.dataset.taskId;

  if (codeInput.value.trim() !== PARENT_OVERRIDE_CODE) {
    errorEl.hidden = false;
    codeInput.value = "";
    codeInput.focus();
    return;
  }

  errorEl.hidden = true;
  form.hidden = true;
  codeInput.value = "";
  card.classList.remove("wrong");
  card.classList.add("correct");
  applyParentOverride(taskId);
}

function applyParentOverride(taskId) {
  const progress = loadProgress(currentKid.id, currentFile) || {
    answers: {},
    correctCount: 0,
    total: currentTasks.length,
  };
  progress.overrides = progress.overrides || {};
  if (progress.overrides[taskId]) return; // bereits als richtig gewertet

  progress.overrides[taskId] = true;
  progress.correctCount = (progress.correctCount || 0) + 1;
  progress.total = currentTasks.length;
  progress.completedAt = new Date().toISOString();

  saveProgress(currentKid.id, currentFile, progress);
  syncAttempt(currentKid.id, currentFile, currentWorksheet, progress);
  lueckenByFile.set(currentFile, {
    bereich: currentWorksheet?.bereich || null,
    correct_count: progress.correctCount,
    total: progress.total,
  });
  updateLueckenPanel();

  if (!els.resultBanner.hidden) {
    showResult(progress.correctCount, progress.total);
  }
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
els.lueckenToggle.addEventListener("click", () => {
  const nowHidden = !els.lueckenPanel.hidden;
  els.lueckenPanel.hidden = nowHidden;
  els.lueckenToggle.textContent = nowHidden ? "📊 Wo stehe ich?" : "🧩 Ausblenden";
});
els.sprintStartBtn.addEventListener("click", startSprint);
els.sprintStopBtn.addEventListener("click", stopSprint);
els.sprintSummaryClose.addEventListener("click", () => {
  els.sprintSummary.hidden = true;
  showPicker();
});
els.sprintDetailsToggle.addEventListener("click", () => {
  const nowHidden = !els.sprintDetailsPanel.hidden;
  els.sprintDetailsPanel.hidden = nowHidden;
  els.sprintDetailsToggle.textContent = nowHidden ? "📋 Details ansehen" : "🧩 Details ausblenden";
});
els.sprintInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitSprintAnswer();
});

// ---------- Start ----------
// Jede Kind-Seite trägt ihre feste Kind-ID am <body> (data-kid-id) statt einer
// Namensschild-Auswahl – so hat jedes Kind seine eigene Seite (/tj/, /mj/).
const activeKid = KIDS.find((k) => k.id === document.body.dataset.kidId);
selectKid(activeKid);
