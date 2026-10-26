// Von app.js UND eltern/app.js genutzte Konfiguration (klassische <script>-Tags
// teilen sich dieselbe globale Scope, daher reicht ein gemeinsames "const" hier
// ohne Module/Build-Schritt).

// Hier die beiden Kinder eintragen. "id" muss zum Ordnernamen unter /data passen.
const KIDS = [
  {
    id: "kind1",
    name: "Tim",
    klasse: 4,
    color: "var(--chalk-pink)",
    // Sammelwelt: Wer genug Sterne gesammelt hat, schaltet der Reihe nach neue
    // Funde frei ("ab" = benötigte Sterne insgesamt, der erste ist von Anfang an da).
    welt: {
      titel: "Drachenreich",
      items: [
        { emoji: "🥚", name: "Drachenei", ab: 0 },
        { emoji: "🔥", name: "Erster Funke", ab: 20 },
        { emoji: "🐲", name: "Drachenbaby", ab: 50 },
        { emoji: "💎", name: "Glutkristall", ab: 90 },
        { emoji: "🌋", name: "Vulkanhöhle", ab: 140 },
        { emoji: "🛡️", name: "Drachenschild", ab: 200 },
        { emoji: "⚔️", name: "Drachenschwert", ab: 280 },
        { emoji: "🏰", name: "Drachenburg", ab: 380 },
        { emoji: "🌩️", name: "Sturmdrache", ab: 500 },
        { emoji: "👑", name: "Drachenkrone", ab: 640 },
        { emoji: "🐉", name: "Großer Drache", ab: 800 },
        { emoji: "🌟", name: "Drachenkönig", ab: 1000 },
      ],
    },
  },
  {
    id: "kind2",
    name: "Marlene",
    klasse: 7,
    color: "var(--chalk-blue)",
    welt: {
      titel: "Herbstwald",
      items: [
        { emoji: "🍂", name: "Erstes Herbstblatt", ab: 0 },
        { emoji: "🌰", name: "Kastanie", ab: 20 },
        { emoji: "🍄", name: "Waldpilz", ab: 50 },
        { emoji: "🍁", name: "Ahornblatt", ab: 90 },
        { emoji: "🎃", name: "Kürbis", ab: 140 },
        { emoji: "🦔", name: "Igel", ab: 200 },
        { emoji: "🐿️", name: "Eichhörnchen", ab: 280 },
        { emoji: "🍎", name: "Apfelernte", ab: 380 },
        { emoji: "🏮", name: "Laterne", ab: 500 },
        { emoji: "🦉", name: "Eule", ab: 640 },
        { emoji: "🌾", name: "Erntedank", ab: 800 },
        { emoji: "🏡", name: "Waldhütte", ab: 1000 },
      ],
    },
  },
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

// ---------- Supabase (geräteübergreifende Ergebnisse) ----------
// Der publishable Key ist bewusst öffentlich im Client-Code – abgesichert wird
// nicht über Geheimhaltung, sondern über Row-Level-Security-Policies in
// Supabase (nur Insert + Select erlaubt, Constraints auf kid_id/Scores).
const SUPABASE_URL = "https://gkqpgnwmmwvdtpdcqwye.supabase.co";
const SUPABASE_KEY = "sb_publishable_1EraAljaYautx0yw-eLrsw_X25gwY2M";
const supabaseClient = window.supabase
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

// ---------- Neustart ----------
// RESET_EPOCH: Supabase-Einträge davor werden ignoriert (bleiben als Archiv
// in der Datenbank). RESET_VERSION: Ändert man sie, räumt jedes Gerät beim
// nächsten Öffnen einmalig seinen lokalen Fortschritt und den Cache auf.
const RESET_EPOCH = "2026-10-26T00:00:00Z";
const RESET_VERSION = "2026-10-26";

(function applyResetIfNeeded() {
  try {
    if (localStorage.getItem("mathe-pwa:reset-version") === RESET_VERSION) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("mathe-pwa:"))
      .forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("mathe-pwa:reset-version", RESET_VERSION);
  } catch (e) {
    return;
  }
  if (window.caches) {
    caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
  }
})();
