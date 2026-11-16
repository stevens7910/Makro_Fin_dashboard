// Sdílená knihovna pro stahování OFICIÁLNÍCH dat (ČNB, ČSÚ, Eurostat). Node >= 18 (nativní fetch).
// Použití: scripts/update-data.mjs (aktualizace) a scripts/audit-data.mjs (audit).

export const START_YEAR = 2015;

export const URLS = {
  repoPage: 'https://www.cnb.cz/cs/casto-kladene-dotazy/Jak-se-vyvijela-dvoutydenni-repo-sazba-CNB/',
  priborYear: (y) =>
    `https://www.cnb.cz/cs/financni-trhy/penezni-trh/pribor/fixing-urokovych-sazeb-na-mezibankovnim-trhu-depozit-pribor/rok.txt?year=${y}`,
  fxYear: (y) =>
    `https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/rok.txt?rok=${y}`,
  cnbApiFx: (iso) => `https://api.cnb.cz/cnbapi/exrates/daily?date=${iso}&lang=EN`,
  cnbApiPribor: (iso) => `https://api.cnb.cz/cnbapi/pribor/daily?date=${iso}`,
  czsoCpi: 'https://data.csu.gov.cz/api/dotaz/v1/data/sady/WCEN01?format=CSV',
  eurostatUnemp:
    'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m?geo=CZ&s_adj=SA&age=TOTAL&sex=T&unit=PC_ACT&sinceTimePeriod=2015-01',
  eurostatGdp: (unit) =>
    `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/namq_10_gdp?geo=CZ&na_item=B1GQ&s_adj=SCA&unit=${unit}&sinceTimePeriod=2015-Q1`
};

async function getText(url, tries = 3) {
  let err;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'cz-makrofin-updater/2.0' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.text();
    } catch (e) {
      err = e;
      await new Promise((res) => setTimeout(res, 800 * (i + 1)));
    }
  }
  throw new Error(`${url}: ${err.message}`);
}

const num = (s) => {
  if (s === undefined || s === null) return null;
  const t = String(s).trim().replace(/\s/g, '').replace(',', '.');
  if (t === '' || t === '-') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

// "13.11.2026" | "3.5.2019" -> "2026-11-13"
const csDateToIso = (s) => {
  const m = String(s).replace(/&nbsp;|\s/g, '').match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null;
};

export const ym = (iso) => iso.slice(0, 7);
export const monthEnd = (y, m) => `${y}-${String(m).padStart(2, '0')}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`;

export function monthList(untilYm) {
  const out = [];
  const [uy, um] = untilYm.split('-').map(Number);
  for (let y = START_YEAR; y <= uy; y++) for (let m = 1; m <= (y === uy ? um : 12); m++) out.push(`${y}-${String(m).padStart(2, '0')}`);
  return out;
}

/** Z denní řady [{date, value}] vezme poslední pozorování každého měsíce. */
function lastPerMonth(daily) {
  const out = {};
  for (const { date, value } of daily) if (value !== null) out[ym(date)] = { value, obsDate: date };
  return out;
}

/** 2T repo: tabulka změn z oficiální stránky ČNB -> hodnota platná ke konci každého měsíce. */
export async function fetchRepoChanges() {
  const html = await getText(URLS.repoPage);
  const changes = [];
  for (const m of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => c[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim());
    if (cells.length < 2) continue;
    const date = csDateToIso(cells[0]);
    const value = num(cells[1]);
    if (date && value !== null) changes.push({ date, value });
  }
  changes.sort((a, b) => a.date.localeCompare(b.date));
  if (changes.length < 20) throw new Error(`Repo tabulka: nalezeno jen ${changes.length} řádků – změnila se struktura stránky?`);
  return changes;
}

export function repoByMonth(changes, months, todayIso) {
  const out = {};
  for (const mm of months) {
    const [y, m] = mm.split('-').map(Number);
    let end = monthEnd(y, m);
    if (end > todayIso) end = todayIso;
    let cur = null;
    for (const c of changes) if (c.date <= end) cur = c;
    out[mm] = cur ? { value: cur.value, obsDate: end } : { value: null, obsDate: null };
  }
  return out;
}

/** PRIBOR (1M, 3M, 12M) z ročních souborů ČNB. */
export async function fetchPribor(untilYear) {
  const daily = { pribor_1m: [], pribor_3m: [], pribor_12m: [] };
  for (let y = START_YEAR; y <= untilYear; y++) {
    const txt = await getText(URLS.priborYear(y));
    const lines = txt.split(/\r?\n/).filter((l) => l.trim());
    const head = lines[0].split('|');
    const colOf = (re) => {
      const i = head.findIndex((h) => re.test(h.trim()));
      if (i < 0) throw new Error(`PRIBOR ${y}: chybí sloupec ${re}`);
      return i + 1; // sloupec PRIBOR leží hned za PRIBID
    };
    const c1m = colOf(/^1 m/i), c3m = colOf(/^3 m/i), c12 = colOf(/^1 rok/i);
    for (const l of lines.slice(2)) {
      const c = l.split('|');
      const date = csDateToIso(c[0]);
      if (!date) continue;
      daily.pribor_1m.push({ date, value: num(c[c1m]) });
      daily.pribor_3m.push({ date, value: num(c[c3m]) });
      daily.pribor_12m.push({ date, value: num(c[c12]) });
    }
  }
  return Object.fromEntries(Object.entries(daily).map(([k, v]) => [k, lastPerMonth(v)]));
}

/** Kurzy CZK/EUR a CZK/USD z JSON API ČNB (daily-year; měnové kódy explicitně – textové roční soubory mají posunuté sloupce, když ČNB některou měnu přestane vyhlašovat). */
export async function fetchFx(untilYear) {
  const daily = { fx_eur: [], fx_usd: [] };
  for (let y = START_YEAR; y <= untilYear; y++) {
    const js = JSON.parse(await getText(`https://api.cnb.cz/cnbapi/exrates/daily-year?year=${y}&lang=EN`));
    for (const r of js.rates) {
      if (r.currencyCode === 'EUR') daily.fx_eur.push({ date: r.validFor, value: r.rate / r.amount });
      if (r.currencyCode === 'USD') daily.fx_usd.push({ date: r.validFor, value: r.rate / r.amount });
    }
  }
  for (const k of Object.keys(daily)) daily[k].sort((a, b) => a.date.localeCompare(b.date));
  return Object.fromEntries(Object.entries(daily).map(([k, v]) => [k, lastPerMonth(v)]));
}
const CZ_MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec'];

/** Inflace CPI meziročně (%) z ČSÚ DataStat: index "Stejné období předchozího roku = 100" − 100. */
export async function fetchCpi() {
  const txt = await getText(URLS.czsoCpi);
  const out = {};
  for (const l of txt.split(/\r?\n/).slice(1)) {
    const c = l.split('","').map((s) => s.replace(/^"|"$/g, ''));
    if (!/^Stejné období předchozího roku/.test(c[0])) continue;
    const m = c[2]?.match(/^(\S+)\s+(\d{4})$/);
    const idx = m ? CZ_MONTHS.indexOf(m[1]) : -1;
    const v = num(c[3]);
    if (idx < 0 || v === null) continue;
    const key = `${m[2]}-${String(idx + 1).padStart(2, '0')}`;
    if (key >= `${START_YEAR}-01`) out[key] = { value: Number((v - 100).toFixed(1)), obsDate: null };
  }
  if (Object.keys(out).length < 100) throw new Error('CPI: málo dat z ČSÚ');
  return out;
}

function jsonStatSeries(js) {
  const idx = js.dimension.time.category.index; // {"2015-01":0,...}
  const out = {};
  for (const [t, i] of Object.entries(idx)) out[t] = js.value[String(i)] ?? null;
  return out;
}

/** Míra nezaměstnanosti (ILO, sezónně očištěno, 15–74) – Eurostat une_rt_m. */
export async function fetchUnemployment() {
  const js = JSON.parse(await getText(URLS.eurostatUnemp));
  const s = jsonStatSeries(js);
  const out = {};
  for (const [t, v] of Object.entries(s)) if (v !== null) out[t] = { value: Number(v.toFixed(1)), obsDate: null };
  return out;
}

/** Růst HDP – Eurostat namq_10_gdp (reálně, sezónně a kalendářně očištěno); čtvrtletí -> 3 měsíce. */
export async function fetchGdp() {
  const res = {};
  for (const [key, unit] of [['gdp_qoq', 'CLV_PCH_PRE'], ['gdp_yoy', 'CLV_PCH_SM']]) {
    const s = jsonStatSeries(JSON.parse(await getText(URLS.eurostatGdp(unit))));
    const out = {};
    for (const [q, v] of Object.entries(s)) {
      if (v === null) continue;
      const m = q.match(/^(\d{4})-Q([1-4])$/);
      for (let k = 0; k < 3; k++) out[`${m[1]}-${String((Number(m[2]) - 1) * 3 + k + 1).padStart(2, '0')}`] = { value: Number(v.toFixed(1)), obsDate: null, quarter: `${m[2]}Q ${m[1]}` };
    }
    res[key] = out;
  }
  return res;
}

export async function fetchApiJson(url) {
  return JSON.parse(await getText(url));
}

