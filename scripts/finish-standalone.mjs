import fs from 'node:fs';

fs.mkdirSync('standalone', { recursive: true });
fs.copyFileSync('dist-standalone/index.html', 'standalone/finanz-dashboard.html');
const kb = Math.round(fs.statSync('standalone/finanz-dashboard.html').size / 1024);
console.log(`Fertig: standalone/finanz-dashboard.html (${kb} KB). Doppelklick öffnet sie im Browser.`);
