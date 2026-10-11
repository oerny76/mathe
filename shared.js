// Von app.js UND eltern/app.js genutzte Konfiguration (klassische <script>-Tags
// teilen sich dieselbe globale Scope, daher reicht ein gemeinsames "const" hier
// ohne Module/Build-Schritt).

// Hier die beiden Kinder eintragen. "id" muss zum Ordnernamen unter /data passen.
const KIDS = [
  { id: "kind1", name: "Tim", color: "var(--chalk-pink)" },
  { id: "kind2", name: "Marlene", color: "var(--chalk-blue)" },
];

// ---------- Bereiche (Themen-Kategorien) ----------
const BEREICH_ORDER = ["einmaleins", "grundrechenarten", "kopfrechnen", "geometrie", "lesen"];
const BEREICH_LABELS = {
  einmaleins: "✖️ Einmaleins",
  grundrechenarten: "➕➖ Grundrechenarten",
  kopfrechnen: "🧠 Kopfrechnen",
  geometrie: "📐 Geometrie",
  lesen: "📖 Lesen",
};
const BEREICH_ICONS = {
  einmaleins: "✖️",
  grundrechenarten: "➕➖",
  kopfrechnen: "🧠",
  geometrie: "📐",
  lesen: "📖",
};

function bereichLabel(bereich) {
  return BEREICH_LABELS[bereich] || bereich;
}

// ---------- Tägliches Kopfrechnen (eigener Bereich auf jeder Kinderseite) ----------
// Jeden Tag ca. 6 kurze Kopfrechen-Aufgaben (Addition/Subtraktion +
// Multiplikation/Division) direkt auf der Startseite, unabhängig von den
// wöchentlichen Arbeitsblättern – soll nur ~10 Minuten dauern. Aufgaben werden
// im Browser erzeugt (siehe kopf.js), keine eigenen JSON-Dateien nötig.
//
// Jedes Kind startet bewusst auf der leichtesten Stufe (0), um erstmal wieder
// in den Rechen-Fluss zu kommen. Stufen pro Kind sind hier hinterlegt und
// lassen sich später einfach steigern, indem die Zahl in KOPF_STUFE erhöht
// wird (kein Code an anderer Stelle nötig).
const KOPF_STUFE = {
  kind1: 0, // Tim, 9 Jahre (~4. Klasse)
  kind2: 0, // Marlene, 12 Jahre (~7. Klasse)
};

// addSub.max = größte vorkommende Zahl (und größte Summe) bei Addition/
// Subtraktion. tables = Einmaleins-Reihen, aus denen Multiplikation/Division
// gezogen werden (der zweite Faktor ist immer 1–10).
const KOPF_LEVELS = {
  kind1: [
    { addSub: { max: 20 }, tables: [2, 5, 10] },
    { addSub: { max: 50 }, tables: [2, 3, 4, 5, 10] },
    { addSub: { max: 100 }, tables: [2, 3, 4, 5, 6, 10] },
    { addSub: { max: 100 }, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
  ],
  kind2: [
    { addSub: { max: 100 }, tables: [2, 5, 10] },
    { addSub: { max: 200 }, tables: [2, 3, 4, 5, 6, 10] },
    { addSub: { max: 500 }, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10] },
    { addSub: { max: 1000 }, tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  ],
};

// ---------- Supabase (geräteübergreifende Ergebnisse) ----------
// Der publishable Key ist bewusst öffentlich im Client-Code – abgesichert wird
// nicht über Geheimhaltung, sondern über Row-Level-Security-Policies in
// Supabase (nur Insert + Select erlaubt, Constraints auf kid_id/Scores).
const SUPABASE_URL = "https://gkqpgnwmmwvdtpdcqwye.supabase.co";
const SUPABASE_KEY = "sb_publishable_1EraAljaYautx0yw-eLrsw_X25gwY2M";
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;
