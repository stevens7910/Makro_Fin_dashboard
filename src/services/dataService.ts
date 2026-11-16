import {
  CacheDiagnostics,
  IndicatorId,
  KpiSummary,
  MacroDataPoint,
  MacroDatasetPayload,
  TimeRangeKey
} from '../types/macro';
import { INDICATORS, INDICATOR_LIST, TIME_RANGE_OPTIONS } from '../config/indicators';

const STORAGE_CACHE_KEY = 'cz_makrofin_dataset_cache_v1';
const STORAGE_META_KEY = 'cz_makrofin_dataset_meta_v1';
const CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 hodin TTL pro L2 persistentní cache

// L1 In-Memory Singleton Cache — zamezuje znovustahování dat při překlikávání záložek
let memoryDataset: MacroDatasetPayload | null = null;
let inFlightPromise: Promise<MacroDatasetPayload> | null = null;
const sliceMemoCache = new Map<string, MacroDataPoint[]>();
let kpiSummaryMemo: KpiSummary[] | null = null;

let diagnosticsState: CacheDiagnostics = {
  memoryHits: 0,
  localStorageHit: false,
  serviceWorkerActive: typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !!navigator.serviceWorker.controller,
  serviceWorkerVersion: 'cz-makrofin-v1.2.0',
  lastFetchTimestamp: '',
  dataSourceUsed: 'network-json-l3',
  recordCount: 0,
  payloadSizeKb: 0,
  liveCnbStatus: 'idle'
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export function subscribeDiagnostics(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getCacheDiagnostics(): CacheDiagnostics {
  return {
    ...diagnosticsState,
    serviceWorkerActive:
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      !!navigator.serviceWorker.controller
  };
}

/**
 * Načte makroekonomický dataset s víceúrovňovou cache:
 * 1. L1 Memory Cache (0 ms odezva při přepínání záložek)
 * 2. Deduplikace souběžných požadavků (inFlightPromise)
 * 3. L2 LocalStorage Cache (pokud je platné TTL a není vynucen refresh)
 * 4. L3 Network / Service Worker Cache (/data/macro-data.json)
 */
export async function getMacroDataset(forceRefresh = false): Promise<MacroDatasetPayload> {
  if (!forceRefresh && memoryDataset) {
    diagnosticsState.memoryHits += 1;
    diagnosticsState.dataSourceUsed = 'memory-l1';
    notifyListeners();
    return memoryDataset;
  }

  if (!forceRefresh && inFlightPromise) {
    diagnosticsState.memoryHits += 1;
    notifyListeners();
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      // Zkusit L2 LocalStorage cache, pokud není forceRefresh
      if (!forceRefresh) {
        try {
          const rawCached = localStorage.getItem(STORAGE_CACHE_KEY);
          const rawMeta = localStorage.getItem(STORAGE_META_KEY);
          if (rawCached && rawMeta) {
            const meta = JSON.parse(rawMeta) as { timestamp: number; sizeKb: number };
            const isFresh = Date.now() - meta.timestamp < CACHE_TTL_MS;
            if (isFresh) {
              const parsed = JSON.parse(rawCached) as MacroDatasetPayload;
              memoryDataset = parsed;
              sliceMemoCache.clear();
              kpiSummaryMemo = null;
              diagnosticsState = {
                ...diagnosticsState,
                localStorageHit: true,
                lastFetchTimestamp: new Date(meta.timestamp).toISOString(),
                dataSourceUsed: 'localstorage-l2',
                recordCount: parsed.series.length,
                payloadSizeKb: meta.sizeKb
              };
              notifyListeners();
              return parsed;
            }
          }
        } catch {
          // Ignorovat chybu čtení z localStorage (např. anonymní režim)
        }
      }

      // Stáhnout z /data/macro-data.json (obsluhováno rovněž Service Workerem v offline režimu)
      const response = await fetch('/data/macro-data.json', {
        cache: forceRefresh ? 'reload' : 'default'
      });
      if (!response.ok) {
        throw new Error(`Chyba načítání /data/macro-data.json: HTTP ${response.status}`);
      }
      const rawText = await response.text();
      const sizeKb = Math.round((rawText.length / 1024) * 10) / 10;
      const payload = JSON.parse(rawText) as MacroDatasetPayload;

      // Uložit do L1 a L2 cache
      memoryDataset = payload;
      sliceMemoCache.clear();
      kpiSummaryMemo = null;

      const now = Date.now();
      try {
        localStorage.setItem(STORAGE_CACHE_KEY, rawText);
        localStorage.setItem(
          STORAGE_META_KEY,
          JSON.stringify({ timestamp: now, sizeKb })
        );
      } catch {
        // Quota exceeded nebo zakázané úložiště
      }

      diagnosticsState = {
        ...diagnosticsState,
        localStorageHit: false,
        lastFetchTimestamp: new Date(now).toISOString(),
        dataSourceUsed: 'network-json-l3',
        recordCount: payload.series.length,
        payloadSizeKb: sizeKb
      };
      notifyListeners();
      return payload;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
}

/**
 * Volitelná živá synchronizace s veřejnými API ČNB (kurzy CZK/EUR, CZK/USD) a ČSÚ (JSON-stat).
 * Pokud prohlížeč narazí na CORS nebo je uživatel offline, plynule ponechá lokální JSON dataset.
 */
export async function syncWithLivePublicApis(): Promise<{
  success: boolean;
  message: string;
  updatedFields: string[];
}> {
  const dataset = await getMacroDataset(false);
  const updatedFields: string[] = [];

  try {
    // Pokus o přímé načtení denního kurzovního lístku ČNB
    const cnbUrl =
      'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);

    const resp = await fetch(cnbUrl, { signal: controller.signal });
    clearTimeout(timer);

    if (resp.ok) {
      const txt = await resp.text();
      const lines = txt.split('\n').map((l) => l.trim()).filter(Boolean);
      const latest = { ...dataset.series[dataset.series.length - 1] };

      for (const line of lines.slice(2)) {
        const parts = line.split('|');
        if (parts.length >= 5) {
          const code = parts[3].trim();
          const amount = parseFloat(parts[2].replace(',', '.')) || 1;
          const rate = parseFloat(parts[4].replace(',', '.')) / amount;
          if (code === 'EUR' && !isNaN(rate)) {
            latest.fx_eur = Number(rate.toFixed(2));
            updatedFields.push(`CZK/EUR (${latest.fx_eur} Kč)`);
          }
          if (code === 'USD' && !isNaN(rate)) {
            latest.fx_usd = Number(rate.toFixed(2));
            updatedFields.push(`CZK/USD (${latest.fx_usd} Kč)`);
          }
        }
      }

      if (updatedFields.length > 0) {
        dataset.series[dataset.series.length - 1] = latest;
        memoryDataset = { ...dataset, lastUpdated: new Date().toISOString() };
        sliceMemoCache.clear();
        kpiSummaryMemo = null;
        diagnosticsState.liveCnbStatus = 'ok';
        diagnosticsState.dataSourceUsed = 'live-api-enriched';
        notifyListeners();
        return {
          success: true,
          message: `Živá data z ČNB API úspěšně načtena: ${updatedFields.join(', ')}`,
          updatedFields
        };
      }
    }
  } catch {
    // V prostředí prohlížeče bez CORS proxy nebo v offline režimu použijeme lokální JSON ze scraperu
  }

  diagnosticsState.liveCnbStatus = 'fallback';
  notifyListeners();
  return {
    success: false,
    message:
      'Přímé volání ČNB API z prohlížeče bylo omezeno politikou CORS nebo jste offline. Použita kompletní lokální databáze macro-data.json (připravená pro scripts/scraper_cz_macro.py).',
    updatedFields: []
  };
}

/**
 * Vymaže L1 paměťovou, L2 LocalStorage i L3 Service Worker datovou cache a znovu načte data.
 */
export async function clearAllCachesAndReload(): Promise<MacroDatasetPayload> {
  memoryDataset = null;
  sliceMemoCache.clear();
  kpiSummaryMemo = null;
  diagnosticsState.memoryHits = 0;

  try {
    localStorage.removeItem(STORAGE_CACHE_KEY);
    localStorage.removeItem(STORAGE_META_KEY);
  } catch {
    // ignore
  }

  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_DATA_CACHE' });
  }

  return getMacroDataset(true);
}

/**
 * Vrátí vyfiltrovanou časovou řadu podle zvoleného období (1R = 12M, 3R = 36M, 5R = 60M, ALL = Od 2015).
 * Výsledek je memoizován v L1 cache pro okamžité překreslení grafů.
 */
export function filterSeriesByRange(
  series: MacroDataPoint[],
  rangeKey: TimeRangeKey
): MacroDataPoint[] {
  if (!series || series.length === 0) return [];

  const cacheKey = `${series.length}_${series[series.length - 1].date}_${rangeKey}`;
  const cachedSlice = sliceMemoCache.get(cacheKey);
  if (cachedSlice) {
    diagnosticsState.memoryHits += 1;
    return cachedSlice;
  }

  const option = TIME_RANGE_OPTIONS.find((o) => o.key === rangeKey);
  let result: MacroDataPoint[];

  if (!option || option.months === null) {
    result = series;
  } else {
    result = series.slice(Math.max(0, series.length - option.months));
  }

  sliceMemoCache.set(cacheKey, result);
  return result;
}

/**
 * Vypočítá přehledové KPI karty pro hlavní stránku (Aktuální situace) včetně MoM/QoQ a YoY změn.
 */
export function computeKpiSummaries(series: MacroDataPoint[]): KpiSummary[] {
  if (!series || series.length === 0) return [];
  if (kpiSummaryMemo) {
    return kpiSummaryMemo;
  }

  const latestIdx = series.length - 1;
  const latest = series[latestIdx];
  const prevMonth = series[Math.max(0, latestIdx - 1)];
  const prevQuarter = series[Math.max(0, latestIdx - 3)];
  const prevYear = series[Math.max(0, latestIdx - 12)];
  const last12 = series.slice(Math.max(0, series.length - 12));

  const summaries: KpiSummary[] = INDICATOR_LIST.map((def) => {
    const currentVal = latest[def.id];
    const isQuarterly = def.frequency === 'Čtvrtletní';
    const refPrev = isQuarterly ? prevQuarter[def.id] : prevMonth[def.id];
    const refYear = prevYear[def.id];

    let momChange: number;
    let yoyChange: number;

    if (def.changeUnit === 'pct') {
      momChange = refPrev !== 0 ? ((currentVal - refPrev) / refPrev) * 100 : 0;
      yoyChange = refYear !== 0 ? ((currentVal - refYear) / refYear) * 100 : 0;
    } else {
      momChange = currentVal - refPrev;
      yoyChange = currentVal - refYear;
    }

    const sparkValues = last12.map((pt) => pt[def.id]);
    const min12m = Math.min(...sparkValues);
    const max12m = Math.max(...sparkValues);

    let secondaryMetric: KpiSummary['secondaryMetric'] = undefined;
    if (def.id === 'gdp_yoy') {
      secondaryMetric = {
        label: 'Mezičtvrtletně (QoQ)',
        value: latest.gdp_qoq,
        unit: '%'
      };
    } else if (def.id === 'cnb_repo_2w') {
      secondaryMetric = {
        label: 'Reálná sazba (vs CPI)',
        value: Number((latest.cnb_repo_2w - latest.cpi_yoy).toFixed(2)),
        unit: '%'
      };
    }

    return {
      id: def.id,
      definition: def,
      currentValue: currentVal,
      validDate: latest.validDate,
      periodLabel: isQuarterly ? latest.quarter : formatMonthYearCz(latest.date),
      momChange: Number(momChange.toFixed(2)),
      momChangeLabel: isQuarterly ? 'QoQ' : 'MoM',
      yoyChange: Number(yoyChange.toFixed(2)),
      secondaryMetric,
      sparkline: last12.map((pt) => ({
        date: pt.date,
        value: pt[def.id]
      })),
      min12m,
      max12m
    };
  });

  kpiSummaryMemo = summaries;
  return summaries;
}

/**
 * České formátování čísel a dat
 */
export function formatNumberCz(value: number, decimals = 2): string {
  return value.toLocaleString('cs-CZ', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatSignedChangeCz(
  value: number,
  changeUnit: 'pb' | 'pct',
  decimals = 2
): string {
  const sign = value > 0 ? '+' : '';
  const suffix = changeUnit === 'pb' ? ' p.b.' : ' %';
  return `${sign}${formatNumberCz(value, decimals)}${suffix}`;
}

const CZ_MONTHS_SHORT = [
  'Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn',
  'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'
];

const CZ_MONTHS_FULL = [
  'Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen',
  'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'
];

export function formatMonthYearShortCz(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${CZ_MONTHS_SHORT[m - 1]} ${String(y).slice(2)}`;
}

export function formatMonthYearCz(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  if (!y || !m) return ym;
  return `${CZ_MONTHS_FULL[m - 1]} ${y}`;
}

export function formatValidDateCz(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}. ${parts[1]}. ${parts[0]}`;
}

/**
 * Export vybraných indikátorů a časového období do CSV souboru
 */
export function exportSeriesToCsv(
  series: MacroDataPoint[],
  indicatorIds: IndicatorId[],
  filenamePrefix: string
): void {
  const headers = [
    'Obdobi_YYYY_MM',
    'Datum_Platnosti',
    'Ctvrtleti',
    ...indicatorIds.map((id) => `${INDICATORS[id].shortName} (${INDICATORS[id].unit})`)
  ];

  const rows = series.map((pt) => [
    pt.date,
    pt.validDate,
    pt.quarter,
    ...indicatorIds.map((id) => String(pt[id]).replace('.', ','))
  ]);

  const csvContent =
    '\uFEFF' + // UTF-8 BOM pro správnou češtinu v MS Excel
    [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}_${series[0]?.date ?? 'start'}_${series[series.length - 1]?.date ?? 'end'}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
