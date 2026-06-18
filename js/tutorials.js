// Inhalte der Schritt-für-Schritt-Tutorials zum Nachbauen der 6 Demo-Songs.
// Die Werte (BPM, Tonart, Instrumente, Drum-Raster, Akkordfolge) entsprechen
// den echten Demo-Konfigurationen in demos.js.

export const TUTORIALS = [
  {
    id: 'trance', demo: 'trance', title: 'Trance', bpm: 138, key: 'C-Moll',
    vibe: 'Treibend & melodisch: Four-on-the-floor, Offbeat-HiHats, Supersaw-Lead und lange Pad-Akkorde.',
    instruments: [
      { preset: 'Kick', cat: 'Kick & Drums' }, { preset: 'Clap', cat: 'Kick & Drums' },
      { preset: 'Hat (zu)', cat: 'Kick & Drums' }, { preset: 'Hat (offen)', cat: 'Kick & Drums' },
      { preset: 'Bass', cat: 'Bass' }, { preset: 'Trance Pluck', cat: 'Pluck' },
      { preset: 'Supersaw', cat: 'Lead' }, { preset: 'Trance Pad', cat: 'Pad' }
    ],
    drums: { 'Kick': [0, 4, 8, 12], 'Clap': [4, 12], 'Hat (zu)': [2, 6, 10, 14], 'Hat (offen)': [7, 15] },
    progression: ['C', 'A♭', 'E♭', 'B♭'],
    parts: [
      'Bass: Grundton des Akkords als Achtel (Reihen 0,2,4,6,8,10,12,14), Oktave 2 – beim ersten Akkord also C.',
      'Pluck (Arp): 16tel aus Grundton–Mollterz–Quinte, z. B. C, E♭, G, Oktave 4.',
      'Lead (Supersaw): lange Töne, Grundton auf Reihe 0, Quinte auf Reihe 8 (C / G), Oktave 4–5.',
      'Pad: Mollakkord halten (Grundton+Mollterz+Quinte = C, E♭, G) über den ganzen Takt.'
    ],
    tips: ['Die Offbeat-HiHats (zwischen den Kicks) sind der typische Trance-Groove.', 'Im Break die Drums weglassen und nur Pad + Pluck laufen lassen.']
  },
  {
    id: 'hardstyle', demo: 'hardstyle', title: 'Hardstyle', bpm: 150, key: 'C-Moll',
    vibe: 'Hart & energetisch: verzerrte Kick mit Tail, Screech-Stabs, Sub-Bass zwischen den Kicks.',
    instruments: [
      { preset: 'Hardstyle Kick', cat: 'Kick & Drums' }, { preset: 'Clap', cat: 'Kick & Drums' },
      { preset: 'Hat (zu)', cat: 'Kick & Drums' }, { preset: 'Sub Bass', cat: 'Bass' },
      { preset: 'Screech', cat: 'Lead' }, { preset: 'Supersaw', cat: 'Lead' }, { preset: 'Trance Pad', cat: 'Pad' }
    ],
    drums: { 'Hardstyle Kick': [0, 4, 8, 12], 'Clap': [4, 12], 'Hat (zu)': [2, 6, 10, 14] },
    progression: ['C', 'B♭', 'A♭', 'G'],
    parts: [
      'Sub Bass: kurzer Grundton zwischen den Kicks (Reihen 2,6,10,14), Oktave 2 – nie gleichzeitig mit der Kick.',
      'Screech: kurze Stabs als Akzente (z. B. Reihen 0 und 8), Oktave 4 – Drive hoch.',
      'Supersaw: euphorische lange Töne im „Drop" (Grundton, dann Quinte), Oktave 4–5.',
      'Pad: Mollakkord halten für die Stimmung.'
    ],
    tips: ['Die „Hardstyle Kick" hat schon Drive/Verzerrung – im Sample Maker (Drum) bei Bedarf Drive & Decay nachregeln.', 'Reverse-Bass-Feeling: Sub-Bass nur auf den Offbeats.']
  },
  {
    id: 'edm', demo: 'edm', title: 'EDM (Big Room)', bpm: 128, key: 'C-Moll',
    vibe: 'Festival-Sound: stampfende Kick, Pluck-Arp und große Supersaw-Akkorde im Drop.',
    instruments: [
      { preset: 'Kick', cat: 'Kick & Drums' }, { preset: 'Clap', cat: 'Kick & Drums' },
      { preset: 'Hat (zu)', cat: 'Kick & Drums' }, { preset: 'Hat (offen)', cat: 'Kick & Drums' },
      { preset: 'House Bass', cat: 'House' }, { preset: 'Pluck', cat: 'Pluck' },
      { preset: 'Supersaw', cat: 'Lead' }, { preset: 'Choir Pad', cat: 'Pad' }
    ],
    drums: { 'Kick': [0, 4, 8, 12], 'Clap': [4, 12], 'Hat (zu)': [2, 6, 10, 14], 'Hat (offen)': [7, 15] },
    progression: ['C', 'E♭', 'B♭', 'A♭'],
    parts: [
      'House Bass: Grundton als Achtel (Reihen 0,2,4,6,8,10,12,14), Oktave 2.',
      'Pluck (Arp): 16tel aus Grundton–Mollterz–Quinte–Oktave (C, E♭, G, C), Oktave 4.',
      'Supersaw: dicke Akkorde im Drop – jeweils Grundton+Quinte lange halten, Oktave 4.',
      'Choir Pad: Akkord-Fläche unter dem Drop.'
    ],
    tips: ['Typisch EDM: vor dem Drop ein Build-up (Snare-Roll + Riser aus der FX-Kategorie).', 'Bass kurz halten, damit er „pumpt" (Sidechain-Gefühl).']
  },
  {
    id: 'happyhardcore', demo: 'happyhardcore', title: '90s Happy Hardcore', bpm: 170, key: 'C-Dur',
    vibe: 'Schnell & fröhlich (Dur!): rasende Kick, durchgehende HiHats, Hoover-Lead und Piano-Stabs.',
    instruments: [
      { preset: 'Kick', cat: 'Kick & Drums' }, { preset: 'Clap', cat: 'Kick & Drums' },
      { preset: 'Hat (zu)', cat: 'Kick & Drums' }, { preset: 'House Bass', cat: 'House' },
      { preset: 'Piano Stab', cat: 'House' }, { preset: 'Hoover', cat: 'Lead' }, { preset: 'Trance Pad', cat: 'Pad' }
    ],
    drums: { 'Kick': [0, 4, 8, 12], 'Clap': [4, 12], 'Hat (zu)': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] },
    progression: ['C', 'G', 'A', 'F'],
    parts: [
      'House Bass: Grundton als Achtel (Reihen 0,2,4,6,8,10,12,14), Oktave 2.',
      'Piano Stab: Dur-Akkord (Grundton–große Terz–Quinte = C, E, G) auf jedem Beat (Reihen 0,4,8,12), Oktave 4.',
      'Hoover: fröhliche Lead-Hook – große Terz auf Reihe 0, Quinte auf Reihe 8 (E / G), Oktave 4–5.',
      'Pad: Dur-Akkord halten.'
    ],
    tips: ['Dur-Tonart = fröhlich! Achte auf die große Terz (E statt E♭).', '170 BPM: zur Not BPM erst niedriger zum Bauen, dann hochdrehen.']
  },
  {
    id: 'trance90s', demo: 'trance90s', title: '90s Trance', bpm: 140, key: 'C-Moll',
    vibe: 'Klassisch & hypnotisch: rollender Offbeat-Bass, Saw-Arpeggios, lange Breakdowns.',
    instruments: [
      { preset: 'Kick', cat: 'Kick & Drums' }, { preset: 'Clap', cat: 'Kick & Drums' },
      { preset: 'Hat (zu)', cat: 'Kick & Drums' }, { preset: 'Hat (offen)', cat: 'Kick & Drums' },
      { preset: 'Bass', cat: 'Bass' }, { preset: 'Saw Lead', cat: 'Lead' },
      { preset: 'Supersaw', cat: 'Lead' }, { preset: 'Warm Pad', cat: 'Pad' }
    ],
    drums: { 'Kick': [0, 4, 8, 12], 'Clap': [4, 12], 'Hat (zu)': [2, 6, 10, 14], 'Hat (offen)': [7, 15] },
    progression: ['C', 'A♭', 'E♭', 'B♭'],
    parts: [
      'Bass (Offbeat-Roll): Grundton auf den Reihen 2, 6, 10, 14 (das „und" jedes Beats), Oktave 2.',
      'Saw Lead (Arp): langes 16tel-Arpeggio Grundton–Mollterz–Quinte–Oktave und zurück, Oktave 4.',
      'Supersaw: getragene Akkordmelodie in den Hooks (Grundton, dann Quinte).',
      'Warm Pad: weiche Akkordfläche, besonders im langen Breakdown.'
    ],
    tips: ['Der rollende Offbeat-Bass ist DER 90s-Trance-Sound.', 'Plane einen langen Breakdown (nur Pad + Arp) vor dem zweiten Drop.']
  },
  {
    id: 'eurodance', demo: 'eurodance', title: '90s Eurodance', bpm: 135, key: 'C-Moll',
    vibe: 'Eingängig & poppig: Offbeat-Bass, Orgel-/Piano-Stabs, klare Lead-Hookline.',
    instruments: [
      { preset: 'Kick', cat: 'Kick & Drums' }, { preset: 'Clap', cat: 'Kick & Drums' },
      { preset: 'Hat (zu)', cat: 'Kick & Drums' }, { preset: 'Hat (offen)', cat: 'Kick & Drums' },
      { preset: 'House Bass', cat: 'House' }, { preset: 'Organ Stab', cat: 'House' },
      { preset: 'Supersaw', cat: 'Lead' }, { preset: 'Piano Stab', cat: 'House' }
    ],
    drums: { 'Kick': [0, 4, 8, 12], 'Clap': [4, 12], 'Hat (zu)': [2, 6, 10, 14], 'Hat (offen)': [7, 15] },
    progression: ['C', 'E♭', 'B♭', 'A♭'],
    parts: [
      'House Bass (Offbeat): Grundton auf den Reihen 2, 6, 10, 14, Oktave 2.',
      'Organ Stab: Mollakkord (C, E♭, G) auf jedem Beat (Reihen 0,4,8,12), Oktave 4.',
      'Supersaw: eingängige Lead-Hookline (Grundton–Mollterz–Quarte–Mollterz), Oktave 4–5.',
      'Piano Stab: Akzente auf den Beats, verstärkt die Hookline.'
    ],
    tips: ['Eurodance lebt von einer simplen, ohrwurmigen Lead-Melodie – halte sie einfach.', 'Wechsel zwischen Gesangs-/Lead-Strophe und Stab-Refrain.']
  }
];
