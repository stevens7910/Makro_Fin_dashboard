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
    sourceName: 'ČNB ARAD',
    sourceCode: 'ARAD: SF0101',
    frequency: 'Denní / Měsíční',
    description: 'Základní měnověpolitická úroková sazba České národní banky pro dvoutýdenní repo operace.',
    apiEndpointInfo: 'https://www.cnb.cz/arad/#/cs/indicators/cnb_repo_2w'
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
    sourceName: 'ČNB / CFBF',
    sourceCode: 'PRIBOR_1M',
    frequency: 'Denní / Měsíční',
    description: 'Pražská mezibankovní nabídková sazba s jednoměsíční splatností (Prague InterBank Offered Rate).',
    apiEndpointInfo: 'https://www.cnb.cz/cs/financni-trhy/penezni-trh/pribor/denni.txt'
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
    sourceName: 'ČNB / CFBF',
    sourceCode: 'PRIBOR_3M',
    frequency: 'Denní / Měsíční',
    description: 'Klíčová referenční 3měsíční sazba mezibankovního trhu, hlavní benchmark pro korporátní úvěry a swapy.',
    apiEndpointInfo: 'https://www.cnb.cz/cs/financni-trhy/penezni-trh/pribor/denni.txt'
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
    sourceName: 'ČNB / CFBF',
    sourceCode: 'PRIBOR_12M',
    frequency: 'Denní / Měsíční',
    description: 'Roční sazba pražského mezibankovního trhu odrážející očekávání měnové politiky ČNB v horizontu 1 roku.',
    apiEndpointInfo: 'https://www.cnb.cz/cs/financni-trhy/penezni-trh/pribor/denni.txt'
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
    sourceName: 'Mezibankovní trh / Scraper',
    sourceCode: 'CZK_IRS_3Y',
    frequency: 'Denní / Měsíční',
    description: 'Tříletý korunový úrokový swap (Interest Rate Swap) – klíčový indikátor ceny střednědobých zdrojů a hypoték.',
    apiEndpointInfo: 'scripts/scraper_cz_macro.py -> macro-data.json'
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
    sourceName: 'Mezibankovní trh / Scraper',
    sourceCode: 'CZK_IRS_5Y',
    frequency: 'Denní / Měsíční',
    description: 'Pětiletý korunový úrokový swap – hlavní benchmark pro 5leté fixace hypotečních úvěrů v ČR.',
    apiEndpointInfo: 'scripts/scraper_cz_macro.py -> macro-data.json'
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
    sourceCode: 'ČSÚ: 010022',
    frequency: 'Měsíční',
    description: 'Meziroční přírůstek indexu spotřebitelských cen (CPI) v ČR. Inflační cíl ČNB činí 2,0 % (±1 p.b.).',
    apiEndpointInfo: 'https://vdb.czso.cz/pll/eweb/jsonstat?id=010022'
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
    sourceName: 'ČSÚ DataStat',
    sourceCode: 'ČSÚ: 250180',
    frequency: 'Měsíční',
    description: 'Obecná míra nezaměstnanosti (VŠPS / ILO metodika, věková skupina 15–64 let, sezónně očištěno).',
    apiEndpointInfo: 'https://vdb.czso.cz/pll/eweb/jsonstat?id=250180'
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
    sourceName: 'ČSÚ DataStat',
    sourceCode: 'ČSÚ: 050012 (YoY)',
    frequency: 'Čtvrtletní',
    description: 'Reálný meziroční růst hrubého domácího produktu České republiky očištěný o cenové a sezónní vlivy.',
    apiEndpointInfo: 'https://vdb.czso.cz/pll/eweb/jsonstat?id=050012'
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
    sourceName: 'ČSÚ DataStat',
    sourceCode: 'ČSÚ: 050012 (QoQ)',
    frequency: 'Čtvrtletní',
    description: 'Mezičtvrtletní změna reálného HDP ČR (srovnání s předchozím čtvrtletím, sezónně očištěno).',
    apiEndpointInfo: 'https://vdb.czso.cz/pll/eweb/jsonstat?id=050012'
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
    apiEndpointInfo: 'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt'
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
    apiEndpointInfo: 'https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt'
  }
};

export const INDICATOR_LIST: IndicatorDefinition[] = Object.values(INDICATORS);

export const RATE_INDICATOR_IDS: IndicatorId[] = [
  'cnb_repo_2w',
  'pribor_1m',
  'pribor_3m',
  'pribor_12m',
  'irs_3y',
  'irs_5y'
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
