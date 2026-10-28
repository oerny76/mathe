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
  codeGate: document.getElementById("code-gate"),
  gateInput: document.getElementById("gate-input"),
  gateBtn: document.getElementById("gate-btn"),
  gateError: document.getElementById("gate-error"),
  settingsToggle: document.getElementById("settings-toggle"),
  settingsPanel: document.getElementById("settings-panel"),
  settingsLock: document.getElementById("settings-lock"),
  settingsCode: document.getElementById("settings-code"),
  settingsCodeOk: document.getElementById("settings-code-ok"),
  settingsCodeError: document.getElementById("settings-code-error"),
  settingsContent: document.getElementById("settings-content"),
  settingsGradeInfo: document.getElementById("settings-grade-info"),
  settingsLowerGrade: document.getElementById("settings-lower-grade"),
  extraArt: document.getElementById("extra-art"),
  extraMinutes: document.getElementById("extra-minutes"),
  extraDay: document.getElementById("extra-day"),
  extraTeile: document.getElementById("extra-teile"),
  outsourcedPicker: document.getElementById("outsourced-picker"),
  outsourcedList: document.getElementById("outsourced-list"),
  extraAddBtn: document.getElementById("extra-add-btn"),
  extraFeedback: document.getElementById("extra-feedback"),
  extraSyncState: document.getElementById("extra-sync-state"),
  extraList: document.getElementById("extra-list"),
  streakPill: document.getElementById("streak-pill"),
  streakDetails: document.getElementById("streak-details"),
  weekDays: document.getElementById("week-days"),
  streakMain: document.getElementById("streak-main"),
  streakWeeks: document.getElementById("streak-weeks"),
  streakSub: document.getElementById("streak-sub"),
  starCounter: document.getElementById("star-counter"),
  starNext: document.getElementById("star-next"),
  toast: document.getElementById("toast"),
  worldOpenBtn: document.getElementById("world-open-btn"),
  worldView: document.getElementById("world-view"),
  worldBackBtn: document.getElementById("world-back-btn"),
  worldTitle: document.getElementById("world-title"),
  worldTotal: document.getElementById("world-total"),
  worldGrid: document.getElementById("world-grid"),
  resultsOpenBtn: document.getElementById("results-open-btn"),
  resultsView: document.getElementById("results-view"),
  resultsBackBtn: document.getElementById("results-back-btn"),
  resultsList: document.getElementById("results-list"),
  redoView: document.getElementById("redo-view"),
  redoProgress: document.getElementById("redo-progress"),
  redoTaskCard: document.getElementById("redo-task-card"),
  redoQuestion: document.getElementById("redo-question"),
  redoInput: document.getElementById("redo-input"),
  redoChoices: document.getElementById("redo-choices"),
  redoSolution: document.getElementById("redo-solution"),
  redoCheckBtn: document.getElementById("redo-check-btn"),
  redoStopBtn: document.getElementById("redo-stop-btn"),
  redoSummary: document.getElementById("redo-summary"),
};

// Eltern-Code (nur per geprüfter Datenbankfunktion, nie im Code): schaltet die
// Einstellungen frei und erlaubt, eine einzelne Antwort als richtig zu werten
// (z.B. wenn die Auto-Prüfung eine korrekte Eingabe fälschlich ablehnt). Er
// bleibt nur für die laufende Sitzung im Speicher dieses Tabs.
function parentToken() {
  try {
    return sessionStorage.getItem("mathe-parent-token") || "";
  } catch (e) {
    return "";
  }
}

function setParentToken(code) {
  try {
    if (code) sessionStorage.setItem("mathe-parent-token", code);
    else sessionStorage.removeItem("mathe-parent-token");
  } catch (e) {
    // egal
  }
}

// Prüft den Eltern-PIN (4 bis 8 Ziffern) oder den langen Eltern-Code bei der
// Datenbank. Liefert { ok, token } oder { ok: false, offline | locked }.
// Beim PIN ist token eine 8 Stunden gültige Sitzung, nicht der PIN selbst.
async function unlockParent(raw) {
  const text = String(raw || "").trim();
  if (!text) return { ok: false };
  if (/^\d{4,8}$/.test(text)) {
    const { data, error } = await callRpcOpen("app_pin_login", { p_pin: text });
    if (error) return { ok: false, offline: !!error.offline };
    if (data && data.ok) return { ok: true, token: data.token };
    return { ok: false, locked: !!(data && data.gesperrt) };
  }
  const code = normalizeCode(text);
  const { data, error } = await callRpc("app_eltern_check", {}, code);
  if (error) return { ok: false, offline: !!error.offline };
  return data === true ? { ok: true, token: code } : { ok: false };
}

function parentProblemText(result) {
  if (result.offline) return "Keine Verbindung. Bitte mit Internet nochmal versuchen.";
  if (result.locked) return "Zu viele Versuche. Bitte in 15 Minuten nochmal oder den langen Eltern-Code nehmen.";
  return "Falscher PIN oder Code";
}

let currentKid = null;
let currentFile = null;
let currentTasks = [];
let currentWorksheet = null;
let currentBild = null; // aktuelles Wochenbild (Puzzle-Gamification)
let currentWeekFiles = []; // Arbeitsblätter (file+bereich) der aktuellen Wochenbild-Woche, ein Eintrag pro Puzzle-Teil
let currentIndex = null; // index.json des aktuellen Kindes
let currentWorksheetList = []; // alle geladenen Arbeitsblatt-Metadaten, für "Meine Ergebnisse"
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
  noteLocalChange();
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
  const token = loadToken(kidId);
  if (!token) return;
  callRpc(
    "app_attempt_add",
    {
      p_kid: kidId,
      p_file: file,
      p_bereich: worksheetMeta?.bereich || null,
      p_woche: worksheetMeta?.woche || null,
      p_correct: progress.correctCount,
      p_total: progress.total,
      p_answers: progress.answers,
      p_completed_at: progress.completedAt || new Date().toISOString(),
    },
    token
  ).then(({ error }) => {
    if (error) {
      if (isInvalidCode(error)) handleInvalidToken();
      else console.warn("Konnte Ergebnis nicht synchronisieren:", error);
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
  const token = loadToken(kid.id);
  if (!token) return [];
  const { data, error } = await callRpc("app_attempts_list", { p_kid: kid.id, p_since: RESET_EPOCH }, token);
  if (error) {
    if (isInvalidCode(error)) handleInvalidToken();
    else console.warn("Konnte Lücken-Übersicht nicht laden:", error);
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

// ---------- Klassenstufe + "eine Stufe tiefer" (Eltern-Einstellung) ----------
// Jedes Kind hat eine Klassenstufe (KIDS[].klasse aus shared.js). Eltern können
// per Code einstellen, dass eine Stufe tiefer geübt wird (z.B. zum Auffrischen).
// Die Einstellung gilt pro Gerät (localStorage).
function gradeOffsetKey(kidId) {
  return `mathe-pwa:${kidId}:grade-offset`;
}

function loadGradeOffset(kidId) {
  try {
    return localStorage.getItem(gradeOffsetKey(kidId)) === "1" ? 1 : 0;
  } catch (e) {
    return 0;
  }
}

function saveGradeOffset(kidId, offset) {
  try {
    localStorage.setItem(gradeOffsetKey(kidId), String(offset));
    localStorage.setItem(`${gradeOffsetKey(kidId)}-at`, new Date().toISOString());
  } catch (e) {
    console.warn("Konnte Einstellung nicht speichern:", e);
  }
  noteLocalChange();
}

function effectiveGrade(kid) {
  return Math.max(1, (kid.klasse || 4) - loadGradeOffset(kid.id));
}

function renderSettings() {
  const offset = loadGradeOffset(currentKid.id);
  els.settingsLowerGrade.checked = offset === 1;
  els.settingsGradeInfo.textContent = `Klassenstufe von ${currentKid.name}: ${currentKid.klasse}. Aktuell wird auf Stufe ${effectiveGrade(currentKid)} geübt.`;
}

function toggleSettings() {
  const opening = els.settingsPanel.hidden;
  els.settingsPanel.hidden = !opening;
  if (!opening) setParentToken("");
  if (opening) {
    els.settingsLock.hidden = false;
    els.settingsContent.hidden = true;
    els.settingsCodeError.hidden = true;
    els.settingsCode.value = "";
  }
}

async function unlockSettings() {
  els.settingsCodeError.hidden = true;
  const result = await unlockParent(els.settingsCode.value);
  if (!result.ok) {
    els.settingsCodeError.textContent = parentProblemText(result);
    els.settingsCodeError.hidden = false;
    els.settingsCode.value = "";
    return;
  }
  setParentToken(result.token);
  els.settingsCode.value = "";
  els.settingsLock.hidden = true;
  els.settingsContent.hidden = false;
  renderSettings();
  setupExtraForm();
}

// ---------- Wochen-Streak ----------
// Eine Woche zählt für den Streak, wenn an mindestens STREAK_MIN_DAYS Tagen
// geübt wurde. Der Streak ist die Zahl aufeinanderfolgender Wochen, die zählen
// (die laufende Woche zählt mit, sobald sie geschafft ist, sie bricht den
// Streak aber nie vorzeitig). Streak-Schutz: Pro Kalendermonat darf eine
// verpasste Woche überbrückt werden, ohne dass der Streak reißt. Alles wird
// aus den gespeicherten Übungstagen berechnet, es gibt keinen eigenen Zähler.
const STREAK_MIN_DAYS = 3;
const STREAK_BONUS_STARS = 10;
const STREAK_LOOKBACK_WEEKS = 52;
const STREAK_CHIPS = 6;

function weekInfo(weeksAgo) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() || 7) - 1) - 7 * weeksAgo); // Montag dieser Woche, dann zurück
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  return { week: isoWeekString(d), month, kw: isoWeekString(d).split("-W")[1] };
}

function firstUsageWeek(kidId) {
  const prefix = `mathe-pwa:${kidId}:usage-week:`;
  let first = null;
  try {
    Object.keys(localStorage).forEach((k) => {
      if (!k.startsWith(prefix)) return;
      const week = k.slice(prefix.length);
      if (!first || week < first) first = week;
    });
  } catch (e) {
    return null;
  }
  extraDays(kidId).forEach((day) => {
    const week = weekOfDay(day);
    if (!first || week < first) first = week;
  });
  return first;
}

function computeStreak(kidId) {
  const first = firstUsageWeek(kidId);
  const now = weekInfo(0);
  const currentDays = loadUsageDaysFor(kidId, now.week).length;
  const currentDone = currentDays >= STREAK_MIN_DAYS;

  const weeks = [{ kw: now.kw, status: currentDone ? "done" : "open" }];
  let streak = currentDone ? 1 : 0;
  const jokerMonths = new Set();
  let broken = false;

  for (let i = 1; i <= STREAK_LOOKBACK_WEEKS && !broken; i++) {
    const info = weekInfo(i);
    if (!first || info.week < first) break;
    if (loadUsageDaysFor(kidId, info.week).length >= STREAK_MIN_DAYS) {
      streak++;
      weeks.push({ kw: info.kw, status: "done" });
    } else if (!jokerMonths.has(info.month)) {
      jokerMonths.add(info.month);
      weeks.push({ kw: info.kw, status: "bridged" });
    } else {
      broken = true;
      weeks.push({ kw: info.kw, status: "missed" });
    }
  }

  return {
    streak,
    currentDays,
    currentDone,
    jokerUsedThisMonth: jokerMonths.has(now.month),
    weeks: weeks.slice(0, STREAK_CHIPS).reverse(), // älteste zuerst, aktuelle Woche zuletzt
  };
}

const STREAK_CHIP_ICONS = { done: "🔥", open: "⏳", bridged: "🛡️", missed: "▫️" };

function updateStreakDisplay() {
  if (!currentKid) return;
  const info = computeStreak(currentKid.id);

  els.streakMain.textContent = `🔥 ${info.streak}`;

  els.streakWeeks.innerHTML = "";
  info.weeks.forEach((w) => {
    const chip = document.createElement("span");
    chip.className = `streak-chip ${w.status}`;
    chip.innerHTML = `<span class="streak-chip-icon">${STREAK_CHIP_ICONS[w.status]}</span><span class="streak-chip-kw">KW ${w.kw}</span>`;
    els.streakWeeks.appendChild(chip);
  });

  els.streakSub.textContent = info.jokerUsedThisMonth
    ? "🛡️ Dein Streak-Schutz ist diesen Monat schon im Einsatz."
    : "🛡️ Streak-Schutz: Eine verpasste Woche pro Monat ist okay.";
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

function loadLocalUsageDaysFor(kidId, weekStr) {
  try {
    const raw = localStorage.getItem(`mathe-pwa:${kidId}:usage-week:${weekStr}`);
    const days = raw ? JSON.parse(raw) : [];
    return Array.isArray(days) ? days : [];
  } catch (e) {
    return [];
  }
}

// Übungstage einer Woche: in der App geübt (dieses Gerät) plus Extra-Übungen
// (geräteübergreifend synchronisiert).
function loadUsageDaysFor(kidId, weekStr) {
  const extra = extraDays(kidId).filter((day) => weekOfDay(day) === weekStr);
  return [...new Set([...loadLocalUsageDaysFor(kidId, weekStr), ...extra])];
}

function loadUsageDays(kidId) {
  return loadUsageDaysFor(kidId, isoWeekString(new Date()));
}

function markUsageDay(kidId) {
  const days = loadLocalUsageDaysFor(kidId, isoWeekString(new Date()));
  const today = todayDateStr();
  if (!days.includes(today)) {
    days.push(today);
    try {
      localStorage.setItem(usageWeekKey(kidId), JSON.stringify(days));
    } catch (e) {
      console.warn("Konnte Übungstag nicht speichern:", e);
    }
    noteLocalChange();
  }
  updateWeeklyUsageHint();

  const kid = KIDS.find((k) => k.id === kidId);
  if (kid) checkStreakBonus(kid, isoWeekString(new Date()));
}

function checkStreakBonus(kid, weekStr) {
  if (loadUsageDaysFor(kid.id, weekStr).length >= STREAK_MIN_DAYS) {
    awardKeyed(kid, [{ key: `week:${weekStr}`, value: STREAK_BONUS_STARS }], "🔥 Streak-Woche geschafft!");
  }
}

function updateWeeklyUsageHint() {
  if (!currentKid) return;
  updateStreakDisplay();
  const count = loadUsageDays(currentKid.id).length;
  els.weekDays.textContent = `📅 ${count}/${WEEKLY_USAGE_TARGET}`;

  let text;
  if (count >= WEEKLY_USAGE_TARGET) {
    text = "🎉 Wochenziel erreicht! Alles Weitere ist freiwillige Extra-Übung.";
  } else if (count >= STREAK_MIN_DAYS) {
    text = "Streak-Woche geschafft ✅ Noch ein Tag bis zum Wochenziel.";
  } else {
    const missing = STREAK_MIN_DAYS - count;
    text = `Noch ${missing} Tag${missing === 1 ? "" : "e"} üben, dann zählt die Woche für deinen Streak.`;
  }
  els.weeklyUsageHint.hidden = false;
  els.weeklyUsageHint.textContent = text;
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
const SPRINT_MAX_LEVEL = 6; // Stufen innerhalb einer Klassenstufe
const SPRINT_LEVEL_UP_MIN_ATTEMPTS = 12;
const SPRINT_LEVEL_UP_ACCURACY = 0.85;
const SPRINT_HISTORY_DAYS = 7; // für Trend-Anzeige und Schwachstellen-Erkennung
const SPRINT_WEAK_MIN_ATTEMPTS = 4; // Mindestanzahl Versuche eines Typs, bevor er als "schwach" gilt
const SPRINT_WEAK_THRESHOLD = 0.7; // Trefferquote darunter = Übungsbedarf
const SPRINT_WEAK_WEIGHT = 3; // wie viel häufiger der schwache Typ im nächsten Sprint vorkommt

let sprintTimerHandle = null;
let sprintEndAt = null;
let sprintLevel = 1;
let sprintGrade = 4; // Klassenstufe, auf der in dieser Runde geübt wird
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
  noteLocalChange();
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
  noteLocalChange();
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
// Klassenstufe -> Grundlevel für die Zahlenbereiche der Grundaufgaben. Das
// Kind-Level (1 bis SPRINT_MAX_LEVEL) steigert innerhalb der Klassenstufe.
const GRADE_LEVEL_BONUS = { 1: 0, 2: 0, 3: 2, 4: 4, 5: 5 };

function gradeLevelBonus(grade) {
  return grade >= 6 ? 6 : GRADE_LEVEL_BONUS[grade] ?? 0;
}

function pickOne(list) {
  return list[randInt(0, list.length - 1)];
}

// Dezimalzahl mit Komma darstellen, ganze Zahlen ohne ",0".
function formatTenths(n) {
  const v = n / 10;
  return Number.isInteger(v) ? String(v) : v.toFixed(1).replace(".", ",");
}

const MINUS = "\u2212";

// generate(eff, sub): eff = Zahlenbereich-Level (Klassenstufe + Kind-Level),
// sub = Kind-Level innerhalb der Klassenstufe (1 bis SPRINT_MAX_LEVEL).
// minGrade/maxGrade begrenzen, ab/bis welcher Klassenstufe ein Typ vorkommt.
const SPRINT_GENERATORS = [
  {
    typ: "verdoppeln",
    label: "Verdoppeln",
    maxGrade: 5,
    generate: (level) => {
      const n = randInt(5, 15 + level * 10);
      return { frage: `Verdopple ${n}. Wie viel ist das?`, loesung: String(n * 2) };
    },
  },
  {
    typ: "halbieren",
    label: "Halbieren",
    maxGrade: 5,
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
      return { frage: `${a} ${MINUS} ${b} = ?`, loesung: String(a - b) };
    },
  },
  {
    typ: "einmaleins",
    label: "Einmaleins",
    generate: (level) => {
      const maxFactor = Math.min(4 + level, 20);
      const a = randInt(2, maxFactor);
      const b = randInt(2, maxFactor);
      return { frage: `${a} \u00d7 ${b} = ?`, loesung: String(a * b) };
    },
  },
  {
    typ: "ergaenzen",
    label: "Ergänzen",
    maxGrade: 5,
    generate: (level) => {
      const ziel = level <= 2 ? 100 : level <= 5 ? 500 : level <= 8 ? 1000 : 10000;
      const n = randInt(1, ziel - 1);
      return { frage: `Ergänze ${n} auf ${ziel}. Wie viel fehlt?`, loesung: String(ziel - n) };
    },
  },
  {
    typ: "dezimal",
    label: "Dezimalzahlen",
    minGrade: 5,
    generate: (eff, sub) => {
      const max = 50 + sub * 50;
      if (Math.random() < 0.3) {
        const a = randInt(11, max);
        return { frage: `${formatTenths(a)} \u00d7 10 = ?`, loesung: String(a) };
      }
      const a = randInt(11, max);
      const b = randInt(11, max);
      if (Math.random() < 0.5) {
        return { frage: `${formatTenths(a)} + ${formatTenths(b)} = ?`, loesung: formatTenths(a + b) };
      }
      const big = Math.max(a, b);
      const small = Math.min(a, b);
      return { frage: `${formatTenths(big)} ${MINUS} ${formatTenths(small)} = ?`, loesung: formatTenths(big - small) };
    },
  },
  {
    typ: "bruch",
    label: "Brüche",
    minGrade: 6,
    generate: (eff, sub) => {
      const nenner = pickOne([2, 3, 4, 5, 8, 10]);
      const zaehler = randInt(1, nenner - 1);
      const basis = nenner * randInt(1, 4 + sub * 2);
      return { frage: `Wie viel ist ${zaehler}/${nenner} von ${basis}?`, loesung: String((basis / nenner) * zaehler) };
    },
  },
  {
    typ: "prozent",
    label: "Prozent",
    minGrade: 6,
    generate: (eff, sub) => {
      const p = pickOne([5, 10, 20, 25, 50, 75]);
      const basis = 20 * randInt(1, 5 + sub * 5);
      return { frage: `${p} % von ${basis} = ?`, loesung: String((basis * p) / 100) };
    },
  },
  {
    typ: "quadrat",
    label: "Quadratzahlen und Wurzeln",
    minGrade: 6,
    generate: (eff, sub) => {
      const n = randInt(3, 10 + sub);
      return Math.random() < 0.5
        ? { frage: `${n}\u00b2 = ?`, loesung: String(n * n) }
        : { frage: `\u221a${n * n} = ?`, loesung: String(n) };
    },
  },
  {
    typ: "negativ",
    label: "Negative Zahlen",
    minGrade: 6,
    generate: (eff, sub) => {
      const variant = randInt(0, 4);
      if (variant === 0) {
        const a = randInt(1, 10 + sub * 5);
        const b = randInt(a + 1, a + 10 + sub * 5);
        return { frage: `${MINUS}${a} + ${b} = ?`, loesung: String(b - a) };
      }
      if (variant === 1) {
        const a = randInt(1, 15);
        const b = randInt(a + 1, 20 + sub * 10);
        return { frage: `${a} ${MINUS} ${b} = ?`, loesung: String(a - b) };
      }
      if (variant === 2) {
        const a = randInt(2, 12);
        const b = randInt(2, 12);
        return { frage: `(${MINUS}${a}) \u00d7 ${b} = ?`, loesung: String(-a * b) };
      }
      if (variant === 3) {
        const a = randInt(2, 12);
        const b = randInt(2, 12);
        return { frage: `(${MINUS}${a}) \u00d7 (${MINUS}${b}) = ?`, loesung: String(a * b) };
      }
      const a = randInt(2, 12);
      const b = randInt(2, 12);
      return { frage: `${a * b} : (${MINUS}${b}) = ?`, loesung: String(-a) };
    },
  },
  {
    typ: "term",
    label: "Terme und Gleichungen",
    minGrade: 7,
    generate: (eff, sub) => {
      const a = randInt(2, 9);
      if (Math.random() < 0.5) {
        const b = randInt(1, 9);
        const x = randInt(-4, 4 + sub);
        const plus = Math.random() < 0.5;
        const wert = plus ? a * x + b : a * x - b;
        const xText = x < 0 ? `${MINUS}${-x}` : String(x);
        return { frage: `Berechne ${a}x ${plus ? "+" : MINUS} ${b} für x = ${xText}.`, loesung: String(wert) };
      }
      const b = randInt(1, 9);
      const x = randInt(1, 6 + sub);
      return { frage: `Löse: ${a}x + ${b} = ${a * x + b}. Wie groß ist x?`, loesung: String(x) };
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
  SPRINT_GENERATORS.filter((gen) => sprintGrade >= (gen.minGrade || 0) && sprintGrade <= (gen.maxGrade || 99)).forEach(
    (gen) => {
      const weight = gen.typ === sprintWeakType ? SPRINT_WEAK_WEIGHT : 1;
      for (let i = 0; i < weight; i++) weighted.push(gen);
    }
  );
  return weighted[randInt(0, weighted.length - 1)];
}

function nextSprintTask() {
  const gen = pickSprintGenerator();
  const { frage, loesung } = gen.generate(sprintLevel + gradeLevelBonus(sprintGrade), sprintLevel);
  sprintTask = { typ: gen.typ, frage, loesung };
  els.sprintQuestion.textContent = sprintTask.frage;
  els.sprintInput.inputMode = /^\d+([.,]\d+)?$/.test(sprintTask.loesung) ? "decimal" : "text";
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
  sprintGrade = effectiveGrade(currentKid);
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
  awardSprintStars(currentKid, correct);

  saveTodaySprintResult(currentKid.id, {
    date: todayDateStr(),
    correct,
    attempted,
    level: sprintLevel,
    grade: sprintGrade,
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
  updateStarDisplay();
  syncExtras(kid);
  syncState(kid);

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

    // Blätter kommender Wochen (auf Vorrat erzeugt) erscheinen erst, wenn ihre
    // Woche beginnt, damit nichts vorab gelöst wird.
    const thisWeek = isoWeekString(new Date());
    const valid = worksheets
      .filter(Boolean)
      .filter((ws) => !ws.woche || ws.woche <= thisWeek)
      .sort((a, b) => (a.erstellt < b.erstellt ? 1 : -1));
    currentIndex = index;
    currentWorksheetList = valid;
    backfillUnsyncedProgress(kid.id, valid);
    await setupPickerView(kid, index, valid);
  } catch (err) {
    els.pickerHint.textContent = "Für dich sind noch keine Aufgaben vorbereitet. Frag einen Erwachsenen! 🙈";
  }
}

// ---------- Einstiegsseite: Wochenbild-Puzzle (bevorzugt) oder klassische Liste ----------
// Wochenbild der laufenden Woche: "bilder" in index.json listet die Dateien
// (Name beginnt mit der Woche, z.B. "2026-W45-bild.json"). Gewählt wird das
// neueste, das nicht in der Zukunft liegt. Ohne passende Datei gilt weiter
// "aktuellesBild".
function pickBildFile(index) {
  const thisWeek = isoWeekString(new Date());
  const candidates = (index.bilder || [])
    .map((file) => ({ file, woche: (file.match(/^(\d{4}-W\d{2})-/) || [])[1] }))
    .filter((b) => b.woche && b.woche <= thisWeek)
    .sort((a, b) => (a.woche < b.woche ? 1 : -1));
  return candidates.length ? candidates[0].file : index.aktuellesBild || null;
}

async function setupPickerView(kid, index, worksheets) {
  currentBild = null;
  currentWeekFiles = [];

  const bildFile = pickBildFile(index);
  if (bildFile) {
    try {
      const res = await fetch(new URL(`data/${kid.id}/${bildFile}`, APP_BASE), { cache: "no-store" });
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

  renderPickerSections(worksheets);
}

// Bild-Einstiegsseite oder klassische Liste neu zeichnen (ohne das Bild neu zu
// laden), z.B. wenn Bildteile freigeschaltet wurden.
function renderPickerSections(worksheets) {
  if (currentBild && currentWeekFiles.length > 0) {
    // Bild-Einstiegsseite: nur das Bild, Aufgaben stecken in den anklickbaren Teilen.
    els.puzzlePicker.hidden = false;
    els.puzzleImage.innerHTML = currentBild.svg || "";
    const vb = parseViewBox(currentBild.svg);
    els.puzzleFrame.style.aspectRatio = `${vb.width} / ${vb.height}`;
    renderPuzzleGrid();

    // Von den Eltern freigeschaltete Teile: ihre Blätter stehen direkt unter dem Bild.
    const unlocked = unlockedFiles(currentKid.id);
    const outsourced = currentWeekFiles.filter((ws) => unlocked.has(ws.file));
    els.outsourcedPicker.hidden = outsourced.length === 0;
    renderWorksheetList(outsourced, els.outsourcedList);

    const backlog = worksheets.filter((ws) => !currentWeekFiles.includes(ws));
    els.classicPicker.hidden = true;
    els.backlogToggle.hidden = backlog.length === 0;
    els.backlogToggle.textContent = "📚 Weitere Übungen";
    els.pickerHint.textContent = "Weitere Übungen zum Vertiefen:";
    renderWorksheetList(backlog);
  } else {
    // Fallback: kein Wochenbild vorhanden (z.B. Marlene) -> klassische Liste wie bisher.
    els.puzzlePicker.hidden = true;
    els.outsourcedPicker.hidden = true;
    els.classicPicker.hidden = false;
    els.backlogToggle.hidden = true;
    els.pickerHint.textContent = "Wähle eine Aufgabe aus:";
    renderWorksheetList(worksheets);
  }
}

function refreshPicker() {
  if (!currentKid || !currentIndex || els.picker.hidden) return;
  renderPickerSections(currentWorksheetList);
}

function renderPuzzleGrid() {
  if (!currentBild) return;

  els.puzzleGrid.innerHTML = "";
  let allDone = currentWeekFiles.length > 0;

  const unlocked = unlockedFiles(currentKid.id);
  currentWeekFiles.forEach((ws) => {
    const total = (worksheetCache[ws.file]?.aufgaben || []).length;
    const progress = loadProgress(currentKid.id, ws.file);
    const correct = progress ? progress.correctCount : 0;
    const free = unlocked.has(ws.file);
    const fraction = free ? 1 : total > 0 ? Math.min(correct / total, 1) : 0;
    if (fraction < 1) allDone = false;

    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "puzzle-tile" + (fraction >= 1 ? " done" : "") + (free ? " unlocked" : "");
    tile.disabled = free;
    tile.setAttribute("aria-label", free ? `${ws.titel}: von den Eltern freigeschaltet` : `${ws.titel} – ${correct} von ${total} richtig`);
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

function renderWorksheetList(worksheets, target = els.worksheetList) {
  target.innerHTML = "";

  const hasBereiche = worksheets.some((ws) => ws.bereich);
  if (!hasBereiche) {
    worksheets.forEach((ws) => target.appendChild(renderWorksheetCard(ws)));
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
    target.appendChild(heading);

    const group = document.createElement("div");
    group.className = "bereich-group";
    groups.get(key).forEach((ws) => group.appendChild(renderWorksheetCard(ws)));
    target.appendChild(group);
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
    // Negative Lösungen brauchen das Minuszeichen, das die iPad-Zifferntastatur
    // (inputmode "decimal") nicht hat, deshalb dort normale Tastatur.
    const isNumericAnswer = /^\d+([.,]\d+)?$/.test(String(task.loesung).trim());

    // Aufgaben mit "optionen" (z.B. Lesetexte) werden per Auswahl beantwortet
    // statt per Tippen: Ein verstecktes Feld hält die gewählte Antwort, damit
    // Auswertung und Speicherung unverändert funktionieren.
    const hasChoices = Array.isArray(task.optionen) && task.optionen.length >= 2;
    if (hasChoices) {
      card.innerHTML = `
        <span class="task-number">Aufgabe ${index + 1} von ${currentTasks.length}</span>
        <p class="task-question">${escapeHtml(task.frage)}</p>
        <div class="task-input-row">
          <div class="choice-group" role="radiogroup"></div>
          <input type="hidden" data-task-id="${task.id}" />
          <span class="task-mark" aria-hidden="true"></span>
        </div>
      `;
      const hiddenInput = card.querySelector("input");
      hiddenInput.value = String(savedAnswer);
      const group = card.querySelector(".choice-group");
      task.optionen.forEach((option) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "choice-btn";
        btn.textContent = option;
        btn.setAttribute("role", "radio");
        const selected = savedAnswer !== "" && normalizeAnswer(option) === normalizeAnswer(savedAnswer);
        btn.classList.toggle("selected", selected);
        btn.setAttribute("aria-checked", String(selected));
        btn.addEventListener("click", () => {
          hiddenInput.value = option;
          card.classList.remove("correct", "wrong");
          group.querySelectorAll(".choice-btn").forEach((other) => {
            const isThis = other === btn;
            other.classList.toggle("selected", isThis);
            other.setAttribute("aria-checked", String(isThis));
          });
        });
        group.appendChild(btn);
      });
      els.taskList.appendChild(card);
      return;
    }

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
          <input type="password" autocomplete="off" placeholder="Eltern-PIN" class="parent-override-code" />
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
  const text = String(value).trim().replace(/\u2212/g, "-").replace(",", ".").toLowerCase();
  // Zahlen vereinheitlichen, damit "12,0", "12.0" und "12" als gleich gelten.
  return /^-?\d+(\.\d+)?$/.test(text) ? String(Number(text)) : text;
}

function checkAnswers() {
  // Frühere Eltern-Korrekturen (siehe applyParentOverride) bleiben auch über
  // ein "Nochmal versuchen" hinweg als richtig gewertet, solange die Aufgabe
  // nicht neu beantwortet wird.
  const previous = loadProgress(currentKid.id, currentFile);
  const overrides = { ...(previous?.overrides || {}) };

  let correctCount = 0;
  const answers = {};
  const starEntries = [];

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
      starEntries.push({ key: `${currentFile}#${task.id}`, value: 1 });
    } else {
      card.classList.add("wrong");
    }
    input.disabled = true;
    card.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.disabled = true;
    });
  });

  if (correctCount === currentTasks.length) {
    starEntries.push({ key: `${currentFile}#perfect`, value: PERFECT_SHEET_BONUS });
  }
  awardKeyed(currentKid, starEntries);

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
// als "falsch" auf, können Eltern direkt an dieser Aufgabe mit dem Eltern-Code
// (wird bei der Datenbank geprüft) manuell auf "richtig" umstellen.
async function confirmParentOverride(confirmBtn) {
  const form = confirmBtn.closest(".parent-override-form");
  const codeInput = form.querySelector(".parent-override-code");
  const errorEl = form.querySelector(".parent-override-error");
  const card = confirmBtn.closest(".task-card");
  const taskId = card.dataset.taskId;

  confirmBtn.disabled = true;
  const result = await unlockParent(codeInput.value);
  confirmBtn.disabled = false;
  if (!result.ok) {
    errorEl.textContent = parentProblemText(result);
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
  awardKeyed(currentKid, [{ key: `${currentFile}#${taskId}`, value: 1 }]);
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

// ---------- Spielstand-Synchronisierung (alle Geräte) ----------
// Der Stand jedes Kindes (Arbeitsblatt-Ergebnisse, Sterne, Übungstage,
// Kopfrechnen, Klassenstufen-Einstellung) liegt zusätzlich als ein JSON in der
// Supabase-Tabelle "kid_state" (siehe supabase/kid_state.sql). Jedes Gerät
// lädt ihn, führt ihn mit dem eigenen Stand zusammen (nichts geht verloren,
// weil fast alles nur wächst) und schreibt das Ergebnis zurück. Die App
// arbeitet weiter zuerst lokal, auch ohne Internet.
const STATE_SPRINT_DAYS = 30;
const stateSyncing = {};
let stateSyncTimer = null;
let stateApplying = false;

function noteLocalChange() {
  if (stateApplying) return;
  clearTimeout(stateSyncTimer);
  stateSyncTimer = setTimeout(() => {
    if (currentKid) syncState(currentKid);
  }, 1500);
}

function emptyState() {
  return { v: 1, resetVersion: RESET_VERSION, gradeOffset: { value: 0, at: "" }, sprint: { level: 1, sessions: {} }, stars: {}, usage: {}, progress: {} };
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function pruneSessions(sessions) {
  const days = Object.keys(sessions).sort().reverse().slice(0, STATE_SPRINT_DAYS);
  const out = {};
  days.forEach((day) => {
    out[day] = sessions[day];
  });
  return out;
}

function collectLocalState(kidId) {
  const state = emptyState();
  const prefix = `mathe-pwa:${kidId}:`;
  state.stars = loadStars(kidId).ledger;
  state.gradeOffset = {
    value: loadGradeOffset(kidId),
    at: localStorage.getItem(`${gradeOffsetKey(kidId)}-at`) || "",
  };
  state.sprint.level = loadSprintLevel(kidId);
  Object.keys(localStorage).forEach((key) => {
    if (!key.startsWith(prefix)) return;
    const rest = key.slice(prefix.length);
    if (rest.startsWith("sprint:")) {
      const session = parseJson(localStorage.getItem(key));
      if (session) state.sprint.sessions[rest.slice("sprint:".length)] = session;
    } else if (rest.startsWith("usage-week:")) {
      const days = parseJson(localStorage.getItem(key));
      if (Array.isArray(days)) state.usage[rest.slice("usage-week:".length)] = days;
    } else if (rest.endsWith(".json")) {
      const progress = parseJson(localStorage.getItem(key));
      if (progress && progress.total != null) {
        const { synced, ...clean } = progress;
        state.progress[rest] = clean;
      }
    }
  });
  state.sprint.sessions = pruneSessions(state.sprint.sessions);
  return state;
}

function betterSession(a, b) {
  if (!a) return b;
  if (!b) return a;
  if ((a.attempted || 0) !== (b.attempted || 0)) return (a.attempted || 0) > (b.attempted || 0) ? a : b;
  return (a.correct || 0) >= (b.correct || 0) ? a : b;
}

function mergeStates(a, b) {
  const out = emptyState();
  out.gradeOffset = (b.gradeOffset?.at || "") > (a.gradeOffset?.at || "") ? b.gradeOffset : a.gradeOffset || out.gradeOffset;
  out.sprint.level = Math.max(a.sprint?.level || 1, b.sprint?.level || 1);

  const sessions = {};
  new Set([...Object.keys(a.sprint?.sessions || {}), ...Object.keys(b.sprint?.sessions || {})]).forEach((day) => {
    sessions[day] = betterSession(a.sprint?.sessions?.[day], b.sprint?.sessions?.[day]);
  });
  out.sprint.sessions = pruneSessions(sessions);

  new Set([...Object.keys(a.stars || {}), ...Object.keys(b.stars || {})]).forEach((key) => {
    out.stars[key] = Math.max(a.stars?.[key] || 0, b.stars?.[key] || 0);
  });

  new Set([...Object.keys(a.usage || {}), ...Object.keys(b.usage || {})]).forEach((week) => {
    out.usage[week] = [...new Set([...(a.usage?.[week] || []), ...(b.usage?.[week] || [])])].sort();
  });

  new Set([...Object.keys(a.progress || {}), ...Object.keys(b.progress || {})]).forEach((file) => {
    const pa = a.progress?.[file];
    const pb = b.progress?.[file];
    if (!pa || !pb) out.progress[file] = pa || pb;
    else out.progress[file] = (pb.completedAt || "") > (pa.completedAt || "") ? pb : pa;
  });
  return out;
}

// Schreibt den zusammengeführten Stand in den lokalen Speicher. Gibt zurück,
// ob sich lokal etwas geändert hat.
function applyState(kidId, merged, localBefore) {
  const prefix = `mathe-pwa:${kidId}:`;
  stateApplying = true;
  try {
    localStorage.setItem(gradeOffsetKey(kidId), String(merged.gradeOffset.value ? 1 : 0));
    localStorage.setItem(`${gradeOffsetKey(kidId)}-at`, merged.gradeOffset.at || "");
    localStorage.setItem(sprintLevelKey(kidId), String(merged.sprint.level));
    localStorage.setItem(starsKey(kidId), JSON.stringify({ ledger: merged.stars }));
    Object.entries(merged.sprint.sessions).forEach(([day, session]) => {
      localStorage.setItem(sprintResultKey(kidId, day), JSON.stringify(session));
    });
    Object.entries(merged.usage).forEach(([week, days]) => {
      localStorage.setItem(`${prefix}usage-week:${week}`, JSON.stringify(days));
    });
    Object.entries(merged.progress).forEach(([file, progress]) => {
      const existing = loadProgress(kidId, file);
      if (existing && (existing.completedAt || "") >= (progress.completedAt || "")) return;
      localStorage.setItem(progressKey(kidId, file), JSON.stringify({ ...progress, synced: true }));
    });
  } catch (e) {
    console.warn("Konnte synchronisierten Stand nicht speichern:", e);
  } finally {
    stateApplying = false;
  }
  return stableStringify(collectLocalState(kidId)) !== stableStringify(localBefore);
}

function refreshAfterStateSync() {
  if (!currentKid) return;
  updateStarDisplay();
  updateWeeklyUsageHint();
  updateSprintTodayHint();
  if (currentIndex) {
    currentWorksheetList.forEach((ws) => {
      const progress = loadProgress(currentKid.id, ws.file);
      ws.erledigt = progress ? progress.correctCount === progress.total : false;
    });
    if (!els.picker.hidden) setupPickerView(currentKid, currentIndex, currentWorksheetList);
  }
}

async function syncState(kid) {
  const token = loadToken(kid.id);
  if (!token || stateSyncing[kid.id]) return false;
  stateSyncing[kid.id] = true;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      const { data: row, error } = await callRpc("app_state_get", { p_kid: kid.id }, token);
      if (error) {
        if (isInvalidCode(error)) handleInvalidToken();
        else if (!error.offline) console.warn("Konnte Spielstand nicht laden:", error);
        return false;
      }
      let remote = row && row.state && typeof row.state === "object" ? row.state : null;
      if (remote && (remote.resetVersion || "") > RESET_VERSION) return false; // App ist älter als der gespeicherte Stand
      const remoteUsable = remote && (remote.resetVersion || "") === RESET_VERSION;
      if (!remoteUsable) remote = emptyState();

      const local = collectLocalState(kid.id);
      const merged = mergeStates(remote, local);
      const changedLocal = applyState(kid.id, merged, local);

      if (!row || !remoteUsable || stableStringify(merged) !== stableStringify(remote)) {
        const { data: newVersion, error: putError } = await callRpc(
          "app_state_put",
          { p_kid: kid.id, p_state: merged, p_expected: row ? row.version : 0 },
          token
        );
        if (putError) {
          if (isInvalidCode(putError)) handleInvalidToken();
          else console.warn("Konnte Spielstand nicht speichern:", putError);
          return false;
        }
        if (newVersion == null) continue; // inzwischen von einem anderen Gerät geändert, nochmal zusammenführen
      }
      if (changedLocal) refreshAfterStateSync();
      return true;
    }
    return false;
  } finally {
    stateSyncing[kid.id] = false;
  }
}

// ---------- Extra-Übungen (außerhalb der App, z.B. Anton oder mit den Eltern) ----------
// Eltern tragen sie in den Einstellungen ein (Eltern-Code). Sterne richten sich
// nach der Zeit (10 Minuten = 5 Sterne, höchstens 20 pro Tag), ab 10 Minuten
// zählt der Tag für Wochenziel und Streak. Die Einträge liegen in der
// Supabase-Tabelle "extra_practice" (siehe supabase/extra_practice.sql) und
// werden so auf allen Geräten gleich angezeigt. Offline bleiben neue Einträge
// lokal "ausstehend" und werden später automatisch gesendet.
const EXTRA_MIN_DAY_MINUTES = 10;
const EXTRA_MINUTES_PER_STEP = 10;
const EXTRA_STARS_PER_STEP = 5;
const EXTRA_STARS_CAP_PER_DAY = 20;
const EXTRA_MAX_BACKDATE_DAYS = 7;
const EXTRA_ARTEN = { anton: "Anton", eltern: "Mit Eltern geübt", lesen: "Lesen", sonstiges: "Sonstiges" };
const extrasSyncing = {};

function extrasCacheKey(kidId) {
  return `mathe-pwa:${kidId}:extras-cache`;
}

function extrasPendingKey(kidId) {
  return `mathe-pwa:${kidId}:extras-pending`;
}

function readJsonList(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) ? value : [];
  } catch (e) {
    return [];
  }
}

function writeJsonList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {
    console.warn("Konnte Extra-Übungen nicht lokal speichern:", e);
  }
}

function newExtraId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 3) | 8).toString(16);
  });
}

function localDateStr(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function weekOfDay(day) {
  return isoWeekString(new Date(`${day}T12:00:00`));
}

// Server-Stand (Cache) plus noch nicht gesendete Einträge, neueste zuerst.
function loadExtras(kidId) {
  const resetDay = RESET_EPOCH.slice(0, 10);
  const byId = new Map();
  readJsonList(extrasCacheKey(kidId)).forEach((row) => byId.set(row.id, row));
  readJsonList(extrasPendingKey(kidId)).forEach((row) => byId.set(row.id, row));
  return [...byId.values()]
    .filter((row) => row.practiced_on >= resetDay)
    .sort((a, b) => (a.practiced_on === b.practiced_on ? (a.created_at < b.created_at ? 1 : -1) : a.practiced_on < b.practiced_on ? 1 : -1));
}

function extraMinutesByDay(kidId) {
  const byDay = new Map();
  loadExtras(kidId).forEach((row) => byDay.set(row.practiced_on, (byDay.get(row.practiced_on) || 0) + row.minutes));
  return byDay;
}

function extraDays(kidId) {
  return [...extraMinutesByDay(kidId)].filter(([, minutes]) => minutes >= EXTRA_MIN_DAY_MINUTES).map(([day]) => day);
}

function starsForExtraMinutes(minutes) {
  return Math.min(EXTRA_STARS_CAP_PER_DAY, Math.floor(minutes / EXTRA_MINUTES_PER_STEP) * EXTRA_STARS_PER_STEP);
}

function extraStarsTotal(kidId) {
  let total = 0;
  extraMinutesByDay(kidId).forEach((minutes) => {
    total += starsForExtraMinutes(minutes);
  });
  return total;
}

// Von den Eltern freigeschaltete Bildteile (Dateinamen der Blätter) aus allen
// Extra-Übungen. Löscht man den Eintrag, ist der Teil wieder gesperrt.
function unlockedFiles(kidId) {
  const files = new Set();
  loadExtras(kidId).forEach((row) => (row.teile || []).forEach((file) => files.add(file)));
  return files;
}

// Die nächsten noch offenen Teile des Wochenbilds in Puzzle-Reihenfolge.
function nextOpenTileFiles(kidId, count) {
  const unlocked = unlockedFiles(kidId);
  return currentWeekFiles
    .filter((ws) => {
      if (unlocked.has(ws.file)) return false;
      const total = (worksheetCache[ws.file]?.aufgaben || []).length;
      const progress = loadProgress(kidId, ws.file);
      return !(total > 0 && progress && progress.correctCount >= total);
    })
    .slice(0, count)
    .map((ws) => ws.file);
}

function totalStars(kidId) {
  return loadStars(kidId).total + extraStarsTotal(kidId);
}

// Nach Änderungen: Anzeigen auffrischen, neue Sterne/Funde melden, Streak-Bonus prüfen.
function afterExtrasChanged(kid, starsBefore, days) {
  updateStarDisplay();
  updateWeeklyUsageHint();
  refreshPicker();
  const gained = totalStars(kid.id) - starsBefore;
  if (gained > 0) {
    const after = starsBefore + gained;
    const newItems = kid.welt.items.filter((item) => starsBefore < item.ab && after >= item.ab);
    const found = newItems.length ? ` · 🎉 Neu in deiner Sammelwelt: ${newItems.map((i) => `${i.emoji} ${i.name}`).join(", ")}` : "";
    showToast(`⭐ +${gained} Sterne für die Extra-Übung${found}`, newItems.length ? 7000 : 3500);
  }
  new Set(days.map(weekOfDay)).forEach((week) => checkStreakBonus(kid, week));
}

async function syncExtras(kid) {
  const token = loadToken(kid.id);
  if (!token || extrasSyncing[kid.id]) return false;
  extrasSyncing[kid.id] = true;
  try {
    // Neue Einträge senden darf nur der Eltern-Code. Ohne ihn bleiben sie
    // "ausstehend", bis die Einstellungen das nächste Mal entsperrt werden.
    const parent = parentToken();
    let pending = readJsonList(extrasPendingKey(kid.id));
    for (const row of parent ? [...pending] : []) {
      const { error } = await callRpc(
        "app_extra_add",
        { p_kid: kid.id, p_id: row.id, p_day: row.practiced_on, p_minutes: row.minutes, p_art: row.art, p_teile: row.teile || [] },
        parent
      );
      if (error) {
        if (!error.offline) console.warn("Konnte Extra-Übung nicht senden:", error);
        break;
      }
      pending = pending.filter((p) => p.id !== row.id);
      writeJsonList(extrasPendingKey(kid.id), pending);
      writeJsonList(extrasCacheKey(kid.id), [...readJsonList(extrasCacheKey(kid.id)).filter((r) => r.id !== row.id), row]);
    }

    const { data, error } = await callRpc("app_extra_list", { p_kid: kid.id, p_since: RESET_EPOCH.slice(0, 10) }, token);
    if (error) {
      if (isInvalidCode(error)) handleInvalidToken();
      else if (!error.offline) console.warn("Konnte Extra-Übungen nicht laden:", error);
      return false;
    }
    writeJsonList(extrasCacheKey(kid.id), data || []);
    if (currentKid && currentKid.id === kid.id) {
      updateStarDisplay();
      updateWeeklyUsageHint();
      renderExtrasList();
      refreshPicker();
    }
    return true;
  } finally {
    extrasSyncing[kid.id] = false;
  }
}

async function addExtra(kid, art, minutes, day, teile = []) {
  const before = totalStars(kid.id);
  const row = { id: newExtraId(), kid_id: kid.id, practiced_on: day, minutes, art, teile, created_at: new Date().toISOString() };
  writeJsonList(extrasPendingKey(kid.id), [...readJsonList(extrasPendingKey(kid.id)), row]);
  afterExtrasChanged(kid, before, [day]);
  renderExtrasList();
  await syncExtras(kid);
  renderExtrasList();
}

async function deleteExtra(kid, id) {
  const pending = readJsonList(extrasPendingKey(kid.id));
  if (pending.some((row) => row.id === id)) {
    writeJsonList(extrasPendingKey(kid.id), pending.filter((row) => row.id !== id));
  } else {
    const { error } = await callRpc("app_extra_delete", { p_id: id }, parentToken());
    if (error) {
      console.warn("Konnte Extra-Übung nicht löschen:", error);
      return false;
    }
    writeJsonList(extrasCacheKey(kid.id), readJsonList(extrasCacheKey(kid.id)).filter((row) => row.id !== id));
  }
  updateStarDisplay();
  updateWeeklyUsageHint();
  refreshPicker();
  renderExtrasList();
  return true;
}

function renderExtrasList() {
  if (!currentKid) return;
  const kid = currentKid;
  const pendingIds = new Set(readJsonList(extrasPendingKey(kid.id)).map((row) => row.id));
  const cutoff = localDateStr(new Date(Date.now() - 14 * 86400000));
  const rows = loadExtras(kid.id).filter((row) => row.practiced_on >= cutoff);

  els.extraSyncState.textContent = !supabaseClient
    ? "Kein Internet: Einträge bleiben auf diesem Gerät, bis sie gesendet werden können."
    : pendingIds.size > 0
      ? `⏳ ${pendingIds.size} Eintrag/Einträge warten auf das Senden.`
      : "✅ Auf allen Geräten gleich.";

  els.extraList.innerHTML = "";
  if (rows.length === 0) {
    const empty = document.createElement("p");
    empty.className = "settings-note";
    empty.textContent = "In den letzten 14 Tagen wurde nichts eingetragen.";
    els.extraList.appendChild(empty);
    return;
  }
  rows.forEach((row) => {
    const item = document.createElement("div");
    item.className = "extra-row";
    const date = new Date(`${row.practiced_on}T12:00:00`).toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
    const text = document.createElement("span");
    const teileText = (row.teile || []).length ? ` · 🧩 ${row.teile.length} Bildteil${row.teile.length === 1 ? "" : "e"}` : "";
    const minutesText = row.minutes > 0 ? `${row.minutes} Min` : "ohne Minuten";
    text.textContent = `${date} · ${EXTRA_ARTEN[row.art] || row.art} · ${minutesText}${teileText}${pendingIds.has(row.id) ? " (wartet)" : ""}`;
    const del = document.createElement("button");
    del.type = "button";
    del.className = "extra-delete";
    del.setAttribute("aria-label", "Eintrag löschen");
    del.textContent = "🗑";
    del.addEventListener("click", async () => {
      if (!window.confirm("Diesen Eintrag löschen?")) return;
      const ok = await deleteExtra(kid, row.id);
      if (!ok) showExtraFeedback("Löschen hat nicht geklappt. Bitte mit Internet nochmal versuchen.", true);
    });
    item.appendChild(text);
    item.appendChild(del);
    els.extraList.appendChild(item);
  });
}

function showExtraFeedback(text, isError = false) {
  els.extraFeedback.hidden = false;
  els.extraFeedback.textContent = text;
  els.extraFeedback.classList.toggle("error", isError);
}

function setupExtraForm() {
  const today = new Date();
  els.extraDay.max = localDateStr(today);
  els.extraDay.min = localDateStr(new Date(today.getTime() - EXTRA_MAX_BACKDATE_DAYS * 86400000));
  els.extraDay.value = localDateStr(today);
  els.extraTeile.value = "0";
  els.extraFeedback.hidden = true;
  renderExtrasList();
  syncExtras(currentKid);
}

async function submitExtra() {
  const day = els.extraDay.value;
  const minutes = parseInt(els.extraMinutes.value, 10);
  const art = els.extraArt.value;
  const wanted = parseInt(els.extraTeile.value, 10) || 0;
  if (!day || day > els.extraDay.max || day < els.extraDay.min) {
    showExtraFeedback(`Bitte einen Tag der letzten ${EXTRA_MAX_BACKDATE_DAYS} Tage wählen.`, true);
    return;
  }
  if (minutes === 0 && wanted === 0) {
    showExtraFeedback("Bitte Minuten oder Bildteile angeben.", true);
    return;
  }

  // Freigeschaltet werden die nächsten noch offenen Teile des Wochenbilds.
  const teile = wanted > 0 ? nextOpenTileFiles(currentKid.id, wanted) : [];
  if (wanted > 0 && teile.length === 0 && minutes === 0) {
    showExtraFeedback(currentBild ? "Es sind keine offenen Bildteile mehr übrig." : "Es gibt gerade kein Wochenbild zum Freischalten.", true);
    return;
  }

  els.extraAddBtn.disabled = true;
  const starsBefore = extraStarsTotal(currentKid.id);
  await addExtra(currentKid, art, minutes, day, teile);
  const gained = extraStarsTotal(currentKid.id) - starsBefore;
  const dayMinutes = extraMinutesByDay(currentKid.id).get(day) || 0;
  const parts = [];
  parts.push(minutes > 0 ? `${minutes} Minuten (${EXTRA_ARTEN[art]})` : `${EXTRA_ARTEN[art]} ohne Minuten`);
  let hint;
  if (gained > 0) hint = `+${gained} Sterne.`;
  else if (minutes === 0) hint = "";
  else hint = dayMinutes >= EXTRA_MIN_DAY_MINUTES ? "Das Tageslimit für Sterne ist erreicht, der Tag zählt trotzdem." : "Für Sterne und Übungstag braucht es mindestens 10 Minuten am Tag.";
  if (wanted > 0) {
    const frei = teile.length === wanted ? `${teile.length} Bildteil${teile.length === 1 ? "" : "e"} freigeschaltet.` : `Nur ${teile.length} von ${wanted} Bildteilen ${teile.length === 1 ? "war" : "waren"} noch offen und ${teile.length === 1 ? "wurde" : "wurden"} freigeschaltet.`;
    hint = `${hint} ${frei}`.trim();
  }
  showExtraFeedback(`✅ ${parts[0]} eingetragen. ${hint}`);
  els.extraAddBtn.disabled = false;
}

// ---------- Sterne und Sammelwelt ----------
// Sterne gibt es für Mühe, nicht für Tempo: 1 Stern pro richtig gelöster
// Aufgabe (je Aufgabe nur einmal), ein Bonus für ein komplett richtiges
// Arbeitsblatt und für das Üben im Kopfrechnen-Sprint (mit Tageslimit, damit
// Raten oder Dauerklicken sich nicht lohnt). Mit der Gesamtzahl schalten sich
// die Funde der Sammelwelt (KIDS[].welt) frei. Kein Vergleich zwischen den
// Kindern, jedes Kind sieht nur die eigene Sammlung. Speicherung pro Gerät.
const PERFECT_SHEET_BONUS = 3;
const SPRINT_STAR_CAP_PER_DAY = 25;

function starsKey(kidId) {
  return `mathe-pwa:${kidId}:stars`;
}

// Sterne als Liste "Schlüssel -> Sterne" (Ledger). Jeder Schlüssel zählt nur
// einmal, die Gesamtzahl ist die Summe. So lassen sich Stände mehrerer Geräte
// verlustfrei zusammenführen (pro Schlüssel der höhere Wert).
function ledgerTotal(ledger) {
  return Object.values(ledger).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function migrateLegacyStars(raw) {
  const ledger = {};
  Object.keys(raw.awarded || {}).forEach((key) => {
    ledger[key] = key.endsWith("#perfect") ? PERFECT_SHEET_BONUS : key.startsWith("week:") ? STREAK_BONUS_STARS : 1;
  });
  Object.entries(raw.sprintDaily || {}).forEach(([day, count]) => {
    if (count > 0) ledger[`sprint:${day}`] = count;
  });
  const rest = (raw.total || 0) - ledgerTotal(ledger);
  if (rest > 0) ledger.legacy = rest;
  return ledger;
}

function loadStars(kidId) {
  let ledger = {};
  try {
    const raw = JSON.parse(localStorage.getItem(starsKey(kidId)));
    if (raw && raw.ledger) ledger = { ...raw.ledger };
    else if (raw && typeof raw.total === "number") ledger = migrateLegacyStars(raw);
  } catch (e) {
    ledger = {};
  }
  return { ledger, total: ledgerTotal(ledger) };
}

function saveStars(kidId, stars) {
  try {
    localStorage.setItem(starsKey(kidId), JSON.stringify({ ledger: stars.ledger }));
  } catch (e) {
    console.warn("Konnte Sterne nicht speichern:", e);
  }
  noteLocalChange();
}

const toastQueue = [];
let toastActive = false;
let toastTimer = null;

// Hinweise nacheinander zeigen, damit z.B. "Streak-Woche" und "Neuer Fund"
// nicht gegenseitig überschrieben werden.
function showToast(text, ms = 3500) {
  toastQueue.push({ text, ms });
  if (!toastActive) nextToast();
}

function nextToast() {
  const item = toastQueue.shift();
  if (!item) {
    toastActive = false;
    els.toast.hidden = true;
    return;
  }
  toastActive = true;
  els.toast.textContent = item.text;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(nextToast, item.ms);
}

function updateStarDisplay() {
  if (!currentKid) return;
  const total = totalStars(currentKid.id);
  els.starCounter.textContent = `⭐ ${total}`;
  const next = currentKid.welt.items.find((item) => item.ab > total);
  els.starNext.textContent = next
    ? `Noch ${next.ab - total} ⭐ bis zum nächsten Fund.`
    : "Du hast alles in deiner Sammelwelt gefunden! 🏆";
}

// Schreibt Sterne gut und meldet neue Funde. "stars" ist der bereits
// geladene Stand (wird hier gespeichert), "gained" die neu verdienten Sterne.
function applyStarGain(kid, stars, gained, label = "") {
  if (gained <= 0) return 0;
  const after = ledgerTotal(stars.ledger) + extraStarsTotal(kid.id);
  const before = after - gained;
  saveStars(kid.id, stars);
  updateStarDisplay();
  const newItems = kid.welt.items.filter((item) => before < item.ab && after >= item.ab);
  const found = newItems.length ? ` · 🎉 Neu in deiner Sammelwelt: ${newItems.map((i) => `${i.emoji} ${i.name}`).join(", ")}` : "";
  showToast(`⭐ +${gained} Sterne${label ? ` · ${label}` : ""}${found}`, newItems.length ? 7000 : 3500);
  return gained;
}

// entries: [{ key, value }], jeder Schlüssel zählt nur einmal.
function awardKeyed(kid, entries, label = "") {
  const stars = loadStars(kid.id);
  let gained = 0;
  entries.forEach(({ key, value }) => {
    if (stars.ledger[key]) return;
    stars.ledger[key] = value;
    gained += value;
  });
  return applyStarGain(kid, stars, gained, label);
}

function awardSprintStars(kid, correct) {
  const stars = loadStars(kid.id);
  const key = `sprint:${todayDateStr()}`;
  const used = stars.ledger[key] || 0;
  const gain = Math.min(correct, Math.max(0, SPRINT_STAR_CAP_PER_DAY - used));
  if (gain > 0) stars.ledger[key] = used + gain;
  return applyStarGain(kid, stars, gain);
}

function renderWorld() {
  const welt = currentKid.welt;
  const total = totalStars(currentKid.id);
  els.worldTitle.textContent = `🧺 Mein ${welt.titel}`;
  els.worldTotal.textContent = `⭐ ${total} Sterne gesammelt`;
  els.worldGrid.innerHTML = "";
  const nextIndex = welt.items.findIndex((item) => item.ab > total);
  welt.items.forEach((item, index) => {
    const unlocked = total >= item.ab;
    const card = document.createElement("div");
    card.className = "world-item " + (unlocked ? "unlocked" : "locked") + (index === nextIndex ? " next" : "");
    card.innerHTML = `
      <span class="world-emoji">${item.emoji}</span>
      <span class="world-name">${unlocked ? escapeHtml(item.name) : "???"}</span>
      <span class="world-need">${unlocked ? "gefunden" : `ab ${item.ab} ⭐`}</span>
    `;
    els.worldGrid.appendChild(card);
  });
}

function openWorld() {
  hideAllViews();
  renderWorld();
  els.worldView.hidden = false;
}

function closeWorld() {
  els.worldView.hidden = true;
  showPicker();
}

// ---------- Meine Ergebnisse: Aufgaben nachschauen + Fehler wiederholen ----------
// Zeigt zu jeder abgeschlossenen Übung und jedem Kopfrechnen-Sprint die eigene
// Antwort, die richtige Lösung und ob es gepasst hat. Daten kommen aus
// localStorage (Auf diesem Gerät gespeichert), die Aufgabentexte aus den
// bereits geladenen Arbeitsblättern.
let redoQueue = [];
let redoIndex = 0;
let redoCorrect = 0;
let redoChecked = false;
let redoStarEntries = [];

function hideAllViews() {
  [els.picker, els.view, els.sprintView, els.sprintSummary, els.resultsView, els.redoView, els.worldView].forEach((el) => {
    el.hidden = true;
  });
}

function collectSheetResults() {
  return currentWorksheetList
    .map((ws) => {
      const progress = loadProgress(currentKid.id, ws.file);
      const sheet = worksheetCache[ws.file];
      if (!progress || !sheet || progress.total == null) return null;
      const answers = progress.answers || {};
      const tasks = (sheet.aufgaben || []).map((t) => {
        const given = answers[t.id] ?? "";
        const richtig =
          !!progress.overrides?.[t.id] || (given !== "" && normalizeAnswer(given) === normalizeAnswer(t.loesung));
        return { frage: t.frage, gegeben: String(given), loesung: String(t.loesung), richtig, optionen: t.optionen || null };
      });
      return {
        titel: ws.titel,
        date: progress.completedAt || "",
        correct: tasks.filter((t) => t.richtig).length,
        total: tasks.length,
        tasks,
      };
    })
    .filter(Boolean);
}

function collectSprintResults() {
  return loadRecentSprintResults(currentKid.id, 30)
    .filter((r) => (r.tasks || []).length > 0)
    .map((r) => ({
      titel: "🧠 Kopfrechnen-Sprint",
      date: r.date,
      correct: r.correct,
      total: r.attempted,
      tasks: r.tasks,
    }));
}

function formatResultDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "numeric" });
}

function renderResults() {
  const items = [...collectSheetResults(), ...collectSprintResults()].sort((a, b) => (a.date < b.date ? 1 : -1));
  els.resultsList.innerHTML = "";

  if (items.length === 0) {
    const empty = document.createElement("p");
    empty.className = "subtitle";
    empty.textContent = "Hier erscheinen deine Übungen, sobald du die erste gelöst hast.";
    els.resultsList.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const wrap = document.createElement("div");
    wrap.className = "results-item";

    const head = document.createElement("button");
    head.type = "button";
    head.className = "results-item-head";
    head.innerHTML = `
      <span class="results-item-title">${escapeHtml(item.titel)}</span>
      <span class="results-item-meta">${escapeHtml(formatResultDate(item.date))} · ${item.correct} von ${item.total} richtig</span>
    `;

    const body = document.createElement("div");
    body.className = "results-item-body";
    body.hidden = true;

    const wrongTasks = item.tasks.filter((t) => !t.richtig);
    const toolbar = document.createElement("div");
    toolbar.className = "results-toolbar";
    toolbar.innerHTML = `<label><input type="checkbox" class="results-only-wrong" /> Nur falsche zeigen</label>`;
    if (wrongTasks.length > 0) {
      const redoBtn = document.createElement("button");
      redoBtn.type = "button";
      redoBtn.className = "chalk-button ghost small";
      redoBtn.textContent = `🔁 ${wrongTasks.length} falsche nochmal üben`;
      redoBtn.addEventListener("click", () => startRedo(wrongTasks));
      toolbar.appendChild(redoBtn);
    }
    body.appendChild(toolbar);
    toolbar.querySelector(".results-only-wrong").addEventListener("change", (e) => {
      body.classList.toggle("only-wrong", e.target.checked);
    });

    item.tasks.forEach((t) => {
      const row = document.createElement("div");
      row.className = "results-row " + (t.richtig ? "correct" : "wrong");
      const given = t.gegeben === "" ? "nicht beantwortet" : escapeHtml(t.gegeben);
      row.innerHTML = `
        <span class="results-row-mark">${t.richtig ? "✅" : "❌"}</span>
        <span class="results-row-text">
          <span class="results-row-frage">${escapeHtml(t.frage)}</span>
          <span class="results-row-answer">Deine Antwort: ${given}</span>
          ${t.richtig ? "" : `<span class="results-row-solution">Richtig wäre: ${escapeHtml(t.loesung)}</span>`}
        </span>
      `;
      body.appendChild(row);
    });

    head.addEventListener("click", () => {
      body.hidden = !body.hidden;
    });
    wrap.appendChild(head);
    wrap.appendChild(body);
    els.resultsList.appendChild(wrap);
  });
}

function openResults() {
  hideAllViews();
  renderResults();
  els.resultsView.hidden = false;
}

function closeResults() {
  els.resultsView.hidden = true;
  showPicker();
}

function startRedo(tasks) {
  redoQueue = tasks.map((t) => ({ ...t }));
  redoIndex = 0;
  redoCorrect = 0;
  redoStarEntries = [];
  hideAllViews();
  els.redoView.hidden = false;
  els.redoSummary.hidden = true;
  els.redoTaskCard.hidden = false;
  els.redoCheckBtn.hidden = false;
  showRedoTask();
}

function showRedoTask() {
  const task = redoQueue[redoIndex];
  redoChecked = false;
  els.redoProgress.textContent = `Aufgabe ${redoIndex + 1} von ${redoQueue.length}`;
  els.redoQuestion.textContent = task.frage;
  const hasChoices = Array.isArray(task.optionen) && task.optionen.length >= 2;
  els.redoInput.inputMode = /^\d+([.,]\d+)?$/.test(task.loesung.trim()) ? "decimal" : "text";
  els.redoInput.value = "";
  els.redoInput.disabled = false;
  els.redoInput.hidden = hasChoices;
  els.redoChoices.hidden = !hasChoices;
  els.redoChoices.innerHTML = "";
  if (hasChoices) {
    task.optionen.forEach((option) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice-btn";
      btn.textContent = option;
      btn.addEventListener("click", () => {
        els.redoInput.value = option;
        els.redoChoices.querySelectorAll(".choice-btn").forEach((other) => other.classList.toggle("selected", other === btn));
      });
      els.redoChoices.appendChild(btn);
    });
  }
  els.redoSolution.hidden = true;
  els.redoTaskCard.classList.remove("correct", "wrong");
  els.redoCheckBtn.textContent = "Prüfen";
  els.redoInput.focus();
}

function handleRedoAction() {
  if (!redoChecked) {
    if (els.redoInput.hidden && els.redoInput.value === "") return; // erst eine Antwort auswählen
    const task = redoQueue[redoIndex];
    const isCorrect =
      normalizeAnswer(els.redoInput.value) !== "" &&
      normalizeAnswer(els.redoInput.value) === normalizeAnswer(task.loesung);
    if (isCorrect) {
      redoCorrect++;
      redoStarEntries.push({ key: `redo:${todayDateStr()}:${task.frage}`, value: 1 });
    }
    els.redoTaskCard.classList.add(isCorrect ? "correct" : "wrong");
    els.redoInput.disabled = true;
    els.redoChoices.querySelectorAll(".choice-btn").forEach((btn) => {
      btn.disabled = true;
    });
    if (!isCorrect) {
      els.redoSolution.textContent = `Richtig wäre: ${task.loesung}`;
      els.redoSolution.hidden = false;
    }
    redoChecked = true;
    els.redoCheckBtn.textContent = redoIndex + 1 < redoQueue.length ? "Weiter" : "Fertig";
    return;
  }

  redoIndex++;
  if (redoIndex < redoQueue.length) {
    showRedoTask();
    return;
  }
  markUsageDay(currentKid.id);
  awardKeyed(currentKid, redoStarEntries);
  els.redoTaskCard.hidden = true;
  els.redoCheckBtn.hidden = true;
  els.redoProgress.textContent = "";
  els.redoSummary.hidden = false;
  els.redoSummary.textContent =
    redoCorrect > 0
      ? `🎉 Stark! Diesmal hast du ${redoCorrect} Aufgabe${redoCorrect === 1 ? "" : "n"} richtig gelöst.`
      : "Gut drangeblieben! Schau dir die Lösungen in Ruhe an, dann klappt es beim nächsten Mal. 💪";
}

function stopRedo() {
  els.redoView.hidden = true;
  openResults();
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
els.settingsToggle.addEventListener("click", toggleSettings);
els.settingsCodeOk.addEventListener("click", unlockSettings);
els.settingsCode.addEventListener("keydown", (e) => {
  if (e.key === "Enter") unlockSettings();
});
els.settingsLowerGrade.addEventListener("change", () => {
  saveGradeOffset(currentKid.id, els.settingsLowerGrade.checked ? 1 : 0);
  renderSettings();
});
els.extraAddBtn.addEventListener("click", submitExtra);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && currentKid) {
    syncExtras(currentKid);
    syncState(currentKid);
  }
});
els.streakPill.addEventListener("click", () => {
  const open = els.streakDetails.hidden;
  els.streakDetails.hidden = !open;
  els.streakPill.setAttribute("aria-expanded", String(open));
});
els.worldOpenBtn.addEventListener("click", openWorld);
els.worldBackBtn.addEventListener("click", closeWorld);
els.resultsOpenBtn.addEventListener("click", openResults);
els.resultsBackBtn.addEventListener("click", closeResults);
els.redoCheckBtn.addEventListener("click", handleRedoAction);
els.redoStopBtn.addEventListener("click", stopRedo);
els.redoInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleRedoAction();
});
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

// ---------- Zugangscode (Anmeldung pro Gerät) ----------
// Beim ersten Öffnen auf einem Gerät braucht die Seite den persönlichen Code
// (per Link ?t=… oder Eingabe). Er bleibt danach auf dem Gerät gespeichert.
const activeKid = KIDS.find((k) => k.id === document.body.dataset.kidId);

function showGate(message = "") {
  hideAllViews();
  els.codeGate.hidden = false;
  els.gateError.hidden = !message;
  els.gateError.textContent = message;
}

function handleInvalidToken() {
  clearToken(activeKid.id);
  showGate("Der Code ist nicht mehr gültig. Bitte den neuen Code eingeben.");
}

async function verifyKidCode(raw) {
  const code = normalizeCode(raw);
  if (!code) return { ok: false, message: "Bitte den Code eingeben." };
  const { data, error } = await callRpc("app_check", {}, code);
  if (error) {
    return {
      ok: false,
      message: error.offline
        ? "Keine Verbindung. Bitte mit Internet nochmal versuchen."
        : "Dieser Code passt nicht. Bitte nochmal prüfen.",
    };
  }
  if (data.role !== "kind") return { ok: false, message: "Das ist ein Eltern-Code. Bitte den Code für dich nehmen." };
  if (data.kid_id !== activeKid.id) return { ok: false, message: "Dieser Code gehört zu einer anderen Seite." };
  saveToken(activeKid.id, code);
  return { ok: true };
}

async function submitGate() {
  els.gateBtn.disabled = true;
  const result = await verifyKidCode(els.gateInput.value);
  els.gateBtn.disabled = false;
  if (!result.ok) {
    els.gateError.hidden = false;
    els.gateError.textContent = result.message;
    return;
  }
  els.gateInput.value = "";
  els.codeGate.hidden = true;
  selectKid(activeKid);
}

els.gateBtn.addEventListener("click", submitGate);
els.gateInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitGate();
});
window.addEventListener("pagehide", () => setParentToken(""));

// ---------- Start ----------
// Jede Kind-Seite trägt ihre feste Kind-ID am <body> (data-kid-id) statt einer
// Namensschild-Auswahl, so hat jedes Kind seine eigene Seite (/tj/, /mj/).
async function startApp() {
  const params = new URLSearchParams(window.location.search);
  if (params.has("t")) {
    const fromLink = await verifyKidCode(params.get("t"));
    history.replaceState(null, "", window.location.pathname);
    if (!fromLink.ok) {
      showGate(fromLink.message);
      return;
    }
  }
  if (!loadToken(activeKid.id)) {
    showGate();
    return;
  }
  selectKid(activeKid);
  // Im Hintergrund prüfen, ob der gespeicherte Code noch gilt (z.B. erneuert).
  callRpc("app_check", {}, loadToken(activeKid.id)).then(({ error }) => {
    if (error && isInvalidCode(error)) handleInvalidToken();
  });
}

startApp();
