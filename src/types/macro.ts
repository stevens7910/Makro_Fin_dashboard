export type IndicatorId =
  | 'cnb_repo_2w'
  | 'pribor_1m'
  | 'pribor_3m'
  | 'pribor_12m'
  | 'irs_3y'
  | 'irs_5y'
  | 'cpi_yoy'
  | 'unemployment'
  | 'gdp_yoy'
  | 'gdp_qoq'
  | 'fx_eur'
  | 'fx_usd';

export type IndicatorCategory = 'rates' | 'macro' | 'fx';

export type TimeRangeKey = '1Y' | '3Y' | '5Y' | 'ALL';

export type ActiveTab = 'overview' | 'rates' | 'macro' | 'fx' | 'architecture';

export interface MacroDataPoint {
  date: string;         // YYYY-MM (např. "2026-11")
  validDate: string;    // YYYY-MM-DD (např. "2026-11-30")
  quarter: string;      // např. "4Q 2026"
  cnb_repo_2w: number | null;
  pribor_1m: number | null;
  pribor_3m: number | null;
  pribor_12m: number | null;
  irs_3y: number | null;
  irs_5y: number | null;
  cpi_yoy: number | null;
  unemployment: number | null;
  gdp_yoy: number | null;
  gdp_qoq: number | null;
  fx_eur: number | null;
  fx_usd: number | null;
}

export interface IndicatorDefinition {
  id: IndicatorId;
  name: string;
  shortName: string;
  category: IndicatorCategory;
  unit: string;
  changeUnit: 'pb' | 'pct'; // pb = procentní body (pro sazby, inflaci, HDP, nezam.), pct = % změna (pro kurzy)
  decimals: number;
  color: string;
  sourceName: string;
  sourceCode: string;
  frequency: 'Denní / Měsíční' | 'Měsíční' | 'Čtvrtletní';
  description: string;
  apiEndpointInfo: string;
}

export interface KpiSummary {
  id: IndicatorId;
  definition: IndicatorDefinition;
  available: boolean;
  currentValue: number;
  validDate: string;
  periodLabel: string;
  momChange: number;        // Meziměsíční (nebo mezičtvrtletní u HDP) změna
  momChangeLabel: string;   // "MoM" nebo "QoQ"
  yoyChange: number;        // Meziroční změna (oproti stejnému měsíci před 12 měsíci)
  secondaryMetric?: {
    label: string;
    value: number;
    unit: string;
  };
  sparkline: { date: string; value: number }[];
  min12m: number;
  max12m: number;
}

export interface MacroDatasetPayload {
  schemaVersion: string;
  lastUpdated: string;
  generator: string;
  latest?: Record<string, { period: string; obsDate: string | null; quarter: string | null } | null>;
  sources: Record<string, {
    name: string;
    [key: string]: string | null;
  }>;
  series: MacroDataPoint[];
}

export interface CacheDiagnostics {
  memoryHits: number;
  localStorageHit: boolean;
  serviceWorkerActive: boolean;
  serviceWorkerVersion: string;
  lastFetchTimestamp: string;
  dataSourceUsed: 'memory-l1' | 'localstorage-l2' | 'network-json-l3' | 'live-api-enriched';
  recordCount: number;
  payloadSizeKb: number;
  liveCnbStatus: 'idle' | 'ok' | 'fallback';
}

