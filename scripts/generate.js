// scripts/generate.js
// Erzeugt für jedes Kind eine neue Aufgaben-JSON-Datei für die aktuelle Kalenderwoche.
// Wird von der GitHub Action (.github/workflows/generate-tasks.yml) aufgerufen,
// kann aber auch lokal getestet werden:
//   ANTHROPIC_API_KEY=sk-... node scripts/generate.js

import fs from "fs";
import path from "path";

// ---------- Konfiguration: hier Alter & Namen pflegen ----------
const KIDS = [
  { id: "kind1", name: "TJ", alter: 9 },
  { id: "kind2", name: "MJ", alter: 12 },
];

const MODEL = "claude-sonnet-4-6";
const API_URL = "https://api.anthropic.com/v1/messages";

const SYSTEM_PROMPT = `Du übernimmst die Rolle eines erfahrenen Mathematiklehrers an einer
bayerischen Grund- und Mittelschule. Du erstellst lernwirksame, altersgerechte
Mathematik-Aufgaben für Kinder.

Anforderungen:
- Die Aufgaben passen zum angegebenen Alter des Kindes.
- Bearbeitungszeit insgesamt maximal 15 Minuten.
- Abwechslungsreiche Formate: Rechenaufgaben, Sachaufgaben, Knobelaufgaben/Rätsel.
- Kindgerechte, klare Sprache, orientiert am bayerischen Lehrplan.
- Der Schwierigkeitsgrad steigt im Vergleich zur letzten Woche (falls angegeben)
  leicht an, bleibt aber motivierend und nicht überfordernd.

WICHTIG - Ausgabeformat:
Antworte AUSSCHLIESSLICH mit einem validen JSON-Objekt, ohne Markdown-Codeblock,
ohne Erklärtext davor oder danach. Exaktes Format:

{
  "kind": "<Name>",
  "alter": <Zahl>,
  "woche": "<Kalenderwoche z.B. 2026-W33>",
  "titel": "<kurzer, ansprechender Titel für die Woche>",
  "aufgaben": [
    { "id": 1, "typ": "rechnen|sachaufgabe|knobelaufgabe", "frage": "<Aufgabentext>", "loesung": "<Lösung als String>" }
  ]
}

Erzeuge 6 bis 8 Aufgaben pro Woche, gemischt aus den drei Typen.
Die "loesung" muss exakt und eindeutig überprüfbar sein (eine Zahl als String,
z.B. "56", keine Einheiten oder Zusatztext).`;

function getIsoWeekId(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function findPreviousWeekFile(kidId, weekId) {
  const dir = path.join("data", kidId);
  if (!fs.existsSync(dir)) return null;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== `${weekId}.json`)
    .sort();
  if (files.length === 0) return null;
  const lastFile = files[files.length - 1];
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, lastFile), "utf-8"));
  } catch {
    return null;
  }
}

async function generateForKid(kid, weekId) {
  const previous = findPreviousWeekFile(kid.id, weekId);

  const userMessage = previous
    ? `Alter: ${kid.alter}. Neue Kalenderwoche: ${weekId}.
Das war die letzte Woche (bitte Schwierigkeit leicht daran anpassen, nicht 1:1 wiederholen):
${JSON.stringify(previous)}`
    : `Alter: ${kid.alter}. Neue Kalenderwoche: ${weekId}. Dies ist die erste Woche, bitte mit
relativ einfachen Aufgaben beginnen.`;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!res.ok) {
    throw new Error(`API-Fehler für ${kid.id}: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  const rawText = data.content.map((block) => block.text || "").join("");

  // Falls das Modell doch Markdown-Codeblöcke verwendet, diese entfernen.
  const cleaned = rawText.replace(/```json|```/g, "").trim();

  let json;
  try {
    json = JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`Konnte Antwort für ${kid.id} nicht als JSON lesen:\n${rawText}`);
  }

  const outDir = path.join("data", kid.id);
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `${weekId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(json, null, 2) + "\n", "utf-8");
  console.log(`✓ Geschrieben: ${outPath}`);

  updateIndex(kid.id, `${weekId}.json`);
}

function updateIndex(kidId, fileName) {
  const indexPath = path.join("data", kidId, "index.json");
  let index = { files: [] };
  if (fs.existsSync(indexPath)) {
    try {
      index = JSON.parse(fs.readFileSync(indexPath, "utf-8"));
    } catch {
      index = { files: [] };
    }
  }
  if (!index.files.includes(fileName)) {
    index.files.push(fileName);
  }
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2) + "\n", "utf-8");
  console.log(`✓ Index aktualisiert: ${indexPath}`);
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Fehler: Umgebungsvariable ANTHROPIC_API_KEY fehlt.");
    process.exit(1);
  }

  const weekId = getIsoWeekId();

  for (const kid of KIDS) {
    await generateForKid(kid, weekId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
