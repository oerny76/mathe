# Mathe-Stunde – PWA für regelmäßiges Matheüben

Kleine installierbare Web-App (PWA), die den Kindern eine Auswahl an
altersgerechten Matheaufgaben zeigt, aus der sie sich selbst ein
Arbeitsblatt aussuchen können. Läuft direkt auf dem iPad, wertet die
Antworten im Browser aus – kein Server nötig.

## Wie es funktioniert

1. Du erstellst Arbeitsblätter **manuell auf Zuruf** – entweder direkt hier
   im Chat über den Skill `mathe-woche` (empfohlen, siehe unten) oder über
   den optionalen automatisierten Generator (siehe „Automatisierung“).
2. Jedes Arbeitsblatt liegt als JSON-Datei unter `data/<kindId>/<Dateiname>.json`.
   Welche Arbeitsblätter zur Auswahl stehen, steht in `data/<kindId>/index.json`.
3. Die Web-App zeigt beim Öffnen zuerst das Namensschild-Auswahlmenü, danach
   pro Kind eine Liste aller verfügbaren, noch nicht/bereits erledigten
   Arbeitsblätter. Das Kind wählt eins aus, bearbeitet es und bekommt sofort
   eine Auswertung.
4. Über GitHub Pages gehostet, lässt sie sich auf dem iPad über Safari
   „Zum Home-Bildschirm hinzufügen“ wie eine echte App installieren.

## Arbeitsblätter erstellen (empfohlener Weg: Skill)

1. In einem Claude-Chat (claude.ai) den Skill `mathe-woche` einmalig
   installieren (`mathe-woche.skill` → „Save skill“).
2. Danach einfach z.B. schreiben: *„TJ, 9 Jahre, 2 Arbeitsblätter auf
   Vorrat“*. Der Skill fragt fehlende Angaben nach, zeigt eine kurze
   Themen-Übersicht zur Bestätigung und liefert am Ende:
   - für jedes Arbeitsblatt einen JSON-Code-Block + Dateipfad
     (`data/kind1/2026-08-05-taschengeld.json`)
   - eine Ergänzung für `data/kind1/index.json` (welche Dateinamen ins
     `"files"`-Array müssen)
3. Beides in dein Repo kopieren, committen, fertig – kein Server, kein
   API-Key im Repo nötig.

Du kannst diesen Skill jederzeit auf Zuruf aufrufen, auch mehrmals
hintereinander, um mehrere Arbeitsblätter „auf Vorrat“ vorzubereiten.

## Struktur der Dateien

```
data/
  kind1/
    index.json              ← Liste aller verfügbaren Arbeitsblätter
    2026-08-05-taschengeld.json
    2026-08-10-einmaleins.json
  kind2/
    index.json
    ...
```

`index.json`:
```json
{ "files": ["2026-08-05-taschengeld.json", "2026-08-10-einmaleins.json"] }
```

Arbeitsblatt-JSON (Format, das der Skill erzeugt):
```json
{
  "kind": "TJ",
  "alter": 9,
  "erstellt": "2026-08-05",
  "titel": "Taschengeld & Zehnerübergang",
  "aufgaben": [
    { "id": 1, "typ": "rechnen", "frage": "27 + 18 = ?", "loesung": "45" }
  ]
}
```

### Optionale Felder: Bereiche & Lesetexte

Damit Kinder mit unterschiedlichem Förderbedarf (z.B. verschiedene Jahrgänge)
eigene, thematisch sortierte Übungsblöcke bekommen, kann jedes Arbeitsblatt
zusätzlich ein Feld `"bereich"` bekommen. Die App gruppiert die
Arbeitsblatt-Auswahl dann automatisch nach Bereich (mit Überschrift), statt
alles in einer Liste zu zeigen. Ohne `"bereich"`-Feld bleibt die Ansicht wie
bisher flach.

Bekannte Bereiche mit fester Reihenfolge/Icon in `app.js` (`BEREICH_LABELS`):
`"einmaleins"`, `"grundrechenarten"`, `"kopfrechnen"`, `"geometrie"`,
`"lesen"`. Weitere, frei gewählte Bereichs-Strings werden alphabetisch nach
den bekannten angezeigt.

Aktuell genutzte Bereiche pro Kind:
- **TJ:** `einmaleins`, `grundrechenarten`, `kopfrechnen`, `lesen`.
- **MJ:** `einmaleins`, `kopfrechnen`, `geometrie` – bewusst **kein** `lesen`
  (MJs Interesse liegt bei Kreativität/Malen/Basteln statt Lesetexten).

Für Lese-Arbeitsblätter gibt es zusätzlich ein optionales Feld `"text"` auf
oberster Ebene: ein Lesetext, der über den Aufgaben angezeigt wird. Die
`aufgaben` sind dann Verständnisfragen (Typ `"leseverstehen"`) mit kurzen,
eindeutigen Antworten (die Auswertung vergleicht exakt, Groß-/Kleinschreibung
wird ignoriert):

```json
{
  "kind": "TJ",
  "alter": 9,
  "erstellt": "2026-09-27",
  "bereich": "lesen",
  "titel": "Lesetext: ...",
  "text": "Ein kurzer, altersgerechter Text, gerne zu einem Interessengebiet des Kindes (z.B. Lieblingsverein, Lieblingsbuch/-serie) – das macht Lesen leichter.",
  "aufgaben": [
    { "id": 1, "typ": "leseverstehen", "frage": "Worum ging es im Text?", "loesung": "kurze, eindeutige Antwort" }
  ]
}
```

### Wochenpensum

Beide Kinder mit Bereichen bekommen **4 Arbeitsblätter pro Woche**, aber mit
unterschiedlicher Aufteilung, je nach Interessen:

**TJ – ~50:50 Lesen und Rechnen:**
- **2 Rechen-Arbeitsblätter**, rotierend aus den Rechen-Bereichen (aktuell
  Einmaleins/Grundrechenarten/Kopfrechnen – pro Woche werden 2 der 3
  ausgewählt, damit langfristig alle drankommen).
- **2 Lese-Arbeitsblätter**, eins pro Interessengebiet des Kindes (aktuell FC
  Bayern München und Drachen) – so kommen beide Interessen jede Woche vor.

**MJ – nur Rechnen, kein Lesen:**
- **4 Rechen-Arbeitsblätter**, aus den Bereichen Kopfrechnen/Einmaleins/
  Geometrie: alle drei kommen jede Woche vor, plus ein vierter, rotierend
  verdoppelter Bereich (damit über die Zeit alle drei gleich oft doppelt
  vorkommen).

Jedes Arbeitsblatt ist für ~15 Minuten ausgelegt (6 Aufgaben bei Rechen-
Blättern, 6 Verständnisfragen zu einem Lesetext bei Lese-Blättern). Das Kind
sucht sich daraus täglich eins aus. Damit mehrere Arbeitsblätter *derselben*
Woche erkennbar zusammengehören (fürs Wochenbild-Puzzle, siehe unten),
bekommen sie zusätzlich ein Feld `"woche"` mit der ISO-Kalenderwoche (z.B.
`"2026-W39"`):

```json
{ "bereich": "einmaleins", "woche": "2026-W39", "titel": "...", "aufgaben": [ /* ... */ ] }
```

Arbeitsblätter ohne `"woche"` gelten als Backlog/Extra-Übung und laufen nicht
ins Wochenbild ein – sie bleiben aber ganz normal spielbar.

### Wochenbild-Puzzle (Gamification, Einstiegsseite)

Für Kinder mit Wochenbild (aktuell TJ und MJ) **ist das Bild die
Einstiegsseite**: nach der Namensschild-Auswahl steht dort nur noch das große
Hochformat-Bild, aufgeteilt in 4 anklickbare Teile – eins pro Arbeitsblatt der
aktuellen Woche. Das Seitenverhältnis des Rahmens wird automatisch aus dem
`viewBox` des jeweiligen Bildes abgeleitet (siehe unten, zwei Bild-Varianten
mit unterschiedlichem Format) – muss also nicht im Code angepasst werden. Ein
Tippen auf
ein Teil öffnet direkt das zugehörige Arbeitsblatt (die Kachel trägt Icon,
Kurzlabel und Punktestand als Orientierung, auch wenn das Bild darunter noch
kaum zu sehen ist).

Jedes Teil ist nicht einfach nur verdeckt/aufgedeckt, sondern zeigt das Bild
mit einer **Opazität passend zum Anteil richtig gelöster Aufgaben** dieses
Arbeitsblatts (z.B. 3 von 6 richtig → Teil zu 50% sichtbar). Erst wenn
**alle** Aufgaben eines Arbeitsblatts richtig sind, ist das Teil komplett
sichtbar. Falsche Antworten lassen sich jederzeit erneut anklicken und
korrigieren (beim Wiederöffnen sind bereits beantwortete Aufgaben sofort
grün/rot markiert) – herausfordernd, aber nicht frustrierend, da nichts
verloren geht und Teilfortschritt sofort sichtbar wird.

Weitere, nicht der aktuellen Woche zugeordnete Arbeitsblätter (Backlog/Extra-
Übung) verschwinden dabei nicht: ein kleiner Button „📚 Weitere Übungen“
unter dem Bild blendet sie bei Bedarf als klassische Liste ein.

Sind alle 4 Teile fertig, bekommt der Bildrahmen einen goldenen Schimmer und
ein Button erscheint, um das Bild als **hochauflösendes PNG** herunterzuladen
(Seitenverhältnis und Auflösung werden automatisch aus dem `viewBox` des SVG
abgeleitet, Ziel-Langseite ca. 3300px – direkt im Browser aus dem SVG
gerendert, kein Server nötig) – bei TJ zum Speichern als iPad-Hintergrundbild,
bei MJ zum Ausdrucken in A4 und Ausmalen mit Stiften.

Dafür trägt `index.json` zusätzlich ein, welches Bild aktuell gilt:

```json
{ "files": [ /* ... */ ], "aktuellesBild": "2026-W39-bild.json" }
```

Die referenzierte Datei (`data/<kindId>/2026-W39-bild.json`) sieht so aus:

```json
{
  "woche": "2026-W39",
  "titel": "Drachenflug im Abendrot",
  "thema": "Drachen",
  "svg": "<svg viewBox=\"0 0 800 800\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

Wichtig für das `svg`-Feld, egal ob von Hand, per Skill oder per
`scripts/generate.js` erzeugt – unabhängig vom Stil (siehe unten):
- in sich geschlossen, keine externen Referenzen (keine Bilder/Fonts/URLs) –
  muss offline aus dem Browser heraus als PNG rasterisierbar sein
- nur einfache Formen (`rect`, `circle`, `ellipse`, `path`, `polygon`, `g`,
  `use`, Gradients in `defs`), **keine** `<text>`-Elemente (Schriftladen kann
  beim Rasterisieren scheitern) und keine `<filter>`
- Keine Nachbildung konkreter, urheberrechtlich geschützter Figuren-Designs
  (z.B. keine 1:1-Kopie einer bestimmten Film-/Buchfigur) – nur eine eigene,
  generische Interpretation des Themas/Genres.
- das Motiv passt idealerweise zu einem Interessengebiet des Kindes und zeigt
  in allen vier Quadranten (oben-links/-rechts, unten-links/-rechts) etwas
  Erkennbares, da es als 2×2-Puzzle aufgedeckt wird
- die Puzzle-Teile entsprechen den tatsächlichen Arbeitsblättern der Woche (in
  alphabetischer Dateinamen-Reihenfolge auf die 4 Positionen verteilt) – nicht
  einer festen Bereichs-Zuordnung, da eine Woche z.B. 2 Lese- + 2
  Rechen-Arbeitsblätter statt 4 verschiedener Bereiche enthalten kann

Zwei Bild-Varianten sind im Einsatz, je nach Interesse des Kindes:

**„Abenteuer"-Wallpaper (aktuell TJ):** Hochformat-`viewBox` im Verhältnis 3:4
(z.B. `viewBox="0 0 1200 1600"`), zum Speichern als iPad-Hintergrund. Stil:
dynamisch/abenteuerlich statt niedlich-kindlich – Silhouetten vor einem
Dämmerungs-/Sonnenuntergangs-Verlauf wirken deutlich "cooler" als flache
Cartoon-Farben (siehe `data/kind1/2026-W39-bild.json` als Beispiel).

**Ausmalbild (aktuell MJ):** Hochformat-`viewBox` im A4-Verhältnis (z.B.
`viewBox="0 0 2100 2970"`), zum Ausdrucken und Ausmalen mit Stiften. Stil:
reine Umriss-/Linienzeichnung wie ein klassisches Mandala oder Ausmalbild
eines Tieres – schwarze Konturen (`stroke`, `fill="none"`), nur ein weißer
Hintergrund-`rect` mit `fill`, ruhig und symmetrisch statt bunt (siehe
`data/kind2/2026-W39-bild.json` als Beispiel: eine Schmetterlings-Mandala).
Passend zu Interessen wie Kreativität/Malen/Basteln; für exakte Symmetrie
eignen sich `<use>`-Referenzen mit `transform="translate(...) scale(-1,1)"`
zum Spiegeln einer Körperhälfte.

Ohne `"aktuellesBild"` in `index.json` bleibt das Puzzle einfach ausgeblendet
(z.B. bei MJ aktuell der Fall).

## Einrichtung (einmalig)

### 1. Kinder konfigurieren
In `app.js` das Array `KIDS` anpassen (Namen, Farben). Die Ordner-IDs
(`kind1`, `kind2`) müssen dazu passen.

### 2. GitHub Pages aktivieren
**Settings → Pages** → Branch `main`, Ordner `/ (root)` auswählen → Speichern.
Nach ein bis zwei Minuten ist die App unter
`https://<dein-username>.github.io/<repo-name>/` erreichbar.

### 3. Icons ergänzen (optional, aber empfohlen)
Zwei PNG-Icons unter `icons/icon-192.png` und `icons/icon-512.png` ablegen,
sonst zeigt iOS beim Homescreen-Symbol nur einen Screenshot der Seite.

Beispieldateien liegen bereits unter `data/kind1/` und `data/kind2/` im Repo
(jeweils in `index.json` verlinkt), damit du die App sofort ausprobieren
kannst.

## Auf dem iPad installieren

1. Seite in Safari öffnen (die GitHub-Pages-URL).
2. Teilen-Symbol → „Zum Home-Bildschirm“.
3. Ab jetzt öffnet sich die App wie eine normale App, per Fingertipp,
   auch ohne Adressleiste.

## Automatisierung (optional, nicht der empfohlene Standardweg)

Falls du doch mal automatisch statt manuell erzeugen willst, ruft
`scripts/generate.js` die Claude-API auf und aktualisiert dabei gleich die
passende `index.json`:

```bash
ANTHROPIC_API_KEY=sk-... npm run generate
```

Für Kinder mit `rechenBereiche` in der `KIDS`-Konfiguration im Skript (aktuell
TJ und MJ) erzeugt der Lauf pro Woche Rechen-Arbeitsblätter aus
`rechenBereiche`, getaggt mit `bereich` + `woche`, sowie ein passendes
Wochenbild (`<woche>-bild.json`, siehe „Wochenbild-Puzzle“ oben). Ob dazu noch
Lesetexte kommen, steuert das Feld `lesen` (Standard: `true`):
- **`lesen` nicht gesetzt oder `true` (aktuell TJ):** 2 der 3
  `rechenBereiche` rotierend pro Woche + 1 Lese-Arbeitsblatt pro Eintrag in
  `interessen` (~50:50, siehe „Wochenpensum“ oben). Bildthema rotiert durch
  `interessen`, Bildstil `bildStil: "abenteuer"` (Standard).
- **`lesen: false` (aktuell MJ):** alle `rechenBereiche` jede Woche + ein
  vierter, rotierend verdoppelter Bereich (macht 4 Arbeitsblätter/Woche ohne
  Lesetexte). `interessen` dient hier nur als Bildthema (z.B. `["Kreativität,
  Malen und Basteln"]`), Bildstil `bildStil: "ausmalbild"` erzeugt ein
  druckbares Ausmalbild im A4-Format statt des Abenteuer-Wallpapers.

Das Skript läuft **nicht automatisch** (es gibt bewusst keinen
GitHub-Actions-Workflow dafür) – du rufst es bei Bedarf lokal auf und
committest die neu erzeugten Dateien wie gewohnt. Das Wochenbild ist
„Best effort“: schlägt die Bild-Erzeugung fehl oder liefert kein gültiges
SVG, werden trotzdem alle Arbeitsblätter des Laufs geschrieben, nur eben ohne
neues Puzzle-Bild für diese Woche.

Für unterwegs (z.B. vom Handy aus) ist der Skill-Weg praktikabler als dieses
Skript – siehe „Von unterwegs: Skill + GitHub-Connector“ direkt im Anschluss.

## Von unterwegs: Skill + GitHub-Connector

Damit du auch vom Handy aus (ohne Laptop, ohne `ANTHROPIC_API_KEY` lokal)
jederzeit neue Arbeitsblätter erzeugen und **automatisch ins Repo committen**
lassen kannst, läuft das über die claude.ai-App:

1. In den claude.ai-Einstellungen einen **GitHub-Connector** verbinden und ihm
   Zugriff auf das Repo `oerny76/mathe` geben (Connectors → GitHub → Repo
   auswählen).
2. Den Skill `mathe-woche` auf claude.ai anlegen/aktualisieren: claude.ai
   erwartet dafür eine Datei namens **`SKILL.md`** mit YAML-Frontmatter am
   Anfang (`---`-Block mit `name`/`description`) – reines Markdown ohne
   Frontmatter wird beim Hochladen abgelehnt. Genau diese Datei liegt fertig
   unter [`docs/mathe-woche/SKILL.md`](docs/mathe-woche/SKILL.md) in diesem
   Repo – beim Anlegen/Bearbeiten des Skills auf claude.ai hochladen bzw.
   deren Inhalt einfügen.
3. Danach reicht in der claude.ai-App (auch auf dem Handy) z.B.: *„TJ,
   Wochenaufgaben für diese Woche“* – der Skill erzeugt die 4 Arbeitsblätter +
   das Wochenbild passend zum aktuellen Format (Bereiche, `woche`, 50:50-
   Aufteilung, Wochenbild-Puzzle) und committet sie über den GitHub-Connector
   direkt in `main`. Kein manuelles Kopieren mehr nötig.

[`docs/mathe-woche/SKILL.md`](docs/mathe-woche/SKILL.md) ist der **Vertrag**
zwischen Skill und App: immer wenn sich an den Datenformaten hier im Repo
etwas ändert (neue Felder, neue Bereiche, anderes Verhältnis Lesen/Rechnen),
muss diese Datei mit aktualisiert und auf claude.ai neu hochgeladen werden.

## Anpassungsideen für später

- **Alte Arbeitsblätter aufräumen:** erledigte, alte Dateien aus `index.json`
  entfernen (die JSON-Datei selbst kann im Repo bleiben).
- **Mehr Kinder:** weitere Einträge in `KIDS` (`app.js` und
  `scripts/generate.js`) und passende Datenordner samt `index.json` ergänzen.
