# Zeiterfassung Paulus

Eigenständige Zeiterfassungs-App der Elektrotechnik Paulus GmbH.
Sie läuft im Handy-Browser, lässt sich wie eine App installieren und
benutzt **dieselbe Datenbank wie das Cockpit** (Supabase) – also dieselben
Zugangsdaten und dieselben Zeiten.

## Was die App kann

| Bereich    | Wofür |
|------------|-------|
| Zeitachse  | Tage durchsehen, Ort und Art je Eintrag ergänzen (Tabelle `zeitachse`) |
| Stempeln   | Schicht starten/beenden, Pause (Tabellen `stempel_schicht`, `stempel_pause`) |
| Woche      | Summen der eigenen Stunden (Tabelle `Stunden`) |
| Mehr       | gelernte Orte, Abmelden |

Beim Ausstempeln ruft die App die Datenbank-Funktion `stempel_ausstempeln()`
auf. Die zieht die Pausen ab und schreibt eine fertige Zeile in `Stunden`.

## Aufbau der Dateien

```
index.html               die Oberfläche
stil.css                 das Aussehen (Corporate Design)
js/daten.js              Zugriff auf Supabase (Anmeldung, Lesen, Schreiben)
js/hilfen.js             Zeiten rechnen und anzeigen
js/app.js                der Ablauf der App
manifest.webmanifest     macht die App installierbar
sw.js                    Service Worker: Start ohne Netz
symbole/                 App-Symbole aus der Bildmarke
sql/                     Datenbank-Änderungen zum Nachlesen
```

Es gibt **keinen Baukasten**: kein npm, kein React, kein Bundler.
Die Dateien laufen so, wie sie im Repository stehen. Das macht sie
langsamer zu schreiben, aber viel leichter zu lesen und zu ändern.

## Zugangsdaten

Die Adresse und der öffentliche Schlüssel von Supabase stehen in
`konfig.js`. Diese Datei ist in `.gitignore` eingetragen und liegt
**nie** im Repository.

* **Auf Netlify** erzeugt `erzeuge-konfig.sh` sie beim Bauen aus zwei
  Umgebungsvariablen:
  * `SUPABASE_URL`
  * `SUPABASE_PUBLISHABLE_KEY`
* **Auf dem eigenen Rechner** `konfig.beispiel.js` nach `konfig.js`
  kopieren und die beiden Werte eintragen.

Der *Service-Key* gehört weder in die App noch in Netlify – er würde alle
Sicherheitsregeln der Datenbank aushebeln.

## Zum Ausprobieren auf dem eigenen Rechner

Die App braucht einen Webserver; direkt aus dem Dateisystem öffnen
funktioniert nicht (der Browser lässt dann keine Anfragen zu).

```
python3 -m http.server 8000
```

Dann `http://localhost:8000` im Browser öffnen.

## Auf Netlify veröffentlichen

1. **Add new site → Import an existing project → GitHub**, dieses Repository wählen.
2. Build command und Publish directory kommen aus `netlify.toml`, nichts eintragen.
3. **Site settings → Environment variables:** die beiden Werte oben eintragen.
4. **Deploys → Trigger deploy.**

## Datenbank

Die App legt **keine** eigenen Tabellen an. Sie benutzt, was schon da ist:

`zeitachse`, `zeitachse_ort`, `stempel_schicht`, `stempel_pause`,
`Stunden`, `zeitkategorien` (nur lesen), `profiles` (nur lesen).

Geplante Ergänzungen liegen in `sql/` – **erst ansehen, dann ausführen.**
Keine Datei dort wurde bisher angewendet.
