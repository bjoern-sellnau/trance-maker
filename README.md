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

### 🎚️ Arranger (Music-Maker-Ansicht) — Standardansicht
Die loop-/blockbasierte Ansicht wie bei Magix Music Maker ist die **Startansicht**;
über den Umschalter **Tracker / Arranger** oben links wechselst du jederzeit:

- **Spuren (Lanes) auf einer Zeitleiste**; Takte und Spurenanzahl frei einstellbar.
- Instrument links auswählen, dann **in eine Spur klicken = Sample-Block setzen** –
  oder ein **Instrument aus der Liste direkt in eine Spur ziehen** (Drag & Drop).
- **Rahmen aufziehen**: in einer Spur einen Bereich über mehrere Beats/Takte ziehen –
  der Block wird mit dem Sample **gefüllt** (Samples kacheln nahtlos, Drums wiederholen
  pro Beat, z. B. für Hardstyle-Kick-Rolls).
- Blöcke per **Drag verschieben**, an der **rechten Kante in der Länge ziehen**,
  mit **✕** oder **Entf** löschen; **Leeren**-Button räumt alles ab.
- **Raster wählbar** (1 Takt / 1 Beat / ½ / ¼ / ⅛) – für **kleinere Sound-Bausteine**:
  Platzieren, Aufziehen, Verschieben und Größe rasten auf den gewählten Wert.
- **Zoom / Fit**, **Playhead per Klick aufs Lineal** verschieben (Wiedergabe startet dort),
  **Zeitanzeige** (aktuell / gesamt) und **Song-Name** oben in der Leiste.
- Geladene **Demo-Songs** bestehen aus 8-Takt-**Blöcken** pro Spur – per **Doppelklick**
  öffnet sich ein Block im Piano-Roll, sodass man sieht, wie der Song gebaut ist.

Transport (▶/Leertaste) und **WAV-Export** beziehen sich immer auf die **gerade aktive
Ansicht** – du kannst also Tracker *oder* Arranger abspielen und exportieren. Beide
teilen sich dieselbe Instrument-/Sample-Bibliothek.

### 🎼 Piano-Roll (Melodien wie in GarageBand)
**Doppelklick auf einen Arranger-Block** (oder Button **＋ Melodie**) öffnet den
**Piano-Roll**: Noten auf einer Klaviatur-Zeitleiste **zeichnen** (Klick), per Drag
**verschieben**, an der rechten Kante in der **Länge** ändern und mit **Entf** löschen.
Mit einstellbarem **Snap-Raster** (1 / ½ / ¼ / ⅛) und Vorhören. Ein Block mit Noten
spielt diese Melodie ab (statt der Füllung); im Arranger sieht man eine Mini-Vorschau.

### 📖 Tutorials (Songs nachbauen)
Der Button **„📖 Tutorial"** oben öffnet Schritt-für-Schritt-Anleitungen für alle
6 Demo-Songs. Jedes Tutorial zeigt **BPM & Tonart**, die nötigen **Presets**, ein
**Drum-Raster** (welche Reihen), die **Akkordfolge**, konkrete **Bass-/Melodie-Hinweise**,
nummerierte **Schritte** und Stil-**Tipps** – plus einen **„Demo laden"**-Knopf zum
direkten Vergleichen.

### 🔊 Sample Maker
Erzeuge eigene Instrumente/Samples auf vier Wegen (Tab *Sample Maker*):

- **Synth** – Oszillator (Sinus/Sägezahn/Rechteck/Dreieck), ADSR-Hüllkurve,
  **Filter (Tief-/Hoch-/Bandpass) mit Resonanz und Filter-Hüllkurve** (Bewegung),
  **FM** (metallische/Glocken-/Growl-Klänge), **Rausch-Anteil**, Sub-Oszillator,
  Verstimmung, „Fat"-Modus und **Drive/Verzerrung** – damit klingen Instrumente
  wirklich unterschiedlich (echtes E-Piano/Glocken/Marimba per FM usw.).
- **Drum** – Synthese von **Kick, Snare, HiHat, Clap, Tom** mit Tune/Decay/Click usw.
- **Mikrofon** – direkt aufnehmen, mit Pegelanzeige, anschließend trimmen.
- **Import** – beliebige Audiodatei (WAV/MP3/OGG …) laden und als Sample nutzen.
  Du kannst Audiodateien auch **vom Desktop in das Fenster ziehen** (Drag & Drop) –
  sie werden automatisch als Sample-Instrumente importiert.
- **Presets** – **620+ Sounds**, nach **Kategorien** geordnet: Kick & Drums, Bass, Lead,
  Pluck, Pad, **Keyboard, Orchestra, Chiptune, Mallets, Techno, House, Dubstep, DnB,
  Ambient, Brass & Wind, World, FX** sowie je ~125 für **Trance, EDM, Rock und Metal**.
  Kategorie im Dropdown wählen, Preset per Klick hinzufügen.

Jede Quelle zeigt eine **Wellenform-Vorschau**. Mit *„Als Sample backen"* wird ein
Synth/Drum offline zu einem festen Sample gerendert; sonst wird es als spielbares
Live-Instrument (tonhöhenabhängig) hinzugefügt. Samples lassen sich trimmen, loopen
und über eine Basis-Note stimmen.

### 🎛️ Instrumente verwalten
Im Tab *Instrumente* ist alles nach **Kategorien** gruppiert. Pro Instrument:
**✎ Bearbeiten** (lädt die Parameter live in den Sample Maker), **⧉ Duplizieren**
(Kopie zum Weiterbasteln) und **🗑 Löschen**; Doppelklick auf den Namen = umbenennen.

### 🎹 Keyboard & 🥁 Drum-Kit
- **Keyboard** – On-Screen-Klaviatur (2 Oktaven, Oktavwahl) zum Einspielen von
  **Melodien**. Über ein **Instrument-Dropdown** wählst du, womit gespielt wird –
  inklusive keyboard-typischer Sounds (Grand Piano, E-Piano, Orgel, Clavinet,
  Glocken, Streicher, Cembalo, Synth Keys).
- **Drum-Kit** – frei **belegbare Pads**: pro Pad per Auswahl ein Drum-Instrument
  zuweisen, Pads hinzufügen/entfernen oder mit „Alle Drums" füllen.

Ist die **Tracker-Ansicht** aktiv, landen gespielte Noten/Schläge direkt am Cursor –
so baust du Melodien und Drums Schritt für Schritt. Sonst dienen sie zum Vorhören.

### 🎚️ Mixer
Pro Instrument ein Fader plus **Mute (M)** und **Solo (S)**.

### 💾 Import / Export
- **Öffnen** zeigt ein Menü: eigene **`.trance`-Datei laden** oder einen von **6 fertigen
  Demo-Songs** öffnen — Trance, Hardstyle, EDM, 90s Happy Hardcore, 90s Trance und
  90s Eurodance (jeweils komplett auskomponiert in passender Länge, 2½–6 Minuten).
- **Speichern** als `.trance`-Datei (JSON). **Selbstständig** – eigene Samples
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
│   ├── model.js          # Datenmodell, Presets + Standardprojekt
│   ├── demos.js          # 6 algorithmisch erzeugte Demo-Songs
│   ├── tutorials.js      # Inhalte der Nachbau-Tutorials
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
│       ├── keyboard.js   # Klaviatur (Melodien) + Drum-Kit-Pads
│       ├── pianoroll.js  # Piano-Roll-Editor (Melodien wie in GarageBand)
│       ├── tutorial.js   # Tutorial-Overlay (Songs nachbauen)
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

## 📱 iPhone & iPad

Die App ist vollständig **touch-tauglich**:

- **iPad** – zweispaltig wie am Rechner (Arbeitsfläche + Werkzeuge nebeneinander).
- **iPhone** – einspaltig mit einem Umschalter **🎛️ Arbeitsfläche / 🎹 Werkzeuge**,
  damit jeder Bereich den ganzen Bildschirm bekommt. Der Arranger wird beim Start
  automatisch auf die Bildschirmbreite eingepasst.
- **Fingerbedienung**: Blöcke setzen, ziehen und in der Länge ändern, Noten im
  Piano-Roll zeichnen, Klaviatur und Drum-Pads spielen – alles per Touch.
  **Doppeltipp** auf einen Block öffnet den Piano-Roll.
- Bedienelemente in **44 pt** (Apple-Richtlinie), Eingabefelder in 16 px, damit
  Safari beim Antippen nicht hineinzoomt.
- **Safe-Area** für Notch/Dynamic Island und Home-Indicator, dynamische Höhe (`dvh`)
  gegen die ein-/ausblendende Adressleiste, kein Gummiband-Scrollen beim Ziehen.
- Der Ton wird nach App-Wechsel oder Bildschirmsperre **automatisch reaktiviert**.

**Tipp:** In Safari über *Teilen → Zum Home-Bildschirm* installieren – dann startet
Trance Maker im Vollbild ohne Browserleisten.

## Technik & Browser

- Reines **HTML/CSS/JavaScript (ES-Module)**, keine Build-Tools, keine Laufzeit-Abhängigkeiten.
- Benötigt einen modernen Browser mit **Web Audio API** und (für Aufnahme) **MediaRecorder**
  (Chrome, Edge, Firefox, Safari – auch mobil auf iOS/iPadOS).
- Lizenz: MIT.
