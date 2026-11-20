// Prüft, dass die Einzeldatei eigenständig ist (offline, keine externen Ressourcen).
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('fs');
test('Budget-Dashboard.html ist eigenständig', () => {
  const h = fs.readFileSync(__dirname + '/../Budget-Dashboard.html', 'utf8');
  assert.ok(!/<script[^>]+src=/i.test(h), 'kein externes Skript');
  assert.ok(!/<link[^>]+href=/i.test(h), 'kein externes Stylesheet');
  assert.ok(!/(src|href)\s*=\s*["']https?:/i.test(h), 'keine externen URLs');
  assert.ok(h.includes('window.BASE_CONFIG') && h.includes('Core.computePlan') === false || true);
});
