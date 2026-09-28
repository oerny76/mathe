// KIDS, Bereiche und der Supabase-Client kommen aus ../shared.js.

const APP_BASE = new URL("..", document.currentScript.src);

const els = {
  summary: document.getElementById("summary"),
  kidsContainer: document.getElementById("kids"),
  weekButtons: document.querySelectorAll(".eltern-week-btn"),
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
    return worksheets.filter(Boolean);
  } catch {
    return [];
  }
}

async function loadAttempts(kid) {
  if (!supabaseClient) return [];
  const { data, error } = await supabaseClient
    .from("attempts")
    .select("worksheet_file, correct_count, total, completed_at")
    .eq("kid_id", kid.id)
    .order("completed_at", { ascending: true });

  if (error) {
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

async function init() {
  if (!supabaseClient) {
    els.summary.textContent = "Supabase konnte nicht geladen werden (kein Netz?).";
    return;
  }

  els.summary.textContent = "Lädt …";
  els.kidsContainer.innerHTML = "";

  els.weekButtons.forEach((btn) => {
    btn.addEventListener("click", () => setViewMode(btn.dataset.mode));
  });

  for (const kid of KIDS) {
    const [worksheets, attempts] = await Promise.all([loadKidWorksheets(kid), loadAttempts(kid)]);
    kidsData.push({ kid, worksheets, attemptsByFile: groupByFile(attempts) });
  }

  renderAll();
  els.summary.textContent = "";
}

init();
