import React, { useMemo, useState } from 'react';
import {
  Activity,
  Compass,
  Filter,
  Search,
  ShieldCheck,
  TrendingUp
} from 'lucide-react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  latestIndex,
  latestValue,
  exportSeriesToCsv,
  filterSeriesByRange,
  formatMonthYearCz,
  formatMonthYearShortCz,
  formatNumberCz
} from '../services/dataService';
import {
  IndicatorCategory,
  IndicatorId,
  KpiSummary,
  MacroDataPoint,
  TimeRangeKey
} from '../types/macro';
import { CustomChartTooltip } from './CustomChartTooltip';
import { KpiCard } from './KpiCard';
import { TimeRangeSelector } from './TimeRangeSelector';

interface OverviewTabProps {
  summaries: KpiSummary[];
  series: MacroDataPoint[];
  onInspectIndicator: (indicatorId: IndicatorId) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  summaries,
  series,
  onInspectIndicator
}) => {
  const [categoryFilter, setCategoryFilter] = useState<'all' | IndicatorCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');
  // Výchozí zobrazení posledních 12 měsíců ('1Y' -> tlačítko 1R)
  const [quickRange, setQuickRange] = useState<TimeRangeKey>('1Y');

  // Poslední známá hodnota každého indikátoru (CPI/nezaměstnanost/HDP vycházejí se zpožděním)
  const lv = (id: IndicatorId) => latestValue(series, id) ?? 0;
  const lastRaw = series[series.length - 1];
  const latestPoint = {
    date: lastRaw.date,
    cnb_repo_2w: lv('cnb_repo_2w'),
    pribor_1m: lv('pribor_1m'),
    pribor_3m: lv('pribor_3m'),
    pribor_12m: lv('pribor_12m'),
    cpi_yoy: lv('cpi_yoy'),
    fx_eur: lv('fx_eur'),
    fx_usd: lv('fx_usd')
  };
  const cpiMeta = latestIndex(series, 'cpi_yoy');
  const cpiPeriod = cpiMeta >= 0 ? formatMonthYearCz(series[cpiMeta].date) : '';
  const yearAgoRaw = series[Math.max(0, series.length - 13)];
  const yearAgoPoint = {
    date: yearAgoRaw.date,
    cnb_repo_2w: yearAgoRaw.cnb_repo_2w ?? 0,
    pribor_1m: yearAgoRaw.pribor_1m ?? 0,
    pribor_3m: yearAgoRaw.pribor_3m ?? 0,
    pribor_12m: yearAgoRaw.pribor_12m ?? 0
  };

  // Odvozené makroekonomické metriky pro analytický kompas
  const realRepoRate = latestPoint ? Number((latestPoint.cnb_repo_2w - latestPoint.cpi_yoy).toFixed(2)) : 0;
  const yieldCurveSlope = Number((latestPoint.pribor_12m - latestPoint.pribor_3m).toFixed(2));
  const cpiTargetDiff = latestPoint ? Number((latestPoint.cpi_yoy - 2.0).toFixed(1)) : 0;
  const eurUsdImpl = latestPoint ? Number((latestPoint.fx_eur / latestPoint.fx_usd).toFixed(4)) : 0;

  const filteredSummaries = useMemo(() => {
    return summaries.filter((s) => {
      const matchesCat = categoryFilter === 'all' || s.definition.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        s.definition.name.toLowerCase().includes(q) ||
        s.definition.shortName.toLowerCase().includes(q) ||
        s.definition.sourceName.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [summaries, categoryFilter, searchQuery]);

  const quickChartSeries = useMemo(
    () => filterSeriesByRange(series, quickRange),
    [series, quickRange]
  );

  // Data pro okamžitý snímek výnosové křivky ČR (aktuální vs před 1 rokem)
  const yieldCurveSnapshot = useMemo(() => {
    if (!latestPoint || !yearAgoPoint) return [];
    return [
      { tenor: '2W Repo', current: latestPoint.cnb_repo_2w, yearAgo: yearAgoPoint.cnb_repo_2w },
      { tenor: 'PRIBOR 1M', current: latestPoint.pribor_1m, yearAgo: yearAgoPoint.pribor_1m },
      { tenor: 'PRIBOR 3M', current: latestPoint.pribor_3m, yearAgo: yearAgoPoint.pribor_3m },
      { tenor: 'PRIBOR 12M', current: latestPoint.pribor_12m, yearAgo: yearAgoPoint.pribor_12m }
    ];
  }, [latestPoint, yearAgoPoint]);

  const periodSpanText = useMemo(() => {
    if (quickChartSeries.length === 0) return '';
    const first = quickChartSeries[0].date;
    const last = quickChartSeries[quickChartSeries.length - 1].date;
    return `${formatMonthYearCz(first)} – ${formatMonthYearCz(last)}`;
  }, [quickChartSeries]);

  return (
    <div className="tab-view overview-tab">
      {/* Analytický makroekonomický kompas */}
      <section className="macro-compass-banner" aria-label="Makroekonomická syntéza ČR">
        <div className="compass-card">
          <div className="compass-icon-box compass-blue">
            <ShieldCheck size={18} />
          </div>
          <div className="compass-content">
            <span className="compass-label">Reálná 2W Repo sazba (Ex-post)</span>
            <div className="compass-val-row">
              <strong className={realRepoRate >= 0 ? 'text-positive' : 'text-negative'}>
                {realRepoRate > 0 ? '+' : ''}
                {formatNumberCz(realRepoRate, 2)} %
              </strong>
              <span className="compass-tag">
                {realRepoRate >= 0 ? 'Restriktivní / Kladné úročení' : 'Záporná reálná sazba'}
              </span>
            </div>
            <p className="compass-note">Rozdíl 2W Repo ČNB ({formatNumberCz(latestPoint.cnb_repo_2w, 2)} %) a inflace CPI ({formatNumberCz(latestPoint.cpi_yoy, 1)} %, {cpiPeriod})</p>
          </div>
        </div>

        <div className="compass-card">
          <div className="compass-icon-box compass-indigo">
            <TrendingUp size={18} />
          </div>
          <div className="compass-content">
            <span className="compass-label">Sklon křivky (PRIBOR 12M − 3M)</span>
            <div className="compass-val-row">
              <strong className={yieldCurveSlope >= 0 ? 'text-positive' : 'text-negative'}>
                {yieldCurveSlope > 0 ? '+' : ''}
                {formatNumberCz(yieldCurveSlope * 100, 0)} bps
              </strong>
              <span className="compass-tag">
                {yieldCurveSlope >= 0 ? 'Normální sklon' : 'Inverzní křivka'}
              </span>
            </div>
            <p className="compass-note">Spread 12M PRIBORu ({formatNumberCz(latestPoint.pribor_12m, 2)} %) vůči 3M PRIBORu ({formatNumberCz(latestPoint.pribor_3m, 2)} %)</p>
          </div>
        </div>

        <div className="compass-card">
          <div className="compass-icon-box compass-emerald">
            <Compass size={18} />
          </div>
          <div className="compass-content">
            <span className="compass-label">Odchylka CPI od 2% cíle ČNB</span>
            <div className="compass-val-row">
              <strong>
                {cpiTargetDiff > 0 ? '+' : ''}
                {formatNumberCz(cpiTargetDiff, 1)} p.b.
              </strong>
              <span className="compass-tag">
                {Math.abs(cpiTargetDiff) <= 1.0 ? 'V tolerančním pásmu 1–3 %' : 'Mimo toleranční pásmo'}
              </span>
            </div>
            <p className="compass-note">CPI {cpiPeriod}: {formatNumberCz(latestPoint.cpi_yoy, 1)} % vs. inflační cíl ČNB 2,0 %</p>
          </div>
        </div>

        <div className="compass-card">
          <div className="compass-icon-box compass-amber">
            <Activity size={18} />
          </div>
          <div className="compass-content">
            <span className="compass-label">Implikovaný kurz EUR / USD</span>
            <div className="compass-val-row">
              <strong>{formatNumberCz(eurUsdImpl, 4)} $</strong>
              <span className="compass-tag">Křížový kurz ČNB</span>
            </div>
            <p className="compass-note">Odvozeno z kurzů {formatNumberCz(latestPoint.fx_eur, 2)} CZK/EUR a {formatNumberCz(latestPoint.fx_usd, 2)} CZK/USD</p>
          </div>
        </div>
      </section>

      {/* Lišta filtrů pro KPI karty */}
      <section className="kpi-filter-bar" aria-label="Filtrování KPI indikátorů">
        <div className="filter-pills">
          <span className="filter-caption">
            <Filter size={14} />
            <span>Kategorie:</span>
          </span>
          <button
            type="button"
            className={`filter-pill ${categoryFilter === 'all' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('all')}
          >
            Všechny indikátory ({summaries.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${categoryFilter === 'rates' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('rates')}
          >
            Úrokové sazby &amp; Swapy (6)
          </button>
          <button
            type="button"
            className={`filter-pill ${categoryFilter === 'macro' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('macro')}
          >
            Inflace, HDP &amp; Trh práce (4)
          </button>
          <button
            type="button"
            className={`filter-pill ${categoryFilter === 'fx' ? 'active' : ''}`}
            onClick={() => setCategoryFilter('fx')}
          >
            Měnové kurzy CZK (2)
          </button>
        </div>

        <div className="search-input-wrap">
          <Search size={14} className="search-icon" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Hledat indikátor (např. PRIBOR, IRS, CPI, HDP)..."
            aria-label="Hledat indikátor"
          />
        </div>
      </section>

      {/* Hlavní Grid KPI Karet */}
      <section className="kpi-cards-grid" aria-label="Přehled klíčových makroekonomických indikátorů">
        {filteredSummaries.map((summary) => (
          <KpiCard
            key={summary.id}
            summary={summary}
            onInspect={onInspectIndicator}
          />
        ))}
      </section>

      {/* Dvojice srovnávacích analytických grafů přímo na přehledové stránce */}
      <section className="overview-charts-grid">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <span className="panel-eyebrow">Měnověpolitická syntéza</span>
              <h2>2W Repo sazba ČNB vs. Meziroční inflace (CPI) a PRIBOR 3M</h2>
              <p className="panel-subtitle">
                Srovnání základních úrokových sazeb a vývoje spotřebitelských cen v ČR (kliknutím na období změníte horizont)
              </p>
            </div>
          </div>

          <TimeRangeSelector
            selectedRange={quickRange}
            onChangeRange={setQuickRange}
            periodInfoLabel={periodSpanText}
            onExportCsv={() =>
              exportSeriesToCsv(
                quickChartSeries,
                ['cnb_repo_2w', 'pribor_3m', 'cpi_yoy', 'gdp_yoy'],
                'cz_makro_prehled'
              )
            }
          />

          <div className="chart-canvas-wrap">
            <ResponsiveContainer width="100%" height={330}>
              <ComposedChart data={quickChartSeries} margin={{ top: 12, right: 18, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="cpiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.26} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatMonthYearShortCz}
                  stroke="var(--text-muted)"
                  fontSize={12}
                  minTickGap={22}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickFormatter={(v) => `${v} %`}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <ReferenceLine
                  y={2.0}
                  stroke="#10b981"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Cíl ČNB 2,0 %',
                    position: 'insideTopRight',
                    fill: '#10b981',
                    fontSize: 11
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="cpi_yoy"
                  name="Inflace CPI (YoY)"
                  stroke="#ef4444"
                  fill="url(#cpiGrad)"
                  strokeWidth={2.2}
                />
                <Line
                  type="stepAfter"
                  dataKey="cnb_repo_2w"
                  name="2W Repo sazba (ČNB)"
                  stroke="#3b82f6"
                  strokeWidth={2.8}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="pribor_3m"
                  name="PRIBOR 3M"
                  stroke="#6366f1"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <span className="panel-eyebrow">Struktura úrokových sazeb</span>
              <h2>Tvar korunové výnosové křivky (Aktuální vs. před 1 rokem)</h2>
              <p className="panel-subtitle">
                Porovnání 2W repo sazby ČNB a PRIBOR 1M, 3M a 12M (CZK IRS nemá veřejný zdroj)
              </p>
            </div>
          </div>

          <div className="chart-canvas-wrap yield-curve-overview-wrap">
            <ResponsiveContainer width="100%" height={365}>
              <ComposedChart data={yieldCurveSnapshot} margin={{ top: 20, right: 18, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis dataKey="tenor" stroke="var(--text-muted)" fontSize={12} />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                  domain={['auto', 'auto']}
                  tickFormatter={(v) => `${formatNumberCz(v, 1)} %`}
                />
                <Tooltip
                  formatter={(val: number, name: string) => [`${formatNumberCz(val, 2)} %`, name]}
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '10px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <Bar
                  dataKey="yearAgo"
                  name={`Před 1 rokem (${formatMonthYearShortCz(yearAgoPoint.date)})`}
                  fill="#64748b"
                  opacity={0.45}
                  radius={[6, 6, 0, 0]}
                  barSize={28}
                />
                <Line
                  type="monotone"
                  dataKey="current"
                  name={`Aktuálně (${formatMonthYearShortCz(latestPoint.date)})`}
                  stroke="#38bdf8"
                  strokeWidth={3}
                  dot={{ r: 5, fill: '#38bdf8', strokeWidth: 2, stroke: '#0f172a' }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>
    </div>
  );
};


