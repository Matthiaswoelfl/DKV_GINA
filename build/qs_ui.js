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
  check('Startansicht: Status „1.999 von 1.999 Ziffern“', (await txt('#status')).startsWith('1.999 von 1.999'), await txt('#status'));
  const nav = await page.locator('#nav button.kap').allInnerTexts();
  check('Navigation: Kapitel C, D, F, L, O mit 100 / 2 / 31 / 1.705 / 161',
    nav.map(s => s.replace(/\s+/g, ' ')).join(' | ') === 'Kapitel C 100 | Kapitel D 2 | Kapitel F 31 | Kapitel L 1.705 | Kapitel O 161', nav.map(s => s.replace(/\s+/g, ' ')).join(' | '));
  check('Navigation: 23 Abschnitte', await page.locator('#nav button.abs').count() === 23, await page.locator('#nav button.abs').count());
  const dom = await page.locator('#spacer > *').count();
  check('Virtualisierung: weniger als 80 Zeilen im DOM', dom < 80, dom + ' Elemente');
  const opts = await page.locator('#fmax option').allInnerTexts();
  check('Faktorfilter zeigt Verteilung 142 / 55 / 58 / 37 / 1.470 / 2 / 235',
    opts.slice(1).join(' ') === '×1,5 (142) ×2,0 (55) ×2,25 (58) ×3,0 (37) ×4,0 (1.470) ×4,5 (2) ×6,0 (235)', opts.slice(1).join(' '));
  check('Startansicht: alle 23 Abschnitte eingeklappt', await page.locator('.ghead[aria-expanded=false]').count() === 23 && await page.locator('.row').count() === 0, (await page.locator('.ghead[aria-expanded=false]').count()) + ' eingeklappt, ' + (await page.locator('.row').count()) + ' Zeilen');
  await shot('01_startansicht.png');
  await page.locator('.ghead').first().click();
  check('Klick auf Abschnitt klappt auf (C III: 22 Ziffern)', await page.locator('.row').count() >= 15 && (await page.locator('.row .z').first().innerText()) === '900', (await page.locator('.row .z').first().innerText()));
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
