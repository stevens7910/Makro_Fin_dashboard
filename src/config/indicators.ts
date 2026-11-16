import { IndicatorDefinition, IndicatorId, TimeRangeKey } from '../types/macro';

export const TIME_RANGE_OPTIONS: {
  key: TimeRangeKey;
  label: string;
  shortLabel: string;
  months: number | null;
  description: string;
}[] = [
  {
    key: '1Y',
    label: '1R (Posledních 12M)',
    shortLabel: '1R',
    months: 12,
    description: 'Posledních 12 měsíců (výchozí pohled)'
  },
  {
    key: '3Y',
    label: '3R (3 roky)',
    shortLabel: '3R',
    months: 36,
    description: 'Posledních 36 měsíců'
  },
  {
    key: '5Y',
    label: '5R (5 let)',
    shortLabel: '5R',
    months: 60,
    description: 'Posledních 60 měsíců'
  },
  {
    key: 'ALL',
    label: 'Od 2015',
    shortLabel: 'Od 2015',
    months: null,
    description: 'Kompletní historie od ledna 2015 do současnosti'
  }
];

export const INDICATORS: Record<IndicatorId, IndicatorDefinition> = {
  cnb_repo_2w: {
    id: 'cnb_repo_2w',
    name: '2W Repo sazba (ČNB)',
    shortName: '2W Repo ČNB',
    category: 'rates',
    unit: '%',
    changeUnit: 'pb',
    decimals: 2,
    color: '#3b82f6',
    sourceName: 'ČNB',
    sourceCode: 'ČNB: historie 2T repo',
    frequency: 'Denní / Měsíční',
    description: 'Základní měnověpolitická úroková sazba České národní banky pro dvoutýdenní repo operace.',
    apiEndpointInfo: 'https://www.cnb.cz/cs/casto-kladene-dotazy/Jak-se-vyvijela-dvoutydenni-repo-sazba-CNB/'
  },
  pribor_1m: {
    id: 'pribor_1m',
    name: 'PRIBOR 1M',
    shortName: 'PRIBOR 1M',
    category: 'rates',
    unit: '%',
    changeUnit: 'pb',
    decimals: 2,
    color: '#38bdf8',
    sourceName: 'ČNB',
    sourceCode: 'PRIBOR_1M',
    frequency: 'Denní / Měsíční',
    description: 'Pražská mezibankovní nabídková sazba s jednoměsíční splatností (Prague InterBank Offered Rate).',
    apiEndpointInfo: 'https://www.cnb.cz/cs/financni-trhy/penezni-trh/pribor/fixing-urokovych-sazeb-na-mezibankovnim-trhu-depozit-pribor/'
  },
  pribor_3m: {
    id: 'pribor_3m',
    name: 'PRIBOR 3M',
    shortName: 'PRIBOR 3M',
    category: 'rates',
    unit: '%',
    changeUnit: 'pb',
    decimals: 2,
    color: '#6366f1',
    sourceName: 'ČNB',
    sourceCode: 'PRIBOR_3M',
    frequency: 'Denní / Měsíční',
    description: 'Klíčová referenční 3měsíční sazba mezibankovního trhu, hlavní benchmark pro korporátní úvěry a swapy.',
    apiEndpointInfo: 'https://www.cnb.cz/cs/financni-trhy/penezni-trh/pribor/fixing-urokovych-sazeb-na-mezibankovnim-trhu-depozit-pribor/'
  },
  pribor_12m: {
    id: 'pribor_12m',
    name: 'PRIBOR 12M',
    shortName: 'PRIBOR 12M',
    category: 'rates',
    unit: '%',
    changeUnit: 'pb',
    decimals: 2,
    color: '#a855f7',
    sourceName: 'ČNB',
    sourceCode: 'PRIBOR_12M',
    frequency: 'Denní / Měsíční',
    description: 'Roční sazba pražského mezibankovního trhu odrážející očekávání měnové politiky ČNB v horizontu 1 roku.',
    apiEndpointInfo: 'https://www.cnb.cz/cs/financni-trhy/penezni-trh/pribor/fixing-urokovych-sazeb-na-mezibankovnim-trhu-depozit-pribor/'
  },
  irs_3y: {
    id: 'irs_3y',
    name: 'Úrokový swap IRS 3Y',
    shortName: 'CZK IRS 3Y',
    category: 'rates',
    unit: '%',
    changeUnit: 'pb',
    decimals: 2,
    color: '#f59e0b',
    sourceName: 'Bez veřejného zdroje',
    sourceCode: 'CZK_IRS_3Y',
    frequency: 'Denní / Měsíční',
    description: 'Tříletý korunový úrokový swap (Interest Rate Swap) – klíčový indikátor ceny střednědobých zdrojů a hypoték.',
    apiEndpointInfo: 'data/irs_manual.csv -> npm run update-data'
  },
  irs_5y: {
    id: 'irs_5y',
    name: 'Úrokový swap IRS 5Y',
    shortName: 'CZK IRS 5Y',
    category: 'rates',
    unit: '%',
    changeUnit: 'pb',
    decimals: 2,
    color: '#ec4899',
    sourceName: 'Bez veřejného zdroje',
    sourceCode: 'CZK_IRS_5Y',
    frequency: 'Denní / Měsíční',
    description: 'Pětiletý korunový úrokový swap – hlavní benchmark pro 5leté fixace hypotečních úvěrů v ČR.',
    apiEndpointInfo: 'data/irs_manual.csv -> npm run update-data'
  },
  cpi_yoy: {
    id: 'cpi_yoy',
    name: 'Inflace (CPI meziroční)',
    shortName: 'Inflace CPI (YoY)',
    category: 'macro',
    unit: '%',
    changeUnit: 'pb',
    decimals: 1,
    color: '#ef4444',
    sourceName: 'ČSÚ DataStat',
    sourceCode: 'ČSÚ DataStat: WCEN01',
    frequency: 'Měsíční',
    description: 'Meziroční přírůstek indexu spotřebitelských cen (CPI) v ČR. Inflační cíl ČNB činí 2,0 % (±1 p.b.).',
    apiEndpointInfo: 'https://data.csu.gov.cz/api/dotaz/v1/data/sady/WCEN01?format=CSV'
  },
  unemployment: {
    id: 'unemployment',
    name: 'Míra nezaměstnanosti v ČR',
    shortName: 'Nezaměstnanost',
    category: 'macro',
    unit: '%',
    changeUnit: 'pb',
    decimals: 1,
    color: '#06b6d4',
    sourceName: 'Eurostat (ILO)',
    sourceCode: 'Eurostat: une_rt_m',
    frequency: 'Měsíční',
    description: 'Obecná míra nezaměstnanosti (ILO metodika, věková skupina 15–74 let, sezónně očištěno; zdroj Eurostat).',
    apiEndpointInfo: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/une_rt_m'
  },
  gdp_yoy: {
    id: 'gdp_yoy',
    name: 'Růst HDP (meziroční YoY)',
    shortName: 'HDP (YoY)',
    category: 'macro',
    unit: '%',
    changeUnit: 'pb',
    decimals: 1,
    color: '#10b981',
    sourceName: 'Eurostat (ČSÚ)',
    sourceCode: 'Eurostat: namq_10_gdp (YoY)',
    frequency: 'Čtvrtletní',
    description: 'Reálný meziroční růst hrubého domácího produktu České republiky očištěný o cenové a sezónní vlivy.',
    apiEndpointInfo: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/namq_10_gdp'
  },
  gdp_qoq: {
    id: 'gdp_qoq',
    name: 'Růst HDP (mezičtvrtletní QoQ)',
    shortName: 'HDP (QoQ)',
    category: 'macro',
    unit: '%',
    changeUnit: 'pb',
    decimals: 1,
    color: '#84cc16',
    sourceName: 'Eurostat (ČSÚ)',
    sourceCode: 'Eurostat: namq_10_gdp (QoQ)',
    frequency: 'Čtvrtletní',
    description: 'Mezičtvrtletní změna reálného HDP ČR (srovnání s předchozím čtvrtletím, sezónně očištěno).',
    apiEndpointInfo: 'https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/namq_10_gdp'
  },
  fx_eur: {
    id: 'fx_eur',
    name: 'Kurz CZK / EUR',
    shortName: 'CZK / EUR',
    category: 'fx',
    unit: 'Kč',
    changeUnit: 'pct',
    decimals: 2,
    color: '#2563eb',
    sourceName: 'ČNB Kurzy',
    sourceCode: 'CNB: EUR',
    frequency: 'Denní / Měsíční',
    description: 'Devizový kurz české koruny vůči euru vyhlašovaný Českou národní bankou.',
    apiEndpointInfo: 'https://api.cnb.cz/cnbapi/exrates/daily-year'
  },
  fx_usd: {
    id: 'fx_usd',
    name: 'Kurz CZK / USD',
    shortName: 'CZK / USD',
    category: 'fx',
    unit: 'Kč',
    changeUnit: 'pct',
    decimals: 2,
    color: '#14b8a6',
    sourceName: 'ČNB Kurzy',
    sourceCode: 'CNB: USD',
    frequency: 'Denní / Měsíční',
    description: 'Devizový kurz české koruny vůči americkému dolaru vyhlašovaný Českou národní bankou.',
    apiEndpointInfo: 'https://api.cnb.cz/cnbapi/exrates/daily-year'
  }
};

export const INDICATOR_LIST: IndicatorDefinition[] = Object.values(INDICATORS);

export const RATE_INDICATOR_IDS: IndicatorId[] = [
  'cnb_repo_2w',
  'pribor_1m',
  'pribor_3m',
  'pribor_12m'
];

export const MACRO_INDICATOR_IDS: IndicatorId[] = [
  'cpi_yoy',
  'unemployment',
  'gdp_yoy',
  'gdp_qoq'
];

export const FX_INDICATOR_IDS: IndicatorId[] = [
  'fx_eur',
  'fx_usd'
];

