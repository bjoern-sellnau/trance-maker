// Tutorial-Overlay: Schritt-für-Schritt-Anleitungen zum Nachbauen der Demo-Songs.

import { el, $ } from '../util.js';
import { TUTORIALS } from '../tutorials.js';

const bold = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

export class TutorialUI {
  constructor(app, root) {
    this.app = app;
    this.root = root;
    this.currentId = TUTORIALS[0].id;
    document.addEventListener('keydown', (e) => {
      if (!this.root.classList.contains('hidden') && e.key === 'Escape') this.close();
    });
  }

  open() { this.root.classList.remove('hidden'); this.render(); }
  close() { this.root.classList.add('hidden'); }

  steps(t) {
    return [
      `**1. Projekt anlegen:** „Neu" klicken, oben den **Song-Namen** „${t.title} Song" eintragen und **BPM = ${t.bpm}** einstellen.`,
      `**2. Ansicht:** oben links auf **Tracker** umschalten – dort baust du den 16-Reihen-Loop Schritt für Schritt.`,
      `**3. Instrumente laden:** Tab **Sample Maker → Presets**. Jeweils die Kategorie im Dropdown wählen und das Preset anklicken: ${t.instruments.map((i) => `<strong>${i.preset}</strong> (${i.cat})`).join(', ')}. Jedes Instrument landet in der Liste und bekommt eine eigene Kanal-Spalte.`,
      `**4. Drums setzen:** Links das Drum-Instrument auswählen, dann in seiner Kanal-Spalte auf die markierten Reihen klicken (siehe Raster). Klick = setzen, erneuter Klick = löschen.`,
      `**5. Bass & Melodie:** für jede melodische Spur das Instrument wählen, mit <kbd>+/−</kbd> die Oktave setzen und die Noten eintippen/klicken (Details siehe Abschnitt „Bass & Melodie" oben).`,
      `**6. Tonart/Akkorde:** Tonart ist **${t.key}**. Die Akkordfolge wiederholt sich alle 4 Takte: ${t.progression.map((c) => `<strong>${c}</strong>`).join(' → ')}. Transponiere Bass/Pluck/Lead pro Akkord entsprechend.`,
      `**7. Anhören:** ▶ oder <kbd>Leertaste</kbd> – der Loop spielt.`,
      `**8. Zum ganzen Song:** Pattern **klonen** und leicht variieren, über die **Order-Liste** aneinanderreihen – oder in den **Arranger** wechseln und Blöcke als Intro → Aufbau → Drop → Break → Outro anordnen.`,
      `**9. Vergleichen:** unten **„Demo laden"** – so klingt das Ziel. Im Arranger einen Block doppelklicken, um im **Piano-Roll** die Noten zu sehen.`
    ];
  }

  drumGrid(t) {
    const wrap = el('div', { class: 'tut-grid' });
    for (const [lane, steps] of Object.entries(t.drums)) {
      const row = el('div', { class: 'tut-row' });
      row.appendChild(el('div', { class: 'tut-lane', text: lane }));
      const cells = el('div', { class: 'tut-cells' });
      for (let i = 0; i < 16; i++) {
        cells.appendChild(el('div', { class: 'tut-cell' + (steps.includes(i) ? ' on' : '') + (i % 4 === 0 ? ' beat' : ''), text: steps.includes(i) ? '●' : '' }));
      }
      row.appendChild(cells);
      wrap.appendChild(row);
    }
    const nums = el('div', { class: 'tut-row' });
    nums.appendChild(el('div', { class: 'tut-lane', text: 'Reihe' }));
    const ncells = el('div', { class: 'tut-cells' });
    for (let i = 0; i < 16; i++) ncells.appendChild(el('div', { class: 'tut-cell num' + (i % 4 === 0 ? ' beat' : ''), text: String(i) }));
    nums.appendChild(ncells);
    wrap.appendChild(nums);
    return wrap;
  }

  render() {
    this.root.innerHTML = '';
    const t = TUTORIALS.find((x) => x.id === this.currentId) || TUTORIALS[0];
    const panel = el('div', { class: 'tut-panel' });

    panel.appendChild(el('div', { class: 'tut-head' }, [
      el('strong', { text: '📖 Tutorials — Songs Schritt für Schritt nachbauen' }),
      el('span', { class: 'spacer', style: 'flex:1' }),
      el('button', { class: 'p-btn accent', text: 'Schließen', onclick: () => this.close() })
    ]));

    const body = el('div', { class: 'tut-body' });

    // Liste links
    const list = el('div', { class: 'tut-list' });
    for (const x of TUTORIALS) {
      list.appendChild(el('button', {
        class: 'tut-item' + (x.id === this.currentId ? ' active' : ''),
        onclick: () => { this.currentId = x.id; this.render(); }
      }, [el('strong', { text: x.title }), el('span', { class: 'muted', text: x.bpm + ' BPM · ' + x.key })]));
    }
    body.appendChild(list);

    // Inhalt rechts
    const c = el('div', { class: 'tut-content' });
    c.appendChild(el('h3', { text: t.title + '  ·  ' + t.bpm + ' BPM  ·  ' + t.key }));
    c.appendChild(el('p', { class: 'tut-vibe', text: t.vibe }));
    c.appendChild(el('button', { class: 'p-btn accent', text: '▶ Demo „' + t.title + '" laden', onclick: () => { this.app.loadDemo(t.demo); this.close(); } }));

    c.appendChild(el('h4', { text: 'Instrumente (aus Sample Maker → Presets)' }));
    const insts = el('div', { class: 'row-flex' });
    for (const i of t.instruments) insts.appendChild(el('span', { class: 'chip', text: i.preset + ' · ' + i.cat }));
    c.appendChild(insts);

    c.appendChild(el('h4', { text: 'Drum-Pattern (16 Reihen)' }));
    c.appendChild(this.drumGrid(t));

    c.appendChild(el('h4', { text: 'Bass & Melodie' }));
    const ul = el('ul', { class: 'tut-parts' });
    for (const part of t.parts) ul.appendChild(el('li', { html: bold(part) }));
    c.appendChild(ul);

    c.appendChild(el('h4', { text: 'Schritte' }));
    const ol = el('ol', { class: 'tut-steps' });
    for (const s of this.steps(t)) ol.appendChild(el('li', { html: bold(s) }));
    c.appendChild(ol);

    if (t.tips && t.tips.length) {
      c.appendChild(el('h4', { text: 'Tipps' }));
      const tl = el('ul', { class: 'tut-tips' });
      for (const tip of t.tips) tl.appendChild(el('li', { text: tip }));
      c.appendChild(tl);
    }

    body.appendChild(c);
    panel.appendChild(body);
    this.root.appendChild(panel);
  }
}
