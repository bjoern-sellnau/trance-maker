# 🎛️ Trance Maker

Ein browserbasierter **Track- und Sample-Maker** im Geist von *Data Becker Techno Maker*
und *Magix Music Maker* – mit **Tracker-Interface** und **Arranger-Ansicht im
Music-Maker-Stil**, eingebautem **Sample-Maker** (Synthese, Drum-Synthese,
**Mikrofon-Aufnahme**, Datei-Import) sowie **Import/Export** ganzer Tracks.
Läuft komplett lokal im Browser über die Web Audio API – keine Cloud,
keine Installation von Abhängigkeiten.

![Web Audio](https://img.shields.io/badge/Web%20Audio%20API-native-34d399)
![Keine Dependencies](https://img.shields.io/badge/dependencies-0-38bdf8)

---

## Starten

Voraussetzung: **Node.js** (nur für den kleinen Dev-Server – es werden keine Pakete
installiert).

```bash
npm start
# oder:
node server.js
```

Dann im Browser öffnen: **http://localhost:5173**

> Beim ersten Klick/Tastendruck wird die Audio-Engine aktiviert (Browser-Vorgabe).
> Für die **Mikrofon-Aufnahme** ist ein sicherer Kontext nötig – `localhost` zählt
> bereits als sicher, daher funktioniert das Mikrofon out-of-the-box.

---

## Funktionen

### 🎹 Tracker (Track-Maker)
Das zentrale Kompositions-Raster wie in klassischen Trackern (FastTracker/ProTracker-Stil):

- **Spalten = Kanäle**, **Zeilen = Schritte**. Jede Zelle kann eine Note + Instrument enthalten.
- **Pro Kanal monophon** mit echtem **Note-Off** – neue Noten lösen die vorige ab.
- Mehrere **Patterns** und eine **Order-Liste**, um daraus einen ganzen Song zu bauen.
- BPM und Reihen/Beat frei einstellbar; Beat-Zeilen sind hervorgehoben.
- Live-Playhead, der beim Abspielen mitläuft (im Song-Modus folgt die Anzeige dem Pattern).

**Tastatur (wenn das Tracker-Feld den Fokus hat):**

| Taste | Funktion |
|---|---|
| `Z S X D C V G B H N J M` | untere Oktave (C, C#, D …) |
| `Q 2 W 3 E R 5 T 6 Y 7 U` | obere Oktave |
| `1` | Note-Off setzen |
| `Entf` / `Backspace` | Zelle löschen |
| `↑ ↓ ← →` | Cursor bewegen |
| `Bild ↑/↓` | um einen Beat springen |
| `+` / `-` | Oktave wechseln |
| `Leertaste` | Start/Stopp (global) |

**Maus:** Klick auf eine leere Zelle setzt das aktive Instrument (Music-Maker-Stil zum
schnellen Beat-Klicken), Klick auf eine belegte Zelle löscht sie. Klick auf einen
Kanal-Kopf (`CH1` …) schaltet den Kanal stumm.

### 🎚️ Arranger (Music-Maker-Ansicht)
Über den Umschalter **Tracker / Arranger** oben links wechselst du in die klassische
loop-/blockbasierte Ansicht wie bei Magix Music Maker:

- **Spuren (Lanes) auf einer Zeitleiste**; Takte und Spurenanzahl frei einstellbar.
- Instrument links auswählen, dann **in eine Spur klicken = Sample-Block setzen**.
- Blöcke per **Drag verschieben**, an der **rechten Kante in der Länge ziehen**,
  mit **✕** oder **Entf** löschen; **Leeren**-Button räumt alles ab.
- Eigener **Playhead**; die Wiedergabe loopt die Arrangement-Länge.

Transport (▶/Leertaste) und **WAV-Export** beziehen sich immer auf die **gerade aktive
Ansicht** – du kannst also Tracker *oder* Arranger abspielen und exportieren. Beide
teilen sich dieselbe Instrument-/Sample-Bibliothek.

### 🔊 Sample Maker
Erzeuge eigene Instrumente/Samples auf vier Wegen (Tab *Sample Maker*):

- **Synth** – Oszillator (Sinus/Sägezahn/Rechteck/Dreieck), ADSR-Hüllkurve,
  Tiefpassfilter mit Resonanz, Sub-Oszillator, Verstimmung, „Fat"-Modus (3 Oszillatoren).
- **Drum** – Synthese von **Kick, Snare, HiHat, Clap, Tom** mit Tune/Decay/Click usw.
- **Mikrofon** – direkt aufnehmen, mit Pegelanzeige, anschließend trimmen.
- **Import** – beliebige Audiodatei (WAV/MP3/OGG …) laden und als Sample nutzen.

Jede Quelle zeigt eine **Wellenform-Vorschau**. Mit *„Als Sample backen"* wird ein
Synth/Drum offline zu einem festen Sample gerendert; sonst wird es als spielbares
Live-Instrument (tonhöhenabhängig) hinzugefügt. Samples lassen sich trimmen, loopen
und über eine Basis-Note stimmen.

### 🎚️ Mixer
Pro Instrument ein Fader plus **Mute (M)** und **Solo (S)**.

### 💾 Import / Export
- **Speichern / Öffnen** als `.trance`-Datei (JSON). **Selbstständig** – eigene Samples
  werden als Base64-WAV eingebettet, sodass ein Projekt alles Nötige enthält.
- **WAV-Export**: Der komplette Song wird offline (schneller als Echtzeit) gerendert
  und als 16-Bit-Stereo-WAV heruntergeladen, inkl. Schutz-Normalisierung gegen Clipping.

---

## Projektstruktur

```
trance-maker/
├── index.html            # Oberfläche
├── css/style.css         # Styling (dunkles Studio-Theme)
├── server.js             # winziger statischer Dev-Server (0 Abhängigkeiten)
├── js/
│   ├── main.js           # Einstiegspunkt
│   ├── app.js            # zentrale App-Logik & Verdrahtung
│   ├── model.js          # Datenmodell + Standardprojekt (Demo-Beat)
│   ├── sequencer.js      # Look-Ahead-Scheduler (Live-Wiedergabe) + Mixer-Routing
│   ├── project.js        # Speichern/Laden (.trance) + WAV-Export
│   ├── util.js           # Hilfsfunktionen
│   ├── audio/
│   │   ├── context.js    # AudioContext + Master-Kette
│   │   ├── instruments.js# Synthese-Engine (Synth/Drums/Sample)
│   │   ├── recorder.js   # Mikrofon-Aufnahme
│   │   ├── render.js     # Offline-Render des Songs
│   │   └── wav.js        # WAV-Kodierung + Base64
│   └── ui/
│       ├── tracker.js    # Tracker-Raster + Tastatur/Maus
│       ├── arranger.js   # Arranger-Zeitleiste (Music-Maker-Ansicht)
│       └── samplemaker.js# Sample-Maker-Oberfläche + Wellenform
└── test/core.test.js     # Unit-Tests (WAV, Base64, Modell, Serialisierung)
```

---

## Tests

```bash
npm test
```

Die Tests decken die browserunabhängige Kernlogik ab (WAV-Encoder, Base64-Roundtrip,
Datenmodell, Projekt-Serialisierung). Die Audio-Engine und Oberfläche wurden zusätzlich
in einem echten (Headless-)Browser auf Laufzeitfehler, korrektes Rendering, den
Playback-Scheduler und den Sample-Round-Trip geprüft.

---

## Schnellstart-Workflow

1. Server starten, `http://localhost:5173` öffnen → es lädt ein **Demo-Techno-Beat**.
2. `▶` oder **Leertaste** zum Abspielen.
3. Im Tracker Noten setzen (klicken oder per Tastatur tippen).
4. Im **Sample Maker** eigene Sounds bauen (z. B. eigene Kick synthetisieren oder
   per Mikrofon aufnehmen) und mit *„＋ Als Instrument hinzufügen"* übernehmen.
5. Patterns anlegen und über die **Order**-Liste zum Song arrangieren („Song"-Haken setzen).
6. **WAV Export** für die fertige Audiodatei bzw. **Speichern** für das bearbeitbare Projekt.

---

## Technik & Browser

- Reines **HTML/CSS/JavaScript (ES-Module)**, keine Build-Tools, keine Laufzeit-Abhängigkeiten.
- Benötigt einen modernen Browser mit **Web Audio API** und (für Aufnahme) **MediaRecorder**
  (Chrome, Edge, Firefox, Safari).
- Lizenz: MIT.
