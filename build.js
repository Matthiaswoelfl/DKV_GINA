// Baut die eigenständige Einzeldatei Budget-Dashboard.html (alles eingebettet, offline lauffähig).
// Aufruf: node build.js
const fs = require('fs'), path = require('path');
const rd = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
const safe = s => s.replace(/<\/script/gi, '<\\/script');
// Funktionsersetzung, damit "$"-Muster im Code nicht als Platzhalter wirken
let html = rd('src/template.html');
const sub = (key, val) => { html = html.split('/*' + key + '*/').join(val); };
sub('CSS', rd('src/styles.css'));
sub('CONFIG', JSON.stringify(JSON.parse(rd('config/basisplan.json'))));
sub('CORE', safe(rd('src/core.js')));
sub('XLSX', safe(rd('src/xlsx.js')));
sub('UI', safe(rd('src/ui.js')));
fs.writeFileSync(path.join(__dirname, 'Budget-Dashboard.html'), html);
console.log('Budget-Dashboard.html erzeugt (' + Math.round(html.length / 1024) + ' KB)');
