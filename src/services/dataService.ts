import {
  CacheDiagnostics,
  IndicatorId,
  KpiSummary,
  MacroDataPoint,
  MacroDatasetPayload,
  TimeRangeKey
} from '../types/macro';
import { INDICATORS, INDICATOR_LIST, TIME_RANGE_OPTIONS } from '../config/indicators';

const STORAGE_CACHE_KEY = 'cz_makrofin_dataset_cache_v2';
const STORAGE_META_KEY = 'cz_makrofin_dataset_meta_v2';
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

      // Stáhnout z ./data/macro-data.json (obsluhováno rovněž Service Workerem v offline režimu)
      const response = await fetch('./data/macro-data.json', {
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
 * Znovu načte dataset ze serveru (obchází L1/L2 i HTTP cache a čistí SW datovou cache).
 * Poznámka: Prohlížeč nemůže volat api.cnb.cz napřímo (API neposílá CORS hlavičky),
 * proto se čerstvá data z ČNB / ČSÚ / Eurostatu stahují skriptem `npm run update-data`
 * (v repozitáři běží automaticky každý den přes GitHub Actions) a aplikace je jen načte.
 */
export async function refreshData(): Promise<{
  success: boolean;
  changed: boolean;
  message: string;
}> {
  const before = memoryDataset?.lastUpdated ?? '';
  try {
    const fresh = await clearAllCachesAndReload();
    const changed = !!before && fresh.lastUpdated !== before;
    const stamp = new Date(fresh.lastUpdated).toLocaleString('cs-CZ');
    return {
      success: true,
      changed,
      message: changed
        ? `Nalezena novější data (stav k ${stamp}).`
        : `Data jsou aktuální – poslední aktualizace zdrojů ${stamp}. Server doplňuje nová data automaticky každý den.`
    };
  } catch (err) {
    return {
      success: false,
      changed: false,
      message: `Aktualizace selhala (${err instanceof Error ? err.message : 'neznámá chyba'}). Zobrazena jsou data z lokální cache.`
    };
  }
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

export function latestIndex(series: MacroDataPoint[], id: IndicatorId): number {
  for (let i = series.length - 1; i >= 0; i--) if (series[i][id] !== null) return i;
  return -1;
}

export function latestValue(series: MacroDataPoint[], id: IndicatorId): number | null {
  const i = latestIndex(series, id);
  return i < 0 ? null : (series[i][id] as number);
}

export interface SeriesStats {
  current: number;
  first: number;
  min: number;
  max: number;
  avg: number;
  delta: number;
  pctDelta: number;
  count: number;
}

/** Statistiky přes nenulové hodnoty (chybějící / nepublikované měsíce se ignorují). */
export function seriesStats(series: MacroDataPoint[], id: IndicatorId): SeriesStats | null {
  const vals = series.map((p) => p[id]).filter((v): v is number => v !== null);
  if (vals.length === 0) return null;
  const first = vals[0];
  const current = vals[vals.length - 1];
  return {
    current,
    first,
    min: Math.min(...vals),
    max: Math.max(...vals),
    avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    delta: current - first,
    pctDelta: first !== 0 ? ((current - first) / first) * 100 : 0,
    count: vals.length
  };
}

/**
 * Vypočítá přehledové KPI karty. Každý indikátor má vlastní "poslední známé pozorování"
 * (CPI a nezaměstnanost vycházejí se zpožděním, HDP čtvrtletně, IRS nemá veřejný zdroj).
 */
export function computeKpiSummaries(
  series: MacroDataPoint[],
  latestMeta?: MacroDatasetPayload['latest']
): KpiSummary[] {
  if (!series || series.length === 0) return [];
  if (kpiSummaryMemo) return kpiSummaryMemo;

  const summaries: KpiSummary[] = INDICATOR_LIST.map((def) => {
    const idx = latestIndex(series, def.id);
    if (idx < 0) {
      return {
        id: def.id,
        definition: def,
        available: false,
        currentValue: 0,
        validDate: '',
        periodLabel: 'bez ověřeného zdroje',
        momChange: 0,
        momChangeLabel: 'MoM',
        yoyChange: 0,
        sparkline: [],
        min12m: 0,
        max12m: 0
      };
    }

    const point = series[idx];
    const currentVal = point[def.id] as number;
    const isQuarterly = def.frequency === 'Čtvrtletní';
    const prevIdx = isQuarterly ? idx - 3 : idx - 1;
    const refPrev = prevIdx >= 0 ? series[prevIdx][def.id] : null;
    const refYear = idx - 12 >= 0 ? series[idx - 12][def.id] : null;

    const delta = (ref: number | null): number => {
      if (ref === null) return 0;
      return def.changeUnit === 'pct' ? (ref !== 0 ? ((currentVal - ref) / ref) * 100 : 0) : currentVal - ref;
    };

    const window = series
      .slice(Math.max(0, idx - 11), idx + 1)
      .filter((pt) => pt[def.id] !== null);
    const sparkValues = window.map((pt) => pt[def.id] as number);

    let secondaryMetric: KpiSummary['secondaryMetric'] = undefined;
    if (def.id === 'gdp_yoy' && point.gdp_qoq !== null) {
      secondaryMetric = { label: 'Mezičtvrtletně (QoQ)', value: point.gdp_qoq, unit: '%' };
    } else if (def.id === 'cnb_repo_2w') {
      const cpi = latestValue(series, 'cpi_yoy');
      if (cpi !== null) {
        secondaryMetric = {
          label: 'Reálná sazba (vs poslední CPI)',
          value: Number((currentVal - cpi).toFixed(2)),
          unit: '%'
        };
      }
    }

    const meta = latestMeta?.[def.id];
    const [yy, mm] = point.date.split('-').map(Number);
    const fallbackDate = `${yy}-${String(mm).padStart(2, '0')}-${String(new Date(yy, mm, 0).getDate()).padStart(2, '0')}`;

    return {
      id: def.id,
      definition: def,
      available: true,
      currentValue: currentVal,
      validDate: meta?.obsDate ?? fallbackDate,
      periodLabel: isQuarterly ? point.quarter : formatMonthYearCz(point.date),
      momChange: Number(delta(refPrev).toFixed(2)),
      momChangeLabel: isQuarterly ? 'QoQ' : 'MoM',
      yoyChange: Number(delta(refYear).toFixed(2)),
      secondaryMetric,
      sparkline: window.map((pt) => ({ date: pt.date, value: pt[def.id] as number })),
      min12m: Math.min(...sparkValues),
      max12m: Math.max(...sparkValues)
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
    ...indicatorIds.map((id) => (pt[id] === null ? '' : String(pt[id]).replace('.', ',')))
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

