// Aktualizace public/data/macro-data.json z OFICIÁLNÍCH zdrojů (ČNB, ČSÚ, Eurostat).
// Spuštění: npm run update-data
// CZK IRS 3Y/5Y nemají veřejný bezplatný zdroj -> čtou se z volitelného souboru data/irs_manual.csv (date;irs_3y;irs_5y), jinak zůstávají null.
import fs from 'node:fs';
import path from 'node:path';
import * as S from './lib/sources.mjs';

const out = path.resolve('public/data/macro-data.json');
const today = new Date();
const todayIso = today.toISOString().slice(0, 10);
const untilYm = todayIso.slice(0, 7);
const months = S.monthList(untilYm);

console.log('Stahuji data (ČNB, ČSÚ, Eurostat)...');
const [changes, pribor, fx, cpi, unemp, gdp] = await Promise.all([
  S.fetchRepoChanges(),
  S.fetchPribor(today.getUTCFullYear()),
  S.fetchFx(today.getUTCFullYear()),
  S.fetchCpi(),
  S.fetchUnemployment(),
  S.fetchGdp()
]);
const repo = S.repoByMonth(changes, months, todayIso);

// volitelné ruční IRS
const irs = { irs_3y: {}, irs_5y: {} };
const irsFile = path.resolve('data/irs_manual.csv');
if (fs.existsSync(irsFile)) {
  for (const l of fs.readFileSync(irsFile, 'utf8').split(/\r?\n/).slice(1)) {
    const [d, a, b] = l.split(/[;,]/);
    if (!d) continue;
    const k = d.trim().slice(0, 7);
    if (a?.trim()) irs.irs_3y[k] = { value: Number(a.replace(',', '.')), obsDate: d.trim() };
    if (b?.trim()) irs.irs_5y[k] = { value: Number(b.replace(',', '.')), obsDate: d.trim() };
  }
}

const maps = {
  cnb_repo_2w: repo, pribor_1m: pribor.pribor_1m, pribor_3m: pribor.pribor_3m, pribor_12m: pribor.pribor_12m,
  irs_3y: irs.irs_3y, irs_5y: irs.irs_5y, cpi_yoy: cpi, unemployment: unemp, gdp_yoy: gdp.gdp_yoy, gdp_qoq: gdp.gdp_qoq,
  fx_eur: fx.fx_eur, fx_usd: fx.fx_usd
};

const series = months.map((mm) => {
  const [y, m] = mm.split('-').map(Number);
  const p = { date: mm, validDate: S.monthEnd(y, m), quarter: `${Math.ceil(m / 3)}Q ${y}` };
  for (const [id, map] of Object.entries(maps)) p[id] = map[mm]?.value ?? null;
  return p;
});

const latest = {};
for (const [id, map] of Object.entries(maps)) {
  const keys = Object.keys(map).filter((k) => map[k].value !== null).sort();
  const k = keys[keys.length - 1];
  latest[id] = k ? { period: k, obsDate: map[k].obsDate, quarter: map[k].quarter ?? null } : null;
}

const payload = {
  schemaVersion: '2.0.0',
  lastUpdated: new Date().toISOString(),
  generator: 'scripts/update-data.mjs (oficiální zdroje, bez syntetických dat)',
  note: 'Měsíční hodnota sazeb a kurzů = poslední pozorování v měsíci. null = údaj ještě nebyl publikován / zdroj není k dispozici.',
  sources: {
    cnb_repo_2w: { name: 'ČNB – historie 2T repo sazby', url: S.URLS.repoPage },
    pribor: { name: 'ČNB – fixing PRIBOR (roční soubory)', url: S.URLS.priborYear('{rok}') },
    fx: { name: 'ČNB – kurzy devizového trhu (roční soubory)', url: S.URLS.fxYear('{rok}') },
    cpi_yoy: { name: 'ČSÚ DataStat WCEN01 (index stejné období předchozího roku − 100)', url: S.URLS.czsoCpi },
    unemployment: { name: 'Eurostat une_rt_m (ILO, sezónně očištěno, 15–74)', url: S.URLS.eurostatUnemp },
    gdp: { name: 'Eurostat namq_10_gdp (reálný, sez. a kal. očištěný)', url: S.URLS.eurostatGdp('CLV_PCH_SM') },
    irs: { name: 'CZK IRS 3Y/5Y – žádný veřejný bezplatný zdroj; volitelně data/irs_manual.csv', url: null }
  },
  latest,
  series
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(payload));
console.log(`Uloženo ${series.length} měsíců → ${out}`);
for (const [id, l] of Object.entries(latest)) console.log(' ', id.padEnd(13), l ? `${l.period}${l.obsDate ? ' (' + l.obsDate + ')' : ''}` : 'bez dat');
