// Export-Test: erzeugt die Datei, rechnet sie mit LibreOffice neu und vergleicht mit dem Rechenkern.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
const Core = require('../src/core.js'), Xlsx = require('../src/xlsx.js');
const plan = Core.planFromConfig(require('../config/basisplan.json'));

test('Excel-Export enthält echte Formeln und keine #REF!-Fehler', () => {
  const { bytes } = Xlsx.build(plan);
  const txt = Buffer.from(bytes).toString('latin1');
  assert.ok(txt.includes('<f>SUM('), 'Formeln vorhanden');
  assert.ok(!txt.includes('#REF!'));
});

const soffice = cp.spawnSync('which', ['soffice']).status === 0;
test('Export nach Neuberechnung (LibreOffice) = Rechenkern', { skip: !soffice && 'LibreOffice fehlt' }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xl-')), out = path.join(dir, 'out');
  const p2 = Core.setRange(plan, plan.roles[1].id, 4, 25, 0.25);
  p2.parameters.holidays = true;
  const { bytes, addr } = Xlsx.build(p2);
  const f = path.join(dir, 'e.xlsx'); fs.writeFileSync(f, bytes);
  // LibreOffice rechnet die Formeln neu und speichert die Werte mit
  cp.execFileSync('soffice', ['--headless', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', out, f], { stdio: 'ignore' });
  const py = "import openpyxl,sys,json;ws=openpyxl.load_workbook(sys.argv[1],data_only=True).active;print(json.dumps([ws[a].value for a in sys.argv[2:]]))";
  const keys = ['net', 'gross', 'days', 'fee', 'travel'];
  const vals = JSON.parse(cp.execFileSync('python3', ['-I', '-c', py, path.join(out, 'e.xlsx')].concat(keys.map(k => addr[k]))));
  const t = Core.computePlan(p2).totals;
  keys.forEach((k, i) => assert.ok(Math.abs(vals[i] - t[k]) < 0.01, k + ': ' + vals[i] + ' vs ' + t[k]));
});
