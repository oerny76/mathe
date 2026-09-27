// scripts/generate.js
// Erzeugt für jedes Kind die Aufgaben-JSON-Dateien für die aktuelle Kalenderwoche.
// Kinder mit "bereiche" bekommen pro Bereich ein eigenes ~15-Minuten-Arbeitsblatt
// (siehe README, Abschnitt "Optionale Felder: Bereiche & Lesetexte") plus ein
// wöchentliches Puzzle-Belohnungsbild (siehe README, Abschnitt "Wochenbild-Puzzle").
// Kinder ohne "bereiche" bekommen wie bisher ein einzelnes Wochenblatt.
//
// Wird manuell aufgerufen (kein automatischer GitHub-Workflow):
//   ANTHROPIC_API_KEY=sk-... node scripts/generate.js

import fs from "fs";
import path from "path";

// ---------- Konfiguration: hier Alter, Bereiche & Interessen pflegen ----------
const KIDS = [
  {
    id: "kind1",
    name: "TJ",
    alter: 9,
    // Reihenfolge der Bereiche = Reihenfolge der Puzzle-Teile (siehe app.js BEREICH_ORDER).
    bereiche: ["einmaleins", "grundrechenarten", "kopfrechnen", "lesen"],
    // Für die Lesetexte & das Wochenbild: rotiert wöchentlich durch diese Liste,
    // damit Lesen (und Bild) zu TJs Interessen passen und leichter fallen.
    interessen: ["FC Bayern München", "Drachen"],
  },
  { id: "kind2", name: "MJ", alter: 12 },
];

const MODEL = "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

const BASE_SYSTEM_PROMPT = `Du übernimmst die Rolle eines erfahrenen Mathematiklehrers an einer
bayerischen Grund- und Mittelschule. Du erstellst lernwirksame, altersgerechte
Aufgaben für Kinder.

Anforderungen:
- Die Aufgaben passen zum angegebenen Alter des Kindes.
- Bearbeitungszeit insgesamt maximal 15 Minuten.
- Kindgerechte, klare Sprache, orientiert am bayerischen Lehrplan.
- Der Schwierigkeitsgrad steigt im Vergleich zur letzten Woche (falls angegeben)
  leicht an, bleibt aber motivierend und nicht überfordernd.

WICHTIG: Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt, ohne Markdown-
Codeblock, ohne Erklärtext davor oder danach.`;

// ---------- Bereichs-spezifische Vorgaben (für Kinder mit "bereiche") ----------
const BEREICH_PROMPTS = {
  einmaleins: {
    format: `{
  "titel": "<kurzer, ansprechender Titel>",
  "aufgaben": [
    { "id": 1, "typ": "rechnen", "frage": "6 × 7 = ?", "loesung": "42" }
  ]
}`,
    anweisung: `Erzeuge 10 bis 12 reine Einmaleins-/Teilen-Aufgaben (Malfolgen und die
dazugehörigen Umkehraufgaben als Teilen), passend zum Alter. Keine Sachaufgaben,
keine Textaufgaben – nur kurze Rechenaufgaben, die schnell im Kopf oder schriftlich
gelöst werden können.`,
  },
  grundrechenarten: {
    format: `{
  "titel": "<kurzer, ansprechender Titel>",
  "aufgaben": [
    { "id": 1, "typ": "rechnen|sachaufgabe|knobelaufgabe", "frage": "<Aufgabentext>", "loesung": "<Lösung als String>" }
  ]
}`,
    anweisung: `Erzeuge 6 bis 8 Aufgaben, gemischt aus Addition, Subtraktion, Multiplikation
und Division (auch mit Zehnerübergang bzw. mehrstelligen Zahlen je nach Alter),
inklusive 1-2 Sachaufgaben und optional einer Knobelaufgabe.`,
  },
  kopfrechnen: {
    format: `{
  "titel": "<kurzer, ansprechender Titel>",
  "aufgaben": [
    { "id": 1, "typ": "rechnen", "frage": "Verdopple 23. Wie viel ist das?", "loesung": "46" }
  ]
}`,
    anweisung: `Erzeuge 8 bis 10 kurze Kopfrechen-Aufgaben, lösbar ohne schriftliches Rechnen:
Verdoppeln/Halbieren, runde Zahlen addieren/subtrahieren, kleine 1x1-Aufgaben,
Ergänzen zu 100 etc. Keine Sachaufgaben, keine mehrschrittigen Aufgaben.`,
  },
  lesen: {
    format: `{
  "titel": "<kurzer, ansprechender Titel, z.B. \\"Lesetext: ...\\">",
  "text": "<Lesetext, 150-220 Wörter, altersgerecht, zum angegebenen Interessengebiet>",
  "aufgaben": [
    { "id": 1, "typ": "leseverstehen", "frage": "<Verständnisfrage>", "loesung": "<kurze, eindeutige Antwort, ein Wort oder wenige Worte>" }
  ]
}`,
    anweisung: `Schreibe einen ORIGINELLEN, altersgerechten Lesetext (150-220 Wörter) zum
angegebenen Interessengebiet des Kindes – KEINE Übernahme von urheberrechtlich
geschütztem Text (keine wörtlichen Zitate aus Büchern/Filmen/Liedern, keine
geschützten Figurennamen); bei realen Themen (z.B. ein Sportverein) nur allgemein
bekannte Fakten in eigenen Worten. Danach 5 kurze Verständnisfragen mit eindeutigen,
knappen Antworten (ein Wort/eine Zahl/ein kurzer Fakt), da die Auswertung exakt
(ohne Groß-/Kleinschreibung) vergleicht.`,
  },
};

const BILD_SYSTEM_PROMPT = `Du erstellst ein einfaches, fröhliches Vektor-Bild (SVG) als
Wochen-Belohnungsbild für ein Kind, das seine Matheaufgaben erledigt hat.

Strikte technische Vorgaben:
- Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt, ohne Markdown-Codeblock.
- Das Feld "svg" enthält ein vollständiges, in sich geschlossenes SVG
  (viewBox="0 0 800 800", xmlns-Attribut gesetzt).
- Nur einfache Formen: <rect>, <circle>, <ellipse>, <path>, <polygon>, <g>,
  <linearGradient>/<radialGradient> in <defs>. Farben als Hex-Codes.
- KEINE <text>-Elemente, KEINE <image>/<foreignObject>, KEINE <filter>, KEINE
  externen Referenzen (keine URLs, keine Google Fonts o.ä.) – das Bild muss
  offline und ohne externe Ressourcen in jedem Browser rasterisierbar sein.
- Das Motiv soll zum angegebenen Interessengebiet passen, kindgerecht/freundlich
  wirken und in vier Quadranten (oben-links, oben-rechts, unten-links,
  unten-rechts) jeweils etwas Erkennbares zeigen, da das Bild stückweise als
  2x2-Puzzle aufgedeckt wird.

Exaktes Ausgabeformat:
{
  "titel": "<kurzer Titel des Bildes>",
  "thema": "<Interessengebiet>",
  "svg": "<vollständiger SVG-String>"
}`;

function getIsoWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function isoWeekNumber(weekId) {
  return parseInt(weekId.split("-W")[1], 10) || 0;
}

function listKidFiles(kidId) {
  const dir = path.join("data", kidId);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "index.json");
}

function readJson(kidId, file) {
  try {
    return JSON.parse(fs.readFileSync(path.join("data", kidId, file), "utf-8"));
  } catch {
    return null;
  }
}

// Findet das jüngste vorhandene Arbeitsblatt eines Kindes, optional gefiltert nach Bereich,
// als Referenz für die Schwierigkeitssteigerung.
function findPreviousWorksheet(kidId, weekId, bereich) {
  const files = listKidFiles(kidId)
    .filter((f) => f !== `${weekId}.json` && !f.endsWith("-bild.json"))
    .sort();
  for (let i = files.length - 1; i >= 0; i--) {
    const json = readJson(kidId, files[i]);
    if (!json) continue;
    if (bereich && json.bereich !== bereich) continue;
    return json;
  }
  return null;
}

async function callClaude(system, userMessage) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 3000,
      system,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    throw new Error(`API-Fehler: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const rawText = data.content.map((block) => block.text || "").join("");
  const cleaned = rawText.replace(/```json|```/g, "").trim();
  return JSON.parse(cleaned);
}

function writeWorksheet(kidId, fileName, json) {
  const outDir = path.join("data", kidId);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, fileName), JSON.stringify(json, null, 2) + "\n", "utf-8");
  console.log(`✓ Geschrieben: ${path.join(outDir, fileName)}`);
}

function updateIndex(kidId, { addFiles = [], aktuellesBild } = {}) {
  const indexPath = path.join("data", kidId, "index.json");
  let index = { files: [] };
  if (fs.existsSync(indexPath)) {
    try {
      index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    } catch {
      index = { files: [] };
    }
  }
  addFiles.forEach((f) => {
    if (!index.files.includes(f)) index.files.push(f);
  });
  if (aktuellesBild) index.aktuellesBild = aktuellesBild;

  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n", "utf-8");
  console.log(`✓ Index aktualisiert: ${indexPath}`);
}

// ---------- Kinder MIT Bereichen: 1 Arbeitsblatt pro Bereich + Wochenbild ----------
async function generateBereicheForKid(kid, weekId) {
  const newFiles = [];

  for (const bereich of kid.bereiche) {
    const prompt = BEREICH_PROMPTS[bereich];
    if (!prompt) {
      console.warn(`⚠ Kein Prompt für Bereich "${bereich}" hinterlegt, überspringe.`);
      continue;
    }

    const previous = findPreviousWorksheet(kid.id, weekId, bereich);
    const interesse = kid.interessen?.[isoWeekNumber(weekId) % kid.interessen.length];

    const userMessage = `Alter: ${kid.alter}. Bereich: ${bereich}. Neue Kalenderwoche: ${weekId}.
${bereich === "lesen" && interesse ? `Interessengebiet für den Lesetext: ${interesse}.\n` : ""}${
      previous
        ? `Das war das letzte Arbeitsblatt in diesem Bereich (Schwierigkeit leicht daran anpassen, nicht 1:1 wiederholen):\n${JSON.stringify(previous)}`
        : "Dies ist das erste Arbeitsblatt in diesem Bereich, bitte mit relativ einfachen Aufgaben beginnen."
    }

Exaktes Ausgabeformat (ohne "kind"/"alter"/"erstellt"/"bereich"/"woche" – die ergänze ich selbst):
${prompt.format}

${prompt.anweisung}`;

    let generated;
    try {
      generated = await callClaude(BASE_SYSTEM_PROMPT, userMessage);
    } catch (err) {
      console.error(`✗ Bereich "${bereich}" für ${kid.id} fehlgeschlagen:`, err.message);
      continue;
    }

    const json = {
      kind: kid.name,
      alter: kid.alter,
      erstellt: new Date().toISOString().slice(0, 10),
      woche: weekId,
      bereich,
      ...generated,
    };

    const fileName = `${weekId}-${bereich}.json`;
    writeWorksheet(kid.id, fileName, json);
    newFiles.push(fileName);
  }

  // Wochenbild: nur versuchen, wenn mindestens ein Arbeitsblatt erfolgreich war.
  let bildFile = null;
  if (newFiles.length > 0 && kid.interessen?.length) {
    const thema = kid.interessen[isoWeekNumber(weekId) % kid.interessen.length];
    try {
      const bild = await callClaude(
        BILD_SYSTEM_PROMPT,
        `Interessengebiet: ${thema}. Alter des Kindes: ${kid.alter}. Kalenderwoche: ${weekId}.`
      );
      if (typeof bild.svg === "string" && bild.svg.includes("<svg")) {
        bildFile = `${weekId}-bild.json`;
        writeWorksheet(kid.id, bildFile, { woche: weekId, titel: bild.titel, thema: bild.thema || thema, svg: bild.svg });
      } else {
        console.warn(`⚠ Wochenbild für ${kid.id} hatte kein gültiges SVG, wird übersprungen.`);
      }
    } catch (err) {
      console.error(`✗ Wochenbild für ${kid.id} fehlgeschlagen (Arbeitsblätter sind trotzdem fertig):`, err.message);
    }
  }

  updateIndex(kid.id, { addFiles: newFiles, aktuellesBild: bildFile || undefined });
}

// ---------- Kinder OHNE Bereiche: 1 Arbeitsblatt für die ganze Woche (bisheriges Verhalten) ----------
async function generateSingleForKid(kid, weekId) {
  const previous = findPreviousWorksheet(kid.id, weekId);

  const userMessage = previous
    ? `Alter: ${kid.alter}. Neue Kalenderwoche: ${weekId}.
Das war die letzte Woche (bitte Schwierigkeit leicht daran anpassen, nicht 1:1 wiederholen):
${JSON.stringify(previous)}

Abwechslungsreiche Formate: Rechenaufgaben, Sachaufgaben, Knobelaufgaben/Rätsel.
Erzeuge 6 bis 8 Aufgaben pro Woche, gemischt aus den drei Typen.

Exaktes Ausgabeformat:
{
  "kind": "${kid.name}",
  "alter": ${kid.alter},
  "woche": "${weekId}",
  "titel": "<kurzer, ansprechender Titel für die Woche>",
  "aufgaben": [
    { "id": 1, "typ": "rechnen|sachaufgabe|knobelaufgabe", "frage": "<Aufgabentext>", "loesung": "<Lösung als String>" }
  ]
}`
    : `Alter: ${kid.alter}. Neue Kalenderwoche: ${weekId}. Dies ist die erste Woche, bitte mit
relativ einfachen Aufgaben beginnen. Erzeuge 6 bis 8 Aufgaben, gemischt aus
Rechenaufgaben, Sachaufgaben und Knobelaufgaben.`;

  let json;
  try {
    json = await callClaude(BASE_SYSTEM_PROMPT, userMessage);
  } catch (err) {
    console.error(`✗ Wochenblatt für ${kid.id} fehlgeschlagen:`, err.message);
    return;
  }

  const fileName = `${weekId}.json`;
  writeWorksheet(kid.id, fileName, json);
  updateIndex(kid.id, { addFiles: [fileName] });
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Fehler: Umgebungsvariable ANTHROPIC_API_KEY fehlt.");
    process.exit(1);
  }

  const weekId = getIsoWeekId();

  for (const kid of KIDS) {
    if (kid.bereiche?.length) {
      await generateBereicheForKid(kid, weekId);
    } else {
      await generateSingleForKid(kid, weekId);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
