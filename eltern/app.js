// KIDS, Bereiche und der Supabase-Client kommen aus ../shared.js.

const APP_BASE = new URL("..", document.currentScript.src);

const els = {
  summary: document.getElementById("summary"),
  kidsContainer: document.getElementById("kids"),
  weekButtons: document.querySelectorAll(".eltern-week-btn"),
  gate: document.getElementById("code-gate"),
  gateInput: document.getElementById("gate-input"),
  gateBtn: document.getElementById("gate-btn"),
  gateError: document.getElementById("gate-error"),
};

let viewMode = "current"; // "current" | "history"
let kidsData = []; // { kid, worksheets, attemptsByFile }

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ISO-Kalenderwoche im selben Format wie das "woche"-Feld der Arbeitsblätter
// (z.B. "2026-W39"), um die aktuelle Woche mit den Wochenbild-Arbeitsblättern
// abzugleichen.
function isoWeekString(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

// Ermittelt die Woche eines Arbeitsblatts: nutzt das "woche"-Feld, sonst das
// Datum am Anfang des Dateinamens (z.B. "2026-09-27-einmaleins-blitz.json"),
// damit auch ältere, nicht wochen-getaggte Blätter einsortiert werden können.
function effectiveWoche(ws) {
  if (ws.woche) return ws.woche;
  const match = ws.file.match(/^(\d{4}-\d{2}-\d{2})-/);
  if (match) return isoWeekString(new Date(match[1]));
  return null;
}

function weekLabel(woche) {
  const match = woche.match(/^(\d{4})-W(\d{2})$/);
  if (!match) return woche;
  return `KW ${match[2]} · ${match[1]}`;
}

function formatWhen(iso) {
  const date = new Date(iso);
  const now = new Date();
  const time = date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (date.toDateString() === now.toDateString()) return `heute ${time}`;
  if (date.toDateString() === yesterday.toDateString()) return `gestern ${time}`;
  return `${date.toLocaleDateString("de-DE")} ${time}`;
}

async function loadKidWorksheets(kid) {
  try {
    const indexRes = await fetch(new URL(`data/${kid.id}/index.json`, APP_BASE), { cache: "no-store" });
    if (!indexRes.ok) return [];
    const index = await indexRes.json();
    const files = index.files || [];

    const worksheets = await Promise.all(
      files.map(async (file) => {
        try {
          const wRes = await fetch(new URL(`data/${kid.id}/${file}`, APP_BASE), { cache: "no-store" });
          const wJson = await wRes.json();
          return {
            file,
            titel: wJson.titel || file,
            bereich: wJson.bereich || null,
            woche: wJson.woche || null,
            total: (wJson.aufgaben || []).length,
          };
        } catch {
          return null;
        }
      })
    );
    // Blätter kommender Wochen sind für die Kinder noch nicht sichtbar.
    const thisWeek = isoWeekString(new Date());
    return worksheets.filter(Boolean).filter((ws) => !ws.woche || ws.woche <= thisWeek);
  } catch {
    return [];
  }
}

async function loadAttempts(kid) {
  const { data, error } = await callRpc("app_attempts_list", { p_kid: kid.id, p_since: RESET_EPOCH }, loadToken("eltern"));
  if (error) {
    if (isInvalidCode(error)) throw error;
    console.warn("Konnte Ergebnisse nicht laden:", error);
    return [];
  }
  return data || [];
}

function groupByFile(attempts) {
  const byFile = new Map();
  attempts.forEach((a) => {
    if (!byFile.has(a.worksheet_file)) byFile.set(a.worksheet_file, []);
    byFile.get(a.worksheet_file).push(a);
  });
  return byFile;
}

// ---------- "Wo steht mein Kind?": Erfolgsquote pro Bereich ----------
// Gleiche Logik wie die "Wo stehe ich?"-Übersicht in der Kind-App (app.js),
// hier aber über ALLE Versuche aus Supabase statt nur die aktuell im
// data/<kindId>/index.json gelisteten Arbeitsblätter – zeigt also auch
// Bereiche, deren Arbeitsblätter längst wieder aus der Auswahl verschwunden
// sind.
function computeBereichStats(attemptsByFile) {
  const sums = new Map();
  attemptsByFile.forEach((history) => {
    const latest = history[history.length - 1];
    if (!latest || !latest.bereich || !latest.total) return;
    const s = sums.get(latest.bereich) || { correct: 0, total: 0 };
    s.correct += latest.correct_count;
    s.total += latest.total;
    sums.set(latest.bereich, s);
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
  return { level: "weak", emoji: "🌱", text: "Übt noch" };
}

function renderLueckenPanel(stats, kidName) {
  const panel = document.createElement("div");
  panel.className = "luecken-panel";

  if (stats.length === 0) {
    panel.innerHTML = `
      <p class="luecken-panel-title">📊 Wo steht ${escapeHtml(kidName)}?</p>
      <p class="subtitle">Noch keine ausgewerteten Versuche vorhanden.</p>
    `;
    return panel;
  }

  const rows = [...stats]
    .sort((a, b) => a.pct - b.pct)
    .map((s) => {
      const tag = lueckenLevel(s.pct);
      return `
        <div class="luecken-row">
          <div class="luecken-row-head">
            <span class="luecken-row-label">${BEREICH_ICONS[s.bereich] || "❓"} ${escapeHtml(
              bereichLabel(s.bereich).replace(/^\S+\s/, "")
            )}</span>
            <span class="luecken-row-tag">${tag.emoji} ${tag.text} · ${s.pct}%</span>
          </div>
          <div class="luecken-bar"><div class="luecken-bar-fill ${tag.level}" style="width: ${s.pct}%"></div></div>
        </div>
      `;
    })
    .join("");

  panel.innerHTML = `
    <p class="luecken-panel-title">📊 Wo steht ${escapeHtml(kidName)}?</p>
    <div class="luecken-list">${rows}</div>
  `;
  return panel;
}

function renderWorksheetRow(ws, history) {
  const row = document.createElement("div");
  row.className = "eltern-row";

  const latest = history[history.length - 1];
  let status = "⚪ offen";
  let statusClass = "open";
  if (latest) {
    if (latest.correct_count === latest.total) {
      status = "✅ erledigt";
      statusClass = "done";
    } else {
      status = "🔶 in Arbeit";
      statusClass = "partial";
    }
  }

  const quote = latest ? `${latest.correct_count}/${latest.total}` : "–";
  const when = latest ? formatWhen(latest.completed_at) : "–";
  const hasHistory = history.length > 0;

  row.innerHTML = `
    <button type="button" class="eltern-row-main ${statusClass}" ${hasHistory ? "" : "disabled"}>
      <span class="eltern-row-title">${escapeHtml(ws.titel)}</span>
      <span class="eltern-row-status">${status}</span>
      <span class="eltern-row-quote">${quote}</span>
      <span class="eltern-row-attempts">${history.length}×</span>
      <span class="eltern-row-when">${when}</span>
    </button>
    ${
      hasHistory
        ? `<div class="eltern-row-history" hidden>${history
            .map((a) => `<span>${formatWhen(a.completed_at)}: ${a.correct_count}/${a.total}</span>`)
            .join(" → ")}</div>`
        : ""
    }
  `;

  if (hasHistory) {
    const toggle = row.querySelector(".eltern-row-main");
    const details = row.querySelector(".eltern-row-history");
    toggle.addEventListener("click", () => {
      details.hidden = !details.hidden;
    });
  }

  return row;
}

// Rendert eine Liste von Arbeitsblättern gruppiert nach Bereich in "container".
function renderBereichGroups(container, worksheets, attemptsByFile) {
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
    const heading = document.createElement("h3");
    heading.className = "bereich-heading";
    heading.textContent = key === "sonstiges" ? "Weitere Aufgaben" : bereichLabel(key);
    container.appendChild(heading);

    const list = document.createElement("div");
    list.className = "eltern-worksheet-list";
    groups.get(key).forEach((ws) => list.appendChild(renderWorksheetRow(ws, attemptsByFile.get(ws.file) || [])));
    container.appendChild(list);
  });
}

function renderKidCard(kid, worksheets, attemptsByFile, mode) {
  const card = document.createElement("section");
  card.className = "eltern-kid-card";
  card.style.setProperty("--kid-color", kid.color);

  const currentWeek = isoWeekString(new Date());
  const weekWorksheets = worksheets.filter((ws) => effectiveWoche(ws) === currentWeek);
  const weekDone = weekWorksheets.filter((ws) => {
    const latest = (attemptsByFile.get(ws.file) || []).at(-1);
    return latest && latest.correct_count === latest.total;
  }).length;

  const withAttempts = worksheets.filter((ws) => attemptsByFile.has(ws.file));
  const avgQuote = withAttempts.length
    ? Math.round(
        (withAttempts.reduce((sum, ws) => {
          const latest = attemptsByFile.get(ws.file).at(-1);
          return sum + latest.correct_count / latest.total;
        }, 0) /
          withAttempts.length) *
          100
      )
    : null;

  const header = document.createElement("div");
  header.className = "eltern-kid-header";
  header.innerHTML = `
    <h2 class="eltern-kid-name">${escapeHtml(kid.name)}</h2>
    <p class="eltern-kid-summary">${
      weekWorksheets.length ? `diese Woche: ${weekDone}/${weekWorksheets.length}` : "keine Wochenaufgaben hinterlegt"
    }${avgQuote !== null ? ` · Ø ${avgQuote}%` : ""}</p>
  `;
  card.appendChild(header);
  card.appendChild(renderLueckenPanel(computeBereichStats(attemptsByFile), kid.name));

  if (worksheets.length === 0) {
    const empty = document.createElement("p");
    empty.className = "subtitle";
    empty.textContent = "Für dieses Kind sind noch keine Arbeitsblätter hinterlegt.";
    card.appendChild(empty);
    return card;
  }

  if (mode === "current") {
    if (weekWorksheets.length === 0) {
      const empty = document.createElement("p");
      empty.className = "subtitle";
      empty.textContent = "Für die aktuelle Woche sind noch keine Arbeitsblätter hinterlegt.";
      card.appendChild(empty);
      return card;
    }
    renderBereichGroups(card, weekWorksheets, attemptsByFile);
    return card;
  }

  // mode === "history": alle Wochen außer der aktuellen, neueste zuerst.
  const pastWeeks = new Map();
  worksheets
    .filter((ws) => effectiveWoche(ws) !== currentWeek)
    .forEach((ws) => {
      const key = effectiveWoche(ws) || "unbekannt";
      if (!pastWeeks.has(key)) pastWeeks.set(key, []);
      pastWeeks.get(key).push(ws);
    });

  if (pastWeeks.size === 0) {
    const empty = document.createElement("p");
    empty.className = "subtitle";
    empty.textContent = "Keine Arbeitsblätter aus früheren Wochen vorhanden.";
    card.appendChild(empty);
    return card;
  }

  const orderedWeeks = [...pastWeeks.keys()].sort().reverse();
  orderedWeeks.forEach((week) => {
    const heading = document.createElement("h3");
    heading.className = "eltern-week-heading";
    heading.textContent = week === "unbekannt" ? "Ohne Woche" : weekLabel(week);
    card.appendChild(heading);
    renderBereichGroups(card, pastWeeks.get(week), attemptsByFile);
  });

  return card;
}

function renderAll() {
  els.kidsContainer.innerHTML = "";
  kidsData.forEach(({ kid, worksheets, attemptsByFile }) => {
    els.kidsContainer.appendChild(renderKidCard(kid, worksheets, attemptsByFile, viewMode));
  });
}

function setViewMode(mode) {
  viewMode = mode;
  els.weekButtons.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.mode === mode));
  renderAll();
}

function showGate(message = "") {
  els.gate.hidden = false;
  els.kidsContainer.innerHTML = "";
  els.summary.textContent = "";
  els.gateError.hidden = !message;
  els.gateError.textContent = message;
}

async function verifyParentCode(raw) {
  const code = normalizeCode(raw);
  if (!code) return "Bitte den Eltern-Code eingeben.";
  const { data, error } = await callRpc("app_eltern_check", {}, code);
  if (error) return "Keine Verbindung. Bitte mit Internet nochmal versuchen.";
  if (data !== true) return "Dieser Code passt nicht.";
  saveToken("eltern", code);
  return "";
}

async function submitGate() {
  els.gateBtn.disabled = true;
  const problem = await verifyParentCode(els.gateInput.value);
  els.gateBtn.disabled = false;
  if (problem) {
    els.gateError.hidden = false;
    els.gateError.textContent = problem;
    return;
  }
  els.gateInput.value = "";
  els.gate.hidden = true;
  init();
}

async function init() {
  if (!supabaseClient) {
    els.summary.textContent = "Supabase konnte nicht geladen werden (kein Netz?).";
    return;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.has("t")) {
    const problem = await verifyParentCode(params.get("t"));
    history.replaceState(null, "", window.location.pathname);
    if (problem) return showGate(problem);
  }
  if (!loadToken("eltern")) return showGate();

  els.summary.textContent = "Lädt …";
  els.kidsContainer.innerHTML = "";
  kidsData.length = 0;

  try {
    for (const kid of KIDS) {
      const [worksheets, attempts] = await Promise.all([loadKidWorksheets(kid), loadAttempts(kid)]);
      kidsData.push({ kid, worksheets, attemptsByFile: groupByFile(attempts) });
    }
  } catch (error) {
    clearToken("eltern");
    return showGate("Der Code ist nicht mehr gültig. Bitte neu eingeben.");
  }

  renderAll();
  els.summary.textContent = "";
}

els.weekButtons.forEach((btn) => {
  btn.addEventListener("click", () => setViewMode(btn.dataset.mode));
});
els.gateBtn.addEventListener("click", submitGate);
els.gateInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") submitGate();
});

init();
