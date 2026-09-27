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
bisher flach (z.B. bei MJ aktuell der Fall).

Bekannte Bereiche mit fester Reihenfolge/Icon in `app.js` (`BEREICH_LABELS`):
`"einmaleins"`, `"grundrechenarten"`, `"kopfrechnen"`, `"lesen"`. Weitere,
frei gewählte Bereichs-Strings werden alphabetisch nach den bekannten
angezeigt.

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

### Wochenpensum: ein Arbeitsblatt pro Bereich

Für Kinder mit Bereichen (aktuell TJ) gilt: **pro Woche ein Arbeitsblatt je
Bereich** (also 4 Stück bei den 4 bekannten Bereichen), jeweils für ~15 Minuten
ausgelegt. Das Kind sucht sich daraus täglich eins aus – an manchen Tagen ggf.
auch einen Bereich doppelt, falls die Woche mehr Tage als Bereiche hat. Damit
mehrere Arbeitsblätter *derselben* Woche erkennbar zusammengehören (fürs
Wochenbild-Puzzle, siehe unten), bekommen sie zusätzlich ein Feld `"woche"`
mit der ISO-Kalenderwoche (z.B. `"2026-W39"`):

```json
{ "bereich": "einmaleins", "woche": "2026-W39", "titel": "...", "aufgaben": [ /* ... */ ] }
```

Arbeitsblätter ohne `"woche"` gelten als Backlog/Extra-Übung und laufen nicht
ins Wochenbild ein – sie bleiben aber ganz normal spielbar.

### Wochenbild-Puzzle (Gamification)

Oben in der App wird pro Kind (falls vorhanden) ein Puzzle-Belohnungsbild
angezeigt: Für jeden in der aktuellen Woche erledigten Bereich deckt sich ein
Viertel eines Bildes auf. Sind alle Teile aufgedeckt, kann das Bild als
hochauflösendes PNG heruntergeladen werden (2000×2000px, direkt im Browser aus
dem SVG gerendert – kein Server nötig).

Dafür trägt `index.json` zusätzlich ein, welches Bild aktuell gilt:

```json
{ "files": [ /* ... */ ], "aktuellesBild": "2026-W39-bild.json" }
```

Die referenzierte Datei (`data/<kindId>/2026-W39-bild.json`) sieht so aus:

```json
{
  "woche": "2026-W39",
  "titel": "Der freundliche Drache",
  "thema": "Drachen",
  "svg": "<svg viewBox=\"0 0 800 800\" xmlns=\"http://www.w3.org/2000/svg\">...</svg>"
}
```

Wichtig für das `svg`-Feld, egal ob von Hand, per Skill oder per
`scripts/generate.js` erzeugt:
- in sich geschlossen, `viewBox="0 0 800 800"`, keine externen Referenzen
  (keine Bilder/Fonts/URLs) – muss offline aus dem Browser heraus als PNG
  rasterisierbar sein
- nur einfache Formen (`rect`, `circle`, `ellipse`, `path`, `polygon`,
  Gradients in `defs`), **keine** `<text>`-Elemente (Schriftladen kann beim
  Rasterisieren scheitern) und keine `<filter>`
- das Motiv passt idealerweise zu einem Interessengebiet des Kindes und zeigt
  in allen vier Quadranten (oben-links/-rechts, unten-links/-rechts) etwas
  Erkennbares, da es als 2×2-Puzzle aufgedeckt wird
- die Zuordnung Bereich → Quadrant folgt der festen Reihenfolge aus
  `BEREICH_ORDER` in `app.js` (aktuell: Einmaleins oben-links,
  Grundrechenarten oben-rechts, Kopfrechnen unten-links, Lesen unten-rechts)

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

Für Kinder mit `bereiche` in der `KIDS`-Konfiguration im Skript (aktuell TJ)
erzeugt der Lauf pro Bereich ein eigenes ~15-Minuten-Arbeitsblatt für die
aktuelle Kalenderwoche (getaggt mit `bereich` + `woche`) sowie ein passendes
Wochenbild (`<woche>-bild.json`, siehe „Wochenbild-Puzzle“ oben) – die
Lesetexte und das Bildthema rotieren dabei durch das Array `interessen` des
Kindes. Kinder ohne `bereiche` (aktuell MJ) bekommen wie bisher ein einzelnes
Wochenblatt ohne Bereich/Bild.

Das Skript läuft **nicht automatisch** (es gibt bewusst keinen
GitHub-Actions-Workflow dafür) – du rufst es bei Bedarf lokal auf und
committest die neu erzeugten Dateien wie gewohnt. Das Wochenbild ist
„Best effort“: schlägt die Bild-Erzeugung fehl oder liefert kein gültiges
SVG, werden trotzdem alle Arbeitsblätter des Laufs geschrieben, nur eben ohne
neues Puzzle-Bild für diese Woche.

Für den Alltag ist der Skill-Weg oben weiterhin einfacher und du behältst die
volle Kontrolle über jede einzelne Aufgabe. Hinweis: Der Chat-Skill
`mathe-woche` selbst liegt nicht in diesem Repo (er wird separat auf claude.ai
gepflegt) – die obigen Formate (`bereich`, `woche`, `text`, Wochenbild) sind
der Vertrag, den du in die Skill-Instruktionen auf claude.ai übernehmen
solltest, damit der Skill dieselben Dateien erzeugt wie `scripts/generate.js`.

## Anpassungsideen für später

- **Alte Arbeitsblätter aufräumen:** erledigte, alte Dateien aus `index.json`
  entfernen (die JSON-Datei selbst kann im Repo bleiben).
- **Mehr Kinder:** weitere Einträge in `KIDS` (`app.js` und
  `scripts/generate.js`) und passende Datenordner samt `index.json` ergänzen.
- **Bereiche auch für MJ:** in `scripts/generate.js` und beim manuellen
  Erstellen einfach ebenfalls `bereiche`/`interessen` vergeben, dann bekommt
  MJ dieselbe Bereichs-Gruppierung und das Wochenbild-Puzzle.
