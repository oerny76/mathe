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

Zwei Beispieldateien (`data/kind1/2026-W32.json`, `data/kind2/2026-W32.json`,
jeweils in `index.json` verlinkt) liegen bereits im Repo, damit du die App
sofort ausprobieren kannst.

## Auf dem iPad installieren

1. Seite in Safari öffnen (die GitHub-Pages-URL).
2. Teilen-Symbol → „Zum Home-Bildschirm“.
3. Ab jetzt öffnet sich die App wie eine normale App, per Fingertipp,
   auch ohne Adressleiste.

## Automatisierung (optional, nicht der empfohlene Standardweg)

Falls du doch mal automatisch statt manuell erzeugen willst, liegt weiterhin
ein GitHub-Action-Workflow bereit (`scripts/generate.js` +
`.github/workflows/generate-tasks.yml`), der die Claude-API aufruft und dabei
auch gleich `index.json` aktualisiert. Dafür brauchst du ein Secret
`ANTHROPIC_API_KEY` (**Settings → Secrets and variables → Actions**) und
kannst den Workflow manuell im Actions-Tab per „Run workflow“ auslösen.
Für den Alltag ist der Skill-Weg oben aber einfacher und du behältst die
volle Kontrolle über jede einzelne Aufgabe.

## Anpassungsideen für später

- **Fortschritt sichtbar machen:** `localStorage`-Daten aus `app.js` in ein
  kleines Diagramm umwandeln (z.B. Anzahl erledigter Arbeitsblätter).
- **Alte Arbeitsblätter aufräumen:** erledigte, alte Dateien aus `index.json`
  entfernen (die JSON-Datei selbst kann im Repo bleiben).
- **Mehr Kinder:** weitere Einträge in `KIDS` (`app.js`) und passende
  Datenordner samt `index.json` ergänzen.
