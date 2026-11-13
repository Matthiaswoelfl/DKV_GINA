// UI-Abnahmetests und Screenshots (Playwright). Aufruf über: python3 build/build.py --ui
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [html, outDir] = process.argv.slice(2);
  const shots = path.join(outDir, 'screenshots');
  fs.mkdirSync(shots, { recursive: true });
  const checks = [], screenshots = [];
  const check = (name, ok, ist) => checks.push({ name, ok: !!ok, ist: String(ist) });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [], requests = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('request', r => { if (!r.url().startsWith('file:') && !r.url().startsWith('blob:')) requests.push(r.url()); });
  const shot = async n => { await page.screenshot({ path: path.join(shots, n) }); screenshots.push(n); };
  const txt = s => page.locator(s).innerText();

  await page.goto('file://' + html);
  check('Startansicht: Status „5.580 von 5.580 Ziffern“', (await txt('#status')).startsWith('5.580 von 5.580'), await txt('#status'));
  const nav = (await page.locator('#nav button.kap').allInnerTexts()).map(t => t.replace(/\s+/g, ' '));
  check('Navigation: 17 Kapitel (B bis S) mit Titel, z. B. „L Chirurgie 2.478“', nav.length === 17 && nav.includes('L Chirurgie 2.478') && nav[0].startsWith('B Grundleistungen'), nav.length + ' Kapitel; ' + nav.filter(t => /^[LG] /.test(t)).join(' | '));
  await page.locator('#nav button.kap', { hasText: 'Chirurgie' }).first().click();
  check('Navigation: Klick auf Kapitel L zeigt dessen Abschnitte und filtert auf 2.478 Ziffern', await page.locator('#nav button.abs').count() === 20 && (await txt('#status')).startsWith('2.478 von'), (await page.locator('#nav button.abs').count()) + ' Abschnitte; ' + await txt('#status'));
  await page.click('#reset');
  const dom = await page.locator('#spacer > *').count();
  check('Virtualisierung: weniger als 80 Zeilen im DOM', dom < 80, dom + ' Elemente');
  const opts = await page.locator('#fmax option').allInnerTexts();
  check('Faktorfilter zeigt Verteilung 142 / 55 / 58 / 37 / 1.470 / 2 / 235',
    opts.slice(1).join(' ') === '×1,0 – keine AB-Steigerung (3.581) ×1,5 (142) ×2,0 (55) ×2,25 (58) ×3,0 (37) ×4,0 (1.470) ×4,5 (2) ×6,0 (235)', opts.slice(1).join(' '));
  check('Startansicht: alle Abschnitte eingeklappt', await page.locator('.ghead[aria-expanded=true]').count() === 0 && await page.locator('.ghead').count() > 5 && await page.locator('.row').count() === 0, (await page.locator('.ghead[aria-expanded=false]').count()) + ' eingeklappt, ' + (await page.locator('.row').count()) + ' Zeilen');
  await shot('01_startansicht.png');
  await page.locator('.ghead').first().click();
  check('Klick auf Abschnitt klappt auf (B I, erste Ziffer 1)', await page.locator('.row').count() >= 10 && (await page.locator('.row .z').first().innerText()) === '1', (await page.locator('.row .z').first().innerText()));
  await page.locator('.ghead').first().click();

  // Suche 1200 -> eine Eingabe + Enter
  await page.keyboard.press('/');
  await page.keyboard.type('1200');
  await page.keyboard.press('Enter');
  let d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Suche „1200“ + Enter öffnet Ziffer 1200: 21,00 €, B ×1,5, max. 31,50 €',
    d.includes('Ziffer 1200') && d.includes('21,00 €') && d.includes('Max. praktisch ×1,5 31,50 €') && !d.includes('Gerinnungsstörung'), d.slice(0, 160));
  check('URL-Hash gesetzt (#1200)', page.url().endsWith('#1200'), page.url().split('/').pop());
  await page.keyboard.press('Escape');

  await page.fill('#q', '1200');
  await page.waitForTimeout(200);
  const offen = await page.locator('.row').count();
  await page.fill('#q', '');
  await page.waitForTimeout(200);
  check('Suche geleert: wieder alle 5.580 Ziffern, alle Abschnitte eingeklappt', offen > 0 && (await txt('#status')).startsWith('5.580 von') && await page.locator('.row').count() === 0 && await page.locator('.ghead[aria-expanded=true]').count() === 0, (await txt('#status')) + ', ' + (await page.locator('.row').count()) + ' Zeilen offen');
  // Filter: Chips G + S, Faktor 6,0
  await page.fill('#q', '');
  await page.click('.chip[data-k=S]');
  await page.click('.chip[data-k=G]');
  await page.waitForFunction(() => !document.querySelector('#status').textContent.startsWith('0 '), null, { timeout: 2000 }).catch(() => {});
  check('Filter Chips G + S: 235 Ziffern', (await txt('#status')).startsWith('235 von'), await txt('#status'));
  await shot('02_gefilterte_ansicht.png');
  await page.click('#reset');
  await page.click('#theo');
  const optsT = await page.locator('#fmax option').allInnerTexts();
  check('Schalter „theoretisch“: Faktorfilter nennt theoretische Höchstwerte (×6,0 → 1.470, ×12,0 → 235)',
    optsT.some(o => o.replace(/\s/g, '') === '×6,0(1.470)') && optsT.some(o => o.replace(/\s/g, '') === '×12,0(235)'), optsT.slice(1).join(' '));
  await page.click('#theo');

  // Anzahl AB-Gründe + Tooltip
  const anz = (await page.locator('#anz option').allInnerTexts()).slice(1).join(' | ');
  check('Filter „Anzahl AB-Gründe“: 0 → 3.581 · 1 → 197 · 2 → 95 · 3 → 1.472 · 4 → 235',
    anz === '0 – nicht steigerfähig (3.581) | 1 Grund (197) | 2 Gründe (95) | 3 Gründe (1.472) | 4 Gründe (235)', anz);
  await page.selectOption('#anz', '1');
  await page.fill('#q', 'sonograph');
  await page.waitForTimeout(200);
  const one = await page.locator('.row').evaluateAll(rs => rs.every(r => r.querySelectorAll('.badge').length === 1) && rs.some(r => r.id === 'r1200'));
  check('Anzahl = 1 + Suche „sonograph“: nur Ziffern mit genau einem Grund, darunter 1200', one, await txt('#status'));
  await page.selectOption('#anz', '3');
  await page.fill('#q', '');
  await page.waitForTimeout(200);
  check('Anzahl = 3: 1.472 Ziffern', (await txt('#status')).startsWith('1.472 von'), await txt('#status'));
  await page.hover('.chip[data-k=B]');
  let tp = (await txt('#tip')).replace(/\s+/g, ' ');
  check('Hover auf Tag B zeigt Wortlaut („Body-Mass-Index (BMI) ≥ 40 … 1,5fache Gebühr“)', tp.includes('Bei Patienten mit einem Body-Mass-Index (BMI) ≥ 40') && tp.includes('1,5fache Gebühr') && tp.includes('02.06-3'), tp.slice(0, 120));
  await page.locator('.ghead').first().click().catch(() => {});
  await page.locator('.row .badge.cG').first().hover();
  tp = (await txt('#tip')).replace(/\s+/g, ' ');
  check('Hover auf Badge G in der Liste zeigt Wortlaut („Bei Gerinnungsstörungen …“)', tp.includes('Bei Gerinnungsstörungen unter Therapie mit Vitamin K-Antagonisten'), tp.slice(0, 110));
  await shot('06_tooltip_wortlaut.png');
  await page.click('#reset');

  // Nicht durch AB steigerfähig
  await page.click('.chip[data-k=ohne]');
  check('Chip „Nicht durch AB steigerfähig“: 3.581 Ziffern', (await txt('#status')).startsWith('3.581 von'), await txt('#status'));
  await page.fill('#q', '4500');
  await page.keyboard.press('Enter');
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Ziffer 4500 (PSY): Kapitel G, 145,00 €, „Nicht durch AB steigerfähig“, max. Faktor ×1,0, kein Szenario',
    d.includes('Ziffer 4500') && d.includes('Kapitel G') && d.includes('145,00 €') && d.includes('Nicht durch AB steigerfähig') && d.includes('Max. Faktor ×1,0 145,00 €') && await page.locator('#szen').count() === 0, d.slice(0, 220));
  await shot('05_nicht_steigerfaehig.png');
  await page.keyboard.press('Escape');
  await page.click('#reset');

  // Detail 5600 per Hash
  await page.goto('file://' + html + '#5600');
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Direktlink #5600: 43,46 €, praktisch ×4,0 = 173,84 €, theoretisch ×6,0 = 260,76 €',
    d.includes('43,46 €') && d.includes('Max. praktisch ×4,0 173,84 €') && d.includes('Nur theoretisch ×6,0 260,76 €'), d.slice(0, 200));
  const mo = await page.locator('table.mo tbody tr').evaluateAll(trs => trs.map(t => t.className + ':' + t.cells[0].innerText + ':' + t.cells[2].innerText).join(' '));
  check('Ziffer 5600: Tabelle der Möglichkeiten', mo === 'p:×1,5:65,19 € p:×2,0:86,92 € p:×3,0:130,38 € p:×4,0:173,84 € t:×6,0:260,76 €', mo);
  await page.check('#szen input[value=G]');
  await page.check('#szen input[value=F]');
  check('Szenario 5600 G+F: ×4,0 = 173,84 € (praktisch)', (await txt('#szres')).replace(/\s+/g, ' ') === 'G×F · Faktor ×4,0 173,84 €' && !(await page.locator('#szwarn .warn').count()), (await txt('#szres')).replace(/\s+/g, ' '));
  await page.check('#szen input[value=B]');
  check('Szenario 5600 G+B+F: ×6,0 = 260,76 €, als nur theoretisch markiert', (await txt('#szres')).includes('260,76 €') && await page.locator('#szwarn .warn').count() === 1, (await txt('#szres')).replace(/\s+/g, ' ') + ' / ' + (await page.locator('#szwarn').innerText()).slice(0, 40));
  await shot('03_detailbereich.png');

  // 900
  await page.goto('file://' + html + '#900');
  await page.reload();
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Direktlink #900: 27,49 €, nur G ×2,0, max. 54,98 €', d.includes('27,49 €') && d.includes('Max. praktisch ×2,0 54,98 €') && !d.includes('Adipositas'), d.slice(0, 160));

  // Tastatur
  await page.keyboard.press('Escape');
  await page.focus('#list');
  await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
  check('Tastatur: von Ziffer 900 aus Pfeil ab, Pfeil ab, Enter öffnet Ziffer 902', (await txt('#drawer h2')).includes('902'), (await txt('#drawer h2')).split('\n')[0]);
  await page.keyboard.press('Escape');

  // CSV
  await page.click('.chip[data-k=V]');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#csv')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8').replace(/^﻿/, '').split('\r\n');
  check('CSV-Export (Filter V): Kopf + 60 Zeilen, deutsche Dezimalzahlen', csv.length === 61 && csv[0].startsWith('"Ziffer";"Kapitel";"Abschnitt";"Leistung";"Gebühr (€)";"Gründe";"max. Faktor";"max. Gebührensatz (€)"') && /;\d+,\d{2}$/.test(csv[1]), csv.length + ' Zeilen; ' + csv[1].slice(0, 30) + ' … ' + csv[1].slice(-28));

  // ---------- Reiter Nebeneinanderberechnung ----------
  await page.goto('file://' + html);
  await page.reload();
  await page.click('#tabs button[data-v=nb]');
  const chipsNb = (await page.locator('#chipsnb .chip').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')).join(' | ');
  check('Reiter „Nebeneinanderberechnung“: Chips Nicht neben 1.051 · Nur neben 1.337 · Keine Neben-Regel 3.525',
    chipsNb === '≠ Nicht neben 1.051 | + Nur neben 1.337 | – Keine Neben-Regel 3.525' && await page.locator('#f-ab').isHidden(), chipsNb);
  await shot('07_neben_start.png');
  await page.fill('#q', '310');
  await page.keyboard.press('Enter');
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  const p310 = (await page.locator('#drawer > .regel .zl b').allTextContents()).join(',');
  check('Ziffer 310: „Nur neben“ mit Wortlaut und Ziffern 306, 307, 308, 309', d.includes('Die Schreibgebühr ist nur neben der Leistung nach Nummer 306, 307, 308 oder 309 berechnungsfähig.') && p310 === '306,307,308,309' && page.url().endsWith('#neben/310'), p310 + ' · ' + page.url().split('/').slice(-2).join('/'));
  await page.locator('#drawer .regel .zl').first().click();
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Klick auf genannte Ziffer 306 öffnet diese und zeigt „In Regeln anderer Ziffern genannt“ (310, 311)', d.includes('Ziffer 306') && /in regeln anderer ziffern genannt \(2\)/i.test(d) && d.includes('Schreibgebühr') && d.includes('Kopiergebühr'), d.slice(0, 90));
  await page.goto('file://' + html + '#neben/1200');
  await page.reload();
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  const p1200 = [...new Set(await page.locator('#drawer > .regel.cNN .zl b').allTextContents())].sort((a, b) => a - b).join(',');
  check('Direktlink #neben/1200: nicht neben 1225, 1228 sowie laut Abschnitts-AB 4600 … 4729, Quelle mit AB-ID und Seite',
    p1200 === '1225,1228,4600,4602,4603,4611,4718,4719,4725,4727,4728,4729' && d.includes('Allgemeine Bestimmung 07.01-2') && d.includes('Seite 264') && await page.locator('#tabs button[data-v=nb][aria-selected=true]').count() === 1, p1200);
  await shot('08_neben_detail_1200.png');
  await page.goto('file://' + html + '#neben/1215');
  await page.reload();
  const u1215 = (await page.locator('#drawer > .regel.cNU .zl b').allTextContents()).join(','), n1215 = (await page.locator('#drawer > .regel.cNN .zl b').allTextContents()).join(',');
  check('Ziffer 1215: nur neben 1205, 1208, 1211, 1212 und nicht neben 1214, 1333, 1334, 1335', u1215 === '1205,1208,1211,1212' && n1215 === '1214,1333,1334,1335', 'nur neben ' + u1215 + ' · nicht neben ' + n1215);
  await page.goto('file://' + html + '#neben/4525');
  await page.reload();
  const u4525 = await page.locator('#drawer > .regel.cNU .zl b').allTextContents();
  check('Ziffer 4525: nur neben 13 Ziffern (4500 … 4523), „mindestens eine von“', u4525.length === 13 && u4525[0] === '4500' && u4525[12] === '4523' && (await txt('#drawer')).includes('Mindestens eine von'), u4525.join(','));
  await page.keyboard.press('Escape');
  await page.click('#reset');
  await page.selectOption('#nbart', 'ab');
  const nArt = await txt('#status');
  await page.selectOption('#nbart', '');
  await page.check('#nbrev');
  const chipsRev = (await page.locator('#chipsnb .chip').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')).join(' | ');
  check('Filter „Regelart“ (Allgemeine Bestimmungen) und Schalter „Nennungen einbeziehen“ ändern die Treffer', /^\d/.test(nArt) && !nArt.startsWith('5.580') && chipsRev !== chipsNb, nArt + ' · ' + chipsRev);
  await page.uncheck('#nbrev');
  await page.click('#abbtn');
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Schaltfläche „Allgemeine Bestimmungen (39)“ listet die 39 AB-Regeln, u. a. A-8 Sitzungsbezug', (await txt('#abbtn')).includes('(39)') && await page.locator('#drawer .regel').count() === 39 && d.includes('bezieht sich dieser Abrechnungsausschluss auf dieselbe Sitzung'), (await page.locator('#drawer .regel').count()) + ' Regeln');
  await shot('09_neben_allgemeine_bestimmungen.png');
  await page.keyboard.press('Escape');
  await page.fill('#q', 'schreibgebühr');
  await page.waitForTimeout(200);
  await page.click('#chipsnb .chip[data-k=U]');
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.click('#csv')]);
  const csv2 = fs.readFileSync(await dl2.path(), 'utf8').replace(/^\ufeff/, '').split('\r\n');
  check('CSV-Export Nebeneinander (Suche „schreibgebühr“, Nur neben): Kopf + 1 Zeile mit 306, 307, 308, 309', csv2.length === 2 && csv2[0].includes('"Nicht neben (Ziffern)";"Nur neben (Ziffern)"') && csv2[1].includes('"306, 307, 308, 309"'), csv2.length + ' Zeilen; ' + csv2[1].slice(0, 60));
  await page.click('#reset');
  await page.click('#tabs button[data-v=ab]');
  check('Zurück zum Reiter „AB-Steigerungsgründe“: AB-Filter wieder sichtbar, 5.580 Ziffern', await page.locator('#f-nb').isHidden() && await page.locator('#chips .chip').count() === 6 && (await txt('#status')).startsWith('5.580 von'), await txt('#status'));

  // ---------- Reiter Intervalle ----------
  await page.goto('file://' + html);
  await page.reload();
  await page.click('#tabs button[data-v=iv]');
  const chipsIv = (await page.locator('#chipsiv .chip').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')).join(' | ');
  const groups = await page.locator('#ivsel optgroup').evaluateAll(g => g.map(x => x.label));
  check('Reiter „Intervalle“: Chips Bestehend / Neu / Kein Intervall, Auswahlfeld mit 25 Intervallen in 10 Cluster-Gruppen',
    /^B Bestehend [\d.]+ \| N Neu [\d.]+ \| – Kein Intervall [\d.]+$/.test(chipsIv) && await page.locator('#ivsel option').count() === 26 && groups.length === 10 && groups[0] === 'Bestehend · Cluster 1: Sitzung und Tag' && groups[9].startsWith('Neu · Cluster 6'), chipsIv + ' · ' + groups.length + ' Gruppen');
  await shot('10_intervalle_start.png');
  await page.selectOption('#ivsel', { label: 'Rollierende drei Kalendermonate (6)' });
  const zi = (await page.locator('.row .z').allInnerTexts()).join(',');
  check('Intervall „Rollierende drei Kalendermonate“: 119, 120, 305, 1800, 1801, 4405 – Infotext mit Hinweis „etwas anderes als das feste Quartal“', zi === '119,120,305,1800,1801,4405' && (await txt('#ivinfo')).includes('etwas anderes als das feste Quartal'), zi);
  await page.locator('.row', { hasText: '1800' }).first().click();
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Ziffer 1800: neu „Rollierende drei Kalendermonate“ und „Rollierende 24 Stunden“ mit Wortlaut, Direktlink #intervalle/1800', d.includes('Rollierende drei Kalendermonate') && d.includes('Rollierende 24 Stunden') && d.includes('ist innerhalb von drei Kalendermonaten einmal berechnungsfähig') && page.url().endsWith('#intervalle/1800'), page.url().split('#')[1]);
  await shot('11_intervalle_detail.png');
  await page.keyboard.press('Escape');
  await page.selectOption('#ivsel', { label: 'Jahr (taggenau 365 Tage) (0)' });
  check('Intervall ohne Wortlaut („Jahr (taggenau 365 Tage)“): 0 Ziffern, Hinweis im Infotext', (await txt('#status')).startsWith('0 von') && (await txt('#ivinfo')).includes('kein Wortlaut gefunden'), await txt('#status'));
  await page.click('#reset');
  await page.goto('file://' + html + '#intervalle/1017');
  await page.reload();
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Direktlink #intervalle/1017: kombiniertes Limit „Kalendertag und Behandlungsfall“, Häufigkeit „bis zu viermal; bis zu 15 Mal“', d.includes('Kalendertag und Behandlungsfall') && d.includes('bis zu viermal; bis zu 15 Mal') && /bestehend \(2\)/i.test(d), d.slice(0, 70));
  await page.keyboard.press('Escape');
  await page.click('#reset');
  await page.selectOption('#ivsel', { label: 'Kalendermonat (2)' });
  const [dl3] = await Promise.all([page.waitForEvent('download'), page.click('#csv')]);
  const csv3 = fs.readFileSync(await dl3.path(), 'utf8').replace(/^\ufeff/, '').split('\r\n');
  check('CSV-Export Intervalle (Kalendermonat): Kopf + 2 Zeilen (208, 4444)', csv3.length === 3 && csv3[0].includes('"Intervalle bestehend";"Intervalle neu"') && csv3[1].startsWith('208;') && csv3[2].startsWith('4444;'), csv3.length + ' Zeilen; ' + csv3.slice(1).map(l => l.split(';')[0]).join(', '));
  await page.click('#reset');
  await page.click('#tabs button[data-v=ab]');
  check('Zurück zu „AB-Steigerungsgründe“ nach Intervalle: 5.580 Ziffern, Intervall-Filter ausgeblendet', await page.locator('#f-iv').isHidden() && await page.locator('#ivinfo').isHidden() && (await txt('#status')).startsWith('5.580 von'), await txt('#status'));

  // ---------- Reiter Ziffern-Mapping ----------
  await page.goto('file://' + html);
  await page.reload();
  await page.click('#tabs button[data-v=mp]');
  const chipsMp = (await page.locator('#chipsmp .chip').allInnerTexts()).map(t => t.replace(/\s+/g, ' ')).join(' | ');
  check('Reiter „Ziffern-Mapping“: 2.831 alte Ziffern, Chips mit Prozentbereich – Sicher ≥ 80 % 522 · Plausibel 50–79 % 816 · Unsicher 25–49 % 765 · Keine Entsprechung < 25 % 667 · Sammelposition 61',
    chipsMp === 'S Sicher ≥ 80 % 522 | P Plausibel 50–79 % 816 | U Unsicher 25–49 % 765 | K Keine Entsprechung < 25 % 667 | X Sammelposition 61' && (await txt('#status')).startsWith('2.831 von 2.831 alten'), chipsMp + ' · ' + await txt('#status'));
  const navMp = (await page.locator('#nav button.kap').allInnerTexts()).map(t => t.replace(/\s+/g, ' '));
  check('Navigation zeigt die Kapitel der alten GOÄ (B bis P) mit Titel aus dem PDF', navMp.length === 15 && navMp.includes('G Neurologie, Psychiatrie und Psychotherapie 44') && navMp.includes('M Laboratoriumsuntersuchungen 921'), navMp.length + ' Kapitel; ' + navMp.filter(t => /^[GM] /.test(t)).join(' | '));
  await shot('12_mapping_start.png');
  await page.fill('#q', '863');
  await page.keyboard.press('Enter');
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Suche „863“: alte 863 → neue 4500, Wahrscheinlichkeit 82 %, Status Sicher, Begründung, Direktlink #mapping/alt/863',
    d.includes('Alte GOÄ · Ziffer 863') && d.includes('82 %') && d.includes('Sicher') && d.includes('Begründung:') && d.includes('Neu 4500') && d.includes('145,00 €') && page.url().endsWith('#mapping/alt/863'), d.slice(0, 80) + ' … ' + page.url().split('#')[1]);
  await shot('13_mapping_863.png');
  await page.keyboard.press('Escape');
  await page.fill('#q', '4500');
  await page.waitForTimeout(250);
  const z4500 = (await page.locator('.row .z').allInnerTexts()).join(',');
  check('Suche „4500“ (Richtung alt → neu): findet die alte 863 über die neue 4500 und die alte 4500 (Labor); Hinweis auf Nummernkollision',
    z4500.split(',').includes('863') && z4500.split(',').includes('4500') && (await txt('#ivinfo')).includes('gibt es in beiden Verzeichnissen') && await page.locator('.row mark').count() >= 2, z4500);
  await page.click('#mpdir button[data-d=neu]');
  await page.keyboard.press('/');
  await page.keyboard.press('Enter');
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Richtung neu → alt, Suche „4500“: neue 4500 ← alte 863 mit Wahrscheinlichkeit und Begründung, Direktlink #mapping/neu/4500',
    d.includes('GOÄneu · Ziffer 4500') && d.includes('Alt 863') && d.includes('82 %') && d.includes('Begründung:') && page.url().endsWith('#mapping/neu/4500') && (await txt('#status')).includes('von 5.580 Ziffern'), d.slice(0, 70) + ' … ' + page.url().split('#')[1]);
  await shot('14_mapping_neu_4500.png');
  await page.locator('#drawer .zl[data-mz="alt:863"]').click();
  check('Klick auf „Alt 863“ wechselt die Richtung und öffnet die alte Ziffer', (await txt('#drawer h2')).includes('Alte GOÄ · Ziffer 863') && await page.locator('#mpdir button[data-d=alt][aria-pressed=true]').count() === 1, (await txt('#drawer h2')).split('\n')[0]);
  await page.goto('file://' + html + '#mapping/alt/870');
  await page.reload();
  d = (await txt('#drawer')).replace(/\s+/g, ' ');
  check('Direktlink #mapping/alt/870: Nutzervorgabe 4510 und 4515, 4515 ohne automatische Wahrscheinlichkeit', d.includes('Neu 4510') && d.includes('Neu 4515') && d.includes('keine (Nutzervorgabe)') && d.includes('Quelle: Nutzervorgabe'), d.slice(0, 80));
  await page.keyboard.press('Escape');
  await page.click('#reset');
  await page.click('#chipsmp .chip[data-k=SICHER]');
  await page.selectOption('#mpql', 'manuell geprüft');
  const nMan = await txt('#status');
  const [dl4] = await Promise.all([page.waitForEvent('download'), page.click('#csv')]);
  const csv4 = fs.readFileSync(await dl4.path(), 'utf8').replace(/^\ufeff/, '').split('\r\n');
  check('Filter Sicher + Quelle „manuell geprüft“ und CSV-Export mit Wahrscheinlichkeit und Begründung', /^\d+ von 2\.831/.test(nMan) && csv4.length === parseInt(nMan) + 1 && csv4[0].includes('"Wahrscheinlichkeit";"Status";"Quelle";"Begründung"'), nMan + ' · ' + csv4.length + ' CSV-Zeilen');
  await page.click('#reset');
  await page.click('#tabs button[data-v=ab]');
  check('Zurück zu „AB-Steigerungsgründe“ nach Mapping: wieder neue Ziffern (5.580), Navigation mit 17 Kapiteln', (await txt('#status')).startsWith('5.580 von 5.580 Ziffern') && await page.locator('#nav button.kap').count() === 17 && await page.locator('#f-mp').isHidden(), await txt('#status'));

  // Laptop-Breite
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('file://' + html + '#13399');
  await page.reload();
  const ov = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('.row')].some(r => r.scrollWidth > r.clientWidth + 1));
  check('Laptop 1280×720 mit offenem Detailbereich: kein horizontaler Überlauf', !ov, ov ? 'Überlauf' : 'kein Überlauf');
  await shot('04_laptop_1280.png');

  check('Offline: keine externen Anfragen', requests.length === 0, requests.length ? requests.join(', ') : 'keine');
  check('Keine JavaScript-Fehler', errors.length === 0, errors.length ? errors.join(' | ') : 'keine');
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'qs_ui.json'), JSON.stringify({ checks, screenshots }, null, 1));
  process.exit(checks.every(c => c.ok) ? 0 : 1);
})().catch(e => { console.error(e); process.exit(2); });
