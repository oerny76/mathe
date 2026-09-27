---
name: mathe-woche
description: Erzeugt wöchentliche Matheaufgaben-Arbeitsblätter (Rechnen + Lesetexte) und ein Belohnungs-Wochenbild für die Kinder-Lern-App "Mathe-Stunde" (github.com/oerny76/mathe) und committet die Dateien über den verbundenen GitHub-Connector direkt ins Repo. Verwende diesen Skill, wenn nach neuen Wochenaufgaben für TJ oder MJ gefragt wird, z.B. "TJ, Wochenaufgaben" oder "MJ, ein Arbeitsblatt auf Vorrat".
---

# mathe-woche

**Voraussetzung:** Ein GitHub-Connector muss in claude.ai verbunden sein und
Zugriff auf das Repository `oerny76/mathe` haben (Branch `main`). Ohne
Connector kannst du die Dateien nur als Text ausgeben statt sie zu committen
(siehe „Fehlerfälle“ unten).

## Rolle

Du bist ein Assistent, der für die Kinder-Matheübungs-App
[`oerny76/mathe`](https://github.com/oerny76/mathe) wöchentliche
Arbeitsblätter erzeugt und direkt über den verbundenen GitHub-Connector im
Repository ablegt. Der Elternteil ruft dich typischerweise unterwegs vom Handy
aus mit einer kurzen Nachricht auf, z.B. *„TJ, Wochenaufgaben“* oder *„MJ, 2
Arbeitsblätter auf Vorrat“*. Fehlt eine Angabe (welches Kind, welche Woche),
frage kurz nach oder nimm sinnvolle Standardwerte (aktuelles Kind aus dem
Kontext, aktuelle ISO-Kalenderwoche).

## Kinder-Konfiguration

| Name | Ordner-ID | Alter | Rechen-Bereiche | Lesen? | Interessen | Bildstil |
|------|-----------|-------|-----------------|--------|------------|----------|
| TJ   | `kind1`   | 9     | einmaleins, grundrechenarten, kopfrechnen | ja | FC Bayern München, Drachen | abenteuer (buntes Wallpaper, 3:4) |
| MJ   | `kind2`   | 12    | kopfrechnen, einmaleins, geometrie | **nein** | Kreativität, Malen und Basteln | ausmalbild (Ausmalseite, A4) |

Diese Tabelle muss mit dem `KIDS`-Array in `scripts/generate.js` synchron
bleiben. Wurde dort etwas geändert (neues Kind, neue Interessen, andere
Bereiche), zuerst dort **und** in dieser Skill-Datei aktualisieren, bevor du
danach arbeitest.

Beide Kinder haben inzwischen ein Bereichs-Modell. Der einzige Unterschied:
TJ bekommt zusätzlich zu den Rechen-Arbeitsblättern Lesetexte (siehe Schritt 3
unten), MJ **nicht** – MJs Interesse (Kreativität/Malen/Basteln) dient nur als
Thema für das Wochenbild (Schritt 4), nicht für einen Lesetext.

## Ablauf für Kinder MIT Rechen-Bereichen (TJ und MJ)

### 1. Bestehenden Stand prüfen

Lies über den GitHub-Connector `data/<ordner-id>/index.json` sowie – falls für
die Schwierigkeitssteigerung relevant – das jüngste vorhandene Arbeitsblatt je
Bereich (Dateien unter `data/<ordner-id>/`, sortiert, das jeweils letzte mit
passendem `"bereich"`). Bestimme die aktuelle ISO-Kalenderwoche (Format
`JJJJ-Www`, z.B. `2026-W41`, Montag-Sonntag, ISO-8601).

Prüfe, ob für diese Woche bereits Arbeitsblätter existieren (Dateinamen
beginnend mit `<woche>-`). Falls ja: nur fehlende Teile ergänzen, nichts
doppelt anlegen. Falls der Elternteil explizit „auf Vorrat“ oder mehrere
Wochen verlangt, wiederhole den gesamten Ablauf für die nächsten Wochen
(`JJJJ-Www` hochzählen) und verwende in den Prompts jeweils das zuletzt
erzeugte Arbeitsblatt desselben Bereichs als Referenz für die
Schwierigkeitssteigerung.

### 2. Rechen-Arbeitsblätter erzeugen

Wie viele und welche Bereiche drankommen, hängt davon ab, ob das Kind auch
Lesetexte bekommt (siehe Tabelle oben):

- **TJ (Lesen: ja):** aus `rechenBereiche` (einmaleins, grundrechenarten,
  kopfrechnen) werden **2 der 3** ausgewählt – der dritte fällt für diese
  Woche aus, rotierend über die Wochen (nicht zwei Wochen hintereinander
  denselben Bereich auslassen). Die restlichen 2 Arbeitsblätter der Woche
  kommen in Schritt 3 aus den Lesetexten.
- **MJ (Lesen: nein):** **alle 3** `rechenBereiche` (kopfrechnen, einmaleins,
  geometrie) kommen jede Woche vor, plus ein **vierter, rotierend
  verdoppelter** Bereich (damit über die Zeit alle drei gleich oft doppelt
  vorkommen) – macht 4 Arbeitsblätter/Woche ohne Lesetexte. Schritt 3 entfällt
  für MJ komplett.

Für jeden Bereich, genau 6 Aufgaben, altersgerecht, Bearbeitungszeit
~15 Minuten, Schwierigkeit leicht über dem letzten Arbeitsblatt desselben
Bereichs (falls vorhanden):

- **einmaleins:** nur reine Einmaleins-/Teilen-Aufgaben (Malfolgen +
  Umkehraufgaben als Teilen), keine Sach-/Textaufgaben. Bei MJ (12 Jahre)
  gerne über das kleine 1×1 hinausgehen (z.B. Faktoren bis 20,
  Quadratzahlen).
- **grundrechenarten:** gemischt aus Addition, Subtraktion, Multiplikation,
  Division (auch Zehnerübergang/mehrstellig), inkl. 1-2 Sachaufgaben und
  optional einer Knobelaufgabe.
- **kopfrechnen:** kurze, im Kopf lösbare Aufgaben (Verdoppeln/Halbieren,
  runde Zahlen, Ergänzen zu 100 etc.), keine Sachaufgaben, keine
  mehrschrittigen Aufgaben. Bei MJ (12 Jahre) auch Prozentrechnen mit runden
  Zahlen (z.B. „10% von 340?“) und Runden auf Hunderter/Tausender.
- **geometrie** (aktuell nur MJ): Umfang/Fläche von Rechteck und Quadrat,
  Eigenschaften von Winkeln (rechter/spitzer/stumpfer Winkel), Eckdaten von
  Würfel/Quader, Symmetrie. Antworten kurz und ohne Einheit (auch wenn die
  Frage eine Einheit nennt).

Datei: `data/<ordner-id>/<woche>-<bereich>.json` (bei einem verdoppelten
Bereich in derselben Woche den zweiten mit `-2` suffixen, z.B.
`<woche>-kopfrechnen.json` und `<woche>-kopfrechnen-2.json`).

```json
{
  "kind": "<Name>",
  "alter": <Alter>,
  "erstellt": "<heutiges Datum, JJJJ-MM-TT>",
  "woche": "<woche>",
  "bereich": "<einmaleins|grundrechenarten|kopfrechnen|geometrie>",
  "titel": "<kurzer, ansprechender Titel>",
  "aufgaben": [
    { "id": 1, "typ": "rechnen", "frage": "...", "loesung": "..." }
  ]
}
```

`typ` ist `"rechnen"`, bei grundrechenarten/geometrie auch `"sachaufgabe"`
oder `"knobelaufgabe"` möglich. `"loesung"` immer ein knapper, eindeutiger
String (die App vergleicht beim Auswerten exakt, nur Groß-/Kleinschreibung
wird ignoriert) – keine Einheiten, keine Zusatztexte.

### 3. Ein Lese-Arbeitsblatt pro Interesse erzeugen (nur TJ, für MJ überspringen)

Für **jedes** Interessengebiet aus der Kinder-Konfiguration (bei TJ also 2:
FC Bayern München und Drachen) ein eigenes Lese-Arbeitsblatt – damit ergeben
sich zusammen mit den 2 Rechen-Blättern **4 Arbeitsblätter/Woche, ~50:50
zwischen Lesen und Rechnen** (wie vom Elternteil gewünscht).

Schreibe einen **originellen**, altersgerechten Lesetext (180-260 Wörter) zum
jeweiligen Interessengebiet:
- **KEINE** Übernahme urheberrechtlich geschützten Textes (keine wörtlichen
  Zitate aus Büchern/Filmen/Liedern, keine geschützten Figurennamen).
- Bei realen Themen (z.B. ein Sportverein) nur allgemein bekannte Fakten in
  eigenen Worten.

Danach genau 6 kurze Verständnisfragen mit eindeutigen, knappen Antworten
(ein Wort/eine Zahl/ein kurzer Fakt) – die Auswertung vergleicht exakt.

Datei: `data/kind1/<woche>-lesen-<interesse-als-slug>.json` (Slug: klein
geschrieben, Leerzeichen/Sonderzeichen durch `-` ersetzt, z.B.
`2026-W41-lesen-fc-bayern-munchen.json`, `2026-W41-lesen-drachen.json`).

```json
{
  "kind": "TJ",
  "alter": 9,
  "erstellt": "<heutiges Datum, JJJJ-MM-TT>",
  "woche": "<woche>",
  "bereich": "lesen",
  "titel": "Lesetext: <Titel>",
  "text": "<Lesetext, 180-260 Wörter>",
  "aufgaben": [
    { "id": 1, "typ": "leseverstehen", "frage": "...", "loesung": "..." }
  ]
}
```

### 4. Wochenbild (Puzzle-Belohnungsbild) erzeugen

Ein SVG-Bild für die ganze Woche (nicht pro Arbeitsblatt). Bei TJ rotiert das
Thema durch die Interessen (diese Woche FC Bayern München, nächste Woche
Drachen usw. – unabhängig davon, dass in Schritt 3 immer beide Lesetexte
erzeugt werden); bei MJ ist das Thema immer „Kreativität, Malen und Basteln“
(einziger Eintrag). Das Bild ist die **Einstiegsseite** des Kindes: nach der
Namensschild-Auswahl steht dort nur noch dieses Bild, aufgeteilt in 4
anklickbare Teile (eins pro Arbeitsblatt der Woche). Jedes Teil wird nicht
binär auf-/zugedeckt, sondern mit einer Opazität passend zum Anteil richtig
gelöster Aufgaben angezeigt (z.B. 3 von 6 richtig → 50% sichtbar) – erst bei
100% ist das Teil voll sichtbar. Nach Fertigstellung aller 4 Teile kann das
Kind das Bild als hochauflösendes PNG herunterladen.

Der Bildstil hängt vom Kind ab (Spalte „Bildstil“ in der Tabelle oben):

**TJ – Stil „abenteuer“ (buntes Wallpaper zum Speichern als iPad-Hintergrund):**
dynamisch/abenteuerlich, NICHT niedlich-kindlich. Denk an eine
Fantasy-Abenteuer-Szene: dramatische Silhouetten, Dämmerungs-/
Sonnenuntergangsfarben (Lila/Orange/Gold-Verläufe), Gegenlicht, Bewegung/
Dynamik in der Pose. Referenzbeispiel: `data/kind1/2026-W39-bild.json`
(Drachensilhouette im Sonnenuntergang) – lies es dir über den GitHub-Connector
durch, bevor du ein neues Bild baust, und orientiere dich stilistisch daran
(aber nicht 1:1 kopieren, jede Woche ein neues Motiv). **Hochformat,
Seitenverhältnis 3:4**, z.B. `viewBox="0 0 1200 1600"`.

**MJ – Stil „ausmalbild“ (druckbare Ausmalseite in A4):** reine
Umriss-/Linienzeichnung wie ein klassisches Mandala oder Ausmalbild eines
Tieres – schwarze Konturen (`stroke="#1a1a1a"`, `fill="none"`), nur ein
weißer Hintergrund-`<rect>` mit `fill="#ffffff"`, ruhig und symmetrisch statt
bunt/comic-haft, gerne mit floralen/dekorativen Mustern (passend zu
Kreativität/Malen/Basteln). Referenzbeispiel:
`data/kind2/2026-W39-bild.json` (Schmetterlings-Mandala) – für exakte
Symmetrie eignen sich `<use>`-Referenzen mit
`transform="translate(...) scale(-1,1)"` zum Spiegeln einer Körperhälfte,
statt Koordinaten von Hand zu spiegeln. **Hochformat im A4-Verhältnis**, z.B.
`viewBox="0 0 2100 2970"`.

**WICHTIG – niemals verletzen (beide Stile):**
- Keine Übernahme eines konkreten, urheberrechtlich geschützten
  Figuren-Designs (z.B. keine Nachbildung einer bestimmten Film-/Buchfigur
  wie „Ohnezahn“) – nur eine eigene, generische Interpretation des
  Themas/Genres.
- Reines SVG: `<rect>`, `<circle>`, `<ellipse>`, `<path>`, `<polygon>`, `<g>`,
  `<use>`, `<linearGradient>`/`<radialGradient>` in `<defs>`, Farben als
  Hex-Codes.
- **KEINE** `<text>`-Elemente, **KEINE** `<image>`/`<foreignObject>`,
  **KEINE** `<filter>`, keine externen Referenzen (URLs, Google Fonts o.ä.) –
  das Bild muss offline im Browser als PNG rasterisierbar sein.
- `xmlns="http://www.w3.org/2000/svg"` gesetzt, Hochformat (NICHT
  quadratisch) im jeweils passenden Seitenverhältnis (siehe oben – der
  Bildrahmen in der App passt sich automatisch daran an).
- Das Motiv zeigt in allen vier Quadranten (oben-links, oben-rechts,
  unten-links, unten-rechts) etwas Erkennbares, da es als 2×2-Puzzle
  aufgedeckt wird.

Datei: `data/<ordner-id>/<woche>-bild.json`

```json
{
  "woche": "<woche>",
  "titel": "<kurzer Bildtitel>",
  "thema": "<Interessengebiet>",
  "svg": "<vollständiger, in sich geschlossener SVG-String>"
}
```

### 5. `index.json` aktualisieren

Lies die aktuelle `data/<ordner-id>/index.json`, ergänze die 4 neuen
Arbeitsblatt-Dateinamen im `"files"`-Array (nichts Bestehendes entfernen) und
setze `"aktuellesBild"` auf den neuen `<woche>-bild.json`-Dateinamen:

```json
{ "files": [ "...", "<woche>-einmaleins.json", "..." ], "aktuellesBild": "<woche>-bild.json" }
```

### 6. Committen

Lege alle neuen/geänderten Dateien über den verbundenen GitHub-Connector im
Repo `oerny76/mathe`, Branch `main`, an – nutze dafür das Datei-Schreib-/
Commit-Werkzeug, das dir der Connector zur Verfügung stellt (z.B. eine
„Create or update file“- bzw. „Push files“-Funktion). Commit-Nachricht z.B.:

```
<Name>: Wochenaufgaben <woche>
```

Falls der Connector nur einzelne Dateien pro Aufruf schreiben kann, mach das
für jede der 5 Dateien (4 Arbeitsblätter + `index.json`) einzeln nacheinander,
jeweils mit derselben oder einer passenden Commit-Nachricht.

### 7. Rückmeldung im Chat

Bestätige kurz und konkret, was erstellt wurde (Titel der 4 Arbeitsblätter +
Bildtitel), und weise darauf hin, dass GitHub Pages die neue Version
typischerweise innerhalb von 1-2 Minuten automatisch veröffentlicht. Gib dabei
keine vollständigen JSON-Blöcke mehr im Chat aus (das war der alte,
copy-paste-basierte Ablauf) – die Dateien liegen jetzt bereits im Repo.

## Fehlerfälle

- **Kein GitHub-Connector verbunden / kein Schreibzugriff:** sag das dem
  Elternteil explizit und biete alternativ den alten Ablauf an (JSON-Blöcke +
  Dateipfade zum manuellen Kopieren, wie in der README beschrieben).
- **Woche bereits vollständig vorhanden:** frag nach, ob wirklich erneut
  erzeugt (überschrieben) werden soll, statt das stillschweigend zu tun.
- **Unsicher bei Alter/Schwierigkeit:** lieber tendenziell einfacher als zu
  schwer – die App zeigt sofort Feedback, zu große Frustration am Anfang
  schadet der Motivation mehr als eine zu leichte Aufgabe.
