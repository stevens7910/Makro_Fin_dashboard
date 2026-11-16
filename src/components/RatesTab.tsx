import React, { useEffect, useMemo, useState } from 'react';
import { Check, Layers, SlidersHorizontal, TrendingUp } from 'lucide-react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { INDICATORS, RATE_INDICATOR_IDS } from '../config/indicators';
import {
  exportSeriesToCsv,
  filterSeriesByRange,
  formatMonthYearCz,
  formatMonthYearShortCz,
  formatNumberCz,
  formatSignedChangeCz
} from '../services/dataService';
import { IndicatorId, MacroDataPoint, TimeRangeKey } from '../types/macro';
import { CustomChartTooltip } from './CustomChartTooltip';
import { TimeRangeSelector } from './TimeRangeSelector';

interface RatesTabProps {
  series: MacroDataPoint[];
  focusedIndicator: IndicatorId | null;
}

export const RatesTab: React.FC<RatesTabProps> = ({ series, focusedIndicator }) => {
  // Výchozí zobrazení posledních 12 měsíců ('1Y' -> tlačítko 1R)
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('1Y');
  const [visibleSeries, setVisibleSeries] = useState<Record<IndicatorId, boolean>>({
    cnb_repo_2w: true,
    pribor_1m: true,
    pribor_3m: true,
    pribor_12m: true,
    irs_3y: true,
    irs_5y: true,
    cpi_yoy: false,
    unemployment: false,
    gdp_yoy: false,
    gdp_qoq: false,
    fx_eur: false,
    fx_usd: false
  });

  // Pokud uživatel proklikl z konkrétní KPI karty sazeb, ujistíme se, že je daná řada zapnutá
  useEffect(() => {
    if (focusedIndicator && RATE_INDICATOR_IDS.includes(focusedIndicator)) {
      setVisibleSeries((prev) => ({
        ...prev,
        [focusedIndicator]: true
      }));
    }
  }, [focusedIndicator]);

  const filteredSeries = useMemo(
    () => filterSeriesByRange(series, selectedRange),
    [series, selectedRange]
  );

  // Obohacená řada o spread IRS 5Y - PRIBOR 3M (v bazických bodech bps)
  const spreadSeries = useMemo(() => {
    return filteredSeries.map((pt) => ({
      ...pt,
      spread_irs5y_pribor3m: Number(((pt.irs_5y - pt.pribor_3m) * 100).toFixed(0)),
      spread_pribor3m_repo: Number(((pt.pribor_3m - pt.cnb_repo_2w) * 100).toFixed(0))
    }));
  }, [filteredSeries]);

  // Výpočet statistik za zvolené období (Min, Max, Průměr, Změna za období)
  const periodStats = useMemo(() => {
    if (filteredSeries.length === 0) return [];
    const first = filteredSeries[0];
    const last = filteredSeries[filteredSeries.length - 1];

    return RATE_INDICATOR_IDS.map((id) => {
      const def = INDICATORS[id];
      const vals = filteredSeries.map((p) => p[id]);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const periodDelta = last[id] - first[id];

      return {
        id,
        def,
        current: last[id],
        min,
        max,
        avg: Number(avg.toFixed(2)),
        periodDelta: Number(periodDelta.toFixed(2))
      };
    });
  }, [filteredSeries]);

  const toggleSeries = (id: IndicatorId) => {
    setVisibleSeries((prev) => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const periodSpanText = useMemo(() => {
    if (filteredSeries.length === 0) return '';
    return `${formatMonthYearCz(filteredSeries[0].date)} – ${formatMonthYearCz(
      filteredSeries[filteredSeries.length - 1].date
    )} (${filteredSeries.length} měs.)`;
  }, [filteredSeries]);

  return (
    <div className="tab-view rates-tab">
      <div className="chart-panel">
        <div className="chart-panel-header">
          <div>
            <span className="panel-eyebrow">Peněžní trh a korunové deriváty</span>
            <h2>Vývoj úrokových sazeb ČNB (2W Repo), PRIBOR (1M, 3M, 12M) a úrokových swapů (IRS 3Y, 5Y)</h2>
            <p className="panel-subtitle">
              Porovnání měnověpolitické sazby ČNB s mezibankovními sazbami PRIBOR a střednědobými korunovými swapy IRS
            </p>
          </div>
        </div>

        <TimeRangeSelector
          selectedRange={selectedRange}
          onChangeRange={setSelectedRange}
          periodInfoLabel={periodSpanText}
          onExportCsv={() =>
            exportSeriesToCsv(filteredSeries, RATE_INDICATOR_IDS, 'cz_urokove_sazby_pribor_irs')
          }
        />

        {/* Přepínače jednotlivých řad */}
        <div className="series-toggle-bar" role="group" aria-label="Výběr zobrazených úrokových sazeb">
          <span className="series-toggle-caption">
            <SlidersHorizontal size={14} />
            <span>Zobrazené řady:</span>
          </span>
          {RATE_INDICATOR_IDS.map((id) => {
            const def = INDICATORS[id];
            const isOn = visibleSeries[id];
            const isFocused = focusedIndicator === id;
            return (
              <button
                key={id}
                type="button"
                className={`series-chip ${isOn ? 'active' : 'muted'} ${isFocused ? 'focused-chip' : ''}`}
                style={{
                  borderColor: isOn ? def.color : undefined
                }}
                onClick={() => toggleSeries(id)}
              >
                <span
                  className="chip-color-dot"
                  style={{ backgroundColor: def.color }}
                >
                  {isOn && <Check size={10} color="#fff" />}
                </span>
                <span>{def.shortName}</span>
              </button>
            );
          })}
        </div>

        {/* Hlavní interaktivní graf sazeb */}
        <div className="chart-canvas-wrap">
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={filteredSeries} margin={{ top: 14, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis
                dataKey="date"
                tickFormatter={formatMonthYearShortCz}
                stroke="var(--text-muted)"
                fontSize={12}
                minTickGap={24}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={12}
                domain={['auto', 'auto']}
                tickFormatter={(v) => `${formatNumberCz(v, 2)} %`}
              />
              <Tooltip
                content={
                  <CustomChartTooltip
                    extraNotes={(pt) => (
                      <div className="tooltip-spread-summary">
                        <span>Spread IRS 5Y − PRIBOR 3M:</span>
                        <strong>
                          {formatNumberCz((pt.irs_5y - pt.pribor_3m) * 100, 0)} bps
                        </strong>
                      </div>
                    )}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />

              {visibleSeries.cnb_repo_2w && (
                <Line
                  type="stepAfter"
                  dataKey="cnb_repo_2w"
                  name={INDICATORS.cnb_repo_2w.name}
                  stroke={INDICATORS.cnb_repo_2w.color}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}
              {visibleSeries.pribor_1m && (
                <Line
                  type="monotone"
                  dataKey="pribor_1m"
                  name={INDICATORS.pribor_1m.name}
                  stroke={INDICATORS.pribor_1m.color}
                  strokeWidth={2}
                  dot={false}
                />
              )}
              {visibleSeries.pribor_3m && (
                <Line
                  type="monotone"
                  dataKey="pribor_3m"
                  name={INDICATORS.pribor_3m.name}
                  stroke={INDICATORS.pribor_3m.color}
                  strokeWidth={2.4}
                  dot={false}
                />
              )}
              {visibleSeries.pribor_12m && (
                <Line
                  type="monotone"
                  dataKey="pribor_12m"
                  name={INDICATORS.pribor_12m.name}
                  stroke={INDICATORS.pribor_12m.color}
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  dot={false}
                />
              )}
              {visibleSeries.irs_3y && (
                <Line
                  type="monotone"
                  dataKey="irs_3y"
                  name={INDICATORS.irs_3y.name}
                  stroke={INDICATORS.irs_3y.color}
                  strokeWidth={2.2}
                  dot={false}
                />
              )}
              {visibleSeries.irs_5y && (
                <Line
                  type="monotone"
                  dataKey="irs_5y"
                  name={INDICATORS.irs_5y.name}
                  stroke={INDICATORS.irs_5y.color}
                  strokeWidth={2.4}
                  dot={false}
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Druhý analytický panel: Spready a statistická tabulka za vybrané období */}
      <div className="two-col-detail-grid">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <span className="panel-eyebrow">Tržní očekávání &amp; Prémie</span>
              <h3>Spread výnosové křivky (IRS 5Y − PRIBOR 3M v bazických bodech)</h3>
              <p className="panel-subtitle">
                Záporné hodnoty indikují inverzní výnosovou křivku (trh očekává budoucí pokles sazeb ČNB)
              </p>
            </div>
          </div>

          <div className="chart-canvas-wrap">
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={spreadSeries} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
                <defs>
                  <linearGradient id="spreadGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ec4899" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#ec4899" stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatMonthYearShortCz}
                  stroke="var(--text-muted)"
                  fontSize={12}
                  minTickGap={24}
                />
                <YAxis
                  stroke="var(--text-muted)"
                  fontSize={12}
                  tickFormatter={(v) => `${v} bps`}
                />
                <Tooltip
                  labelFormatter={(l) => formatMonthYearCz(String(l))}
                  formatter={(val: number, name: string) => [`${val > 0 ? '+' : ''}${val} bps`, name]}
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '10px'
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="3 3" />
                <Area
                  type="monotone"
                  dataKey="spread_irs5y_pribor3m"
                  name="Spread IRS 5Y − PRIBOR 3M"
                  stroke="#ec4899"
                  fill="url(#spreadGrad)"
                  strokeWidth={2.2}
                />
                <Line
                  type="monotone"
                  dataKey="spread_pribor3m_repo"
                  name="Prémie PRIBOR 3M − 2W Repo"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <span className="panel-eyebrow">Statistika zvoleného horizontu ({selectedRange === 'ALL' ? 'Od 2015' : selectedRange})</span>
              <h3>Souhrnná tabulka úrokových indikátorů</h3>
              <p className="panel-subtitle">
                Minimum, maximum, průměr a celková změna za vybrané období ({periodSpanText})
              </p>
            </div>
          </div>

          <div className="stats-table-wrapper">
            <table className="analytical-table">
              <thead>
                <tr>
                  <th>Indikátor</th>
                  <th>Aktuálně</th>
                  <th>Průměr</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Změna za období</th>
                </tr>
              </thead>
              <tbody>
                {periodStats.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <div className="table-ind-cell">
                        <span className="table-dot" style={{ backgroundColor: st.def.color }} />
                        <div>
                          <strong>{st.def.shortName}</strong>
                          <span className="table-subcode">{st.def.sourceCode}</span>
                        </div>
                      </div>
                    </td>
                    <td className="num-col strong-num">{formatNumberCz(st.current, 2)} %</td>
                    <td className="num-col">{formatNumberCz(st.avg, 2)} %</td>
                    <td className="num-col">{formatNumberCz(st.min, 2)} %</td>
                    <td className="num-col">{formatNumberCz(st.max, 2)} %</td>
                    <td className="num-col">
                      <span
                        className={`change-badge ${
                          st.periodDelta > 0.001
                            ? 'change-positive'
                            : st.periodDelta < -0.001
                            ? 'change-negative'
                            : 'change-neutral'
                        }`}
                      >
                        {formatSignedChangeCz(st.periodDelta, 'pb', 2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
