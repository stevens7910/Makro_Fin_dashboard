// Audit dat: nezávisle znovu stáhne oficiální zdroje a porovná je s public/data/macro-data.json.
// Spuštění: npm run audit-data  [-- --compare cesta/ke/starému.json]
import fs from 'node:fs';
import path from 'node:path';
import * as S from './lib/sources.mjs';

const file = path.resolve('public/data/macro-data.json');
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const cmpIdx = process.argv.indexOf('--compare');
const today = new Date();
const todayIso = today.toISOString().slice(0, 10);
const months = S.monthList(todayIso.slice(0, 7));
const TOL = 0.0051;

const checks = [];
const add = (c) => { c.status = c.mismatches === 0 && c.compared > 0 ? 'OK' : c.compared === 0 ? 'N/A' : 'CHYBA'; checks.push(c); };

function compareMap(id, name, source, stored, truth) {
  let compared = 0, mism = 0, maxDiff = 0;
  const details = [];
  for (const mm of months) {
    const t = truth[mm]?.value ?? null;
    const s = stored[mm] ?? null;
    if (t === null && s === null) continue;
    compared++;
    const diff = t === null || s === null ? Infinity : Math.abs(t - s);
    if (diff > TOL) { mism++; if (details.length < 8) details.push(`${mm}: dashboard=${s} zdroj=${t}`); }
    else maxDiff = Math.max(maxDiff, diff);
  }
  add({ id, name, source, compared, mismatches: mism, maxAbsDiff: Number(maxDiff.toFixed(4)), details });
}

const stored = (id) => Object.fromEntries(data.series.map((p) => [p.date, p[id]]));

// 1) Úplné přepočítání ze zdrojů
const [changes, pribor, fx, cpi, unemp, gdp] = await Promise.all([
  S.fetchRepoChanges(), S.fetchPribor(today.getUTCFullYear()), S.fetchFx(today.getUTCFullYear()),
  S.fetchCpi(), S.fetchUnemployment(), S.fetchGdp()
]);
const repo = S.repoByMonth(changes, months, todayIso);
const full = { cnb_repo_2w: repo, ...pribor, cpi_yoy: cpi, unemployment: unemp, gdp_yoy: gdp.gdp_yoy, gdp_qoq: gdp.gdp_qoq, ...fx };
const label = {
  cnb_repo_2w: ['2W repo sazba ČNB', 'ČNB – historie repo sazby'], pribor_1m: ['PRIBOR 1M', 'ČNB – fixing PRIBOR'], pribor_3m: ['PRIBOR 3M', 'ČNB – fixing PRIBOR'],
  pribor_12m: ['PRIBOR 12M', 'ČNB – fixing PRIBOR'], cpi_yoy: ['Inflace CPI y/y', 'ČSÚ DataStat WCEN01'], unemployment: ['Nezaměstnanost', 'Eurostat une_rt_m'],
  gdp_yoy: ['HDP y/y', 'Eurostat namq_10_gdp'], gdp_qoq: ['HDP q/q', 'Eurostat namq_10_gdp'], fx_eur: ['CZK/EUR', 'ČNB kurzovní lístek'], fx_usd: ['CZK/USD', 'ČNB kurzovní lístek']
};
for (const id of Object.keys(label)) compareMap(id, label[id][0] + ' – všechny měsíce od 2015', label[id][1], stored(id), full[id]);

// 2) Nezávislá křížová kontrola přes JINÉ rozhraní (api.cnb.cz) – vzorek koncových dní měsíců
const sample = months;
let fxN = 0, fxBad = 0, prN = 0, prBad = 0; const apiDet = [];
for (const mm of sample) {
  const [y, m] = mm.split('-').map(Number);
  let end = S.monthEnd(y, m); if (end > todayIso) end = todayIso;
  try {
    const f = await S.fetchApiJson(S.URLS.cnbApiFx(end));
    for (const [k, code] of [['fx_eur', 'EUR'], ['fx_usd', 'USD']]) {
      const r = f.rates.find((x) => x.currencyCode === code); if (!r) continue;
      fxN++; const s = stored(k)[mm];
      if (Math.abs(r.rate / r.amount - s) > 0.0051) { fxBad++; apiDet.push(`${k} ${mm}: dashboard=${s} api.cnb.cz=${r.rate} (${r.validFor})`); }
    }
    const p = await S.fetchApiJson(S.URLS.cnbApiPribor(end));
    for (const [k, per] of [['pribor_1m', 'ONE_MONTH'], ['pribor_3m', 'THREE_MONTH'], ['pribor_12m', 'ONE_YEAR']]) {
      const r = p.pribs.find((x) => x.period === per); if (!r) continue;
      prN++; const s = stored(k)[mm];
      if (Math.abs(r.pribor - s) > 0.0051) { prBad++; apiDet.push(`${k} ${mm}: dashboard=${s} api.cnb.cz=${r.pribor} (${r.validFor})`); }
    }
  } catch (e) { apiDet.push(`${mm}: api.cnb.cz nedostupné (${e.message})`); }
}
add({ id: 'xcheck_fx', name: `Křížová kontrola kurzů přes api.cnb.cz (všech ${sample.length} měsíců)`, source: 'api.cnb.cz/cnbapi/exrates', compared: fxN, mismatches: fxBad, maxAbsDiff: 0, details: apiDet.filter((d) => /^fx_/.test(d)) });
add({ id: 'xcheck_pribor', name: `Křížová kontrola PRIBOR přes api.cnb.cz (všech ${sample.length} měsíců)`, source: 'api.cnb.cz/cnbapi/pribor', compared: prN, mismatches: prBad, maxAbsDiff: 0, details: apiDet.filter((d) => /^pribor_/.test(d)) });

// 3) Konzistence a rozumné meze
const last = data.series[data.series.length - 1];
const probs = [];
if (data.series.length !== months.length) probs.push(`počet měsíců ${data.series.length} ≠ očekávaných ${months.length}`);
const ranges = { cnb_repo_2w: [0, 10], pribor_1m: [0, 10], pribor_3m: [0, 10], pribor_12m: [0, 10], cpi_yoy: [-2, 20], unemployment: [0, 12], gdp_yoy: [-15, 15], gdp_qoq: [-12, 12], fx_eur: [20, 30], fx_usd: [15, 35] };
for (const p of data.series) for (const [k, [lo, hi]] of Object.entries(ranges)) if (p[k] !== null && (p[k] < lo || p[k] > hi)) probs.push(`${p.date} ${k}=${p[k]} mimo [${lo}; ${hi}]`);
const repoStored = last.cnb_repo_2w;
const api1 = await S.fetchApiJson('https://api.cnb.cz/cnbapi/pribor/daily').catch(() => null);
const on = api1?.pribs.find((x) => x.period === 'ONE_DAY')?.pribor;
if (on !== undefined && Math.abs(on - repoStored) > 0.5) probs.push(`PRIBOR O/N ${on} se výrazně liší od repo ${repoStored}`);
add({ id: 'sanity', name: 'Úplnost měsíců, rozumné meze, repo vs. PRIBOR O/N (dnešní)', source: 'interní', compared: data.series.length, mismatches: probs.length, maxAbsDiff: 0, details: probs.slice(0, 8) });

// 4) Volitelně: porovnání se starým souborem (např. původním v1 s odhady)
let compareOld = null;
if (cmpIdx > 0) {
  const old = JSON.parse(fs.readFileSync(process.argv[cmpIdx + 1], 'utf8')).series;
  const byDate = Object.fromEntries(old.map((p) => [p.date, p]));
  compareOld = {};
  for (const id of Object.keys(label)) {
    let n = 0, bad = 0, mx = 0;
    for (const p of data.series) { const o = byDate[p.date]?.[id]; if (o === undefined || p[id] === null) continue; n++; const d = Math.abs(o - p[id]); if (d > TOL) { bad++; mx = Math.max(mx, d); } }
    compareOld[id] = { compared: n, wrongInOld: bad, maxAbsDiffInOld: Number(mx.toFixed(2)) };
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  dataLastUpdated: data.lastUpdated,
  status: checks.every((c) => c.status === 'OK') ? 'OK' : 'CHYBA',
  latest: data.latest,
  unverified: [{ id: 'irs_3y', reason: 'Žádný veřejný bezplatný zdroj CZK IRS – hodnoty nejsou zobrazeny' }, { id: 'irs_5y', reason: 'Žádný veřejný bezplatný zdroj CZK IRS – hodnoty nejsou zobrazeny' }],
  checks
};
fs.writeFileSync(path.resolve('public/data/audit-report.json'), JSON.stringify(report, null, 2));
for (const c of checks) console.log(`${c.status.padEnd(5)} ${c.name} [${c.compared} porovnáno, ${c.mismatches} rozdílů]${c.details.length ? '\n        ' + c.details.join('\n        ') : ''}`);
if (compareOld) { console.log('\nStaré (v1) odhady vs. oficiální zdroje:'); console.table(compareOld); }
console.log('\nCelkově:', report.status);
process.exit(report.status === 'OK' ? 0 : 1);

