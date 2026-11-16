import React, { useMemo, useState } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { INDICATORS, MACRO_INDICATOR_IDS } from '../config/indicators';
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

interface MacroTabProps {
  series: MacroDataPoint[];
  focusedIndicator: IndicatorId | null;
}

export const MacroTab: React.FC<MacroTabProps> = ({ series }) => {
  // Výchozí zobrazení posledních 12 měsíců ('1Y' -> tlačítko 1R)
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('1Y');

  const filteredSeries = useMemo(
    () => filterSeriesByRange(series, selectedRange),
    [series, selectedRange]
  );

  const periodSpanText = useMemo(() => {
    if (filteredSeries.length === 0) return '';
    return `${formatMonthYearCz(filteredSeries[0].date)} – ${formatMonthYearCz(
      filteredSeries[filteredSeries.length - 1].date
    )} (${filteredSeries.length} měs.)`;
  }, [filteredSeries]);

  const macroStats = useMemo(() => {
    if (filteredSeries.length === 0) return [];
    const first = filteredSeries[0];
    const last = filteredSeries[filteredSeries.length - 1];

    return MACRO_INDICATOR_IDS.map((id) => {
      const def = INDICATORS[id];
      const vals = filteredSeries.map((p) => p[id]);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const delta = last[id] - first[id];

      return {
        id,
        def,
        current: last[id],
        min,
        max,
        avg: Number(avg.toFixed(1)),
        delta: Number(delta.toFixed(1))
      };
    });
  }, [filteredSeries]);

  return (
    <div className="tab-view macro-tab">
      {/* Společný toolbar časové osy pro Makro sekci */}
      <div className="chart-panel">
        <div className="chart-panel-header">
          <div>
            <span className="panel-eyebrow">Reálná ekonomika &amp; Cenová stabilita (ČSÚ DataStat)</span>
            <h2>Inflace (CPI meziročně), Míra nezaměstnanosti a Růst HDP České republiky</h2>
            <p className="panel-subtitle">
              Detailní pohled na cenovou hladinu vůči 2% cíli ČNB, kondici trhu práce a meziroční / mezičtvrtletní dynamiku HDP
            </p>
          </div>
        </div>

        <TimeRangeSelector
          selectedRange={selectedRange}
          onChangeRange={setSelectedRange}
          periodInfoLabel={periodSpanText}
          onExportCsv={() =>
            exportSeriesToCsv(filteredSeries, MACRO_INDICATOR_IDS, 'cz_makro_inflace_hdp_nezamestnanost')
          }
        />

        {/* Graf 1: Inflace CPI a Míra nezaměstnanosti */}
        <div className="subpanel-title-row">
          <h3>1. Spotřebitelská inflace (CPI YoY %) a Míra nezaměstnanosti v ČR (%)</h3>
          <span className="target-band-pill">Toleranční pásmo ČNB: 1,0 % – 3,0 % (Cíl 2,0 %)</span>
        </div>

        <div className="chart-canvas-wrap">
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={filteredSeries} margin={{ top: 12, right: 20, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="macroCpiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.28} />
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
                tickFormatter={(v) => `${formatNumberCz(v, 1)} %`}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />

              {/* Toleranční pásmo ČNB 1 % až 3 % */}
              <ReferenceArea
                y1={1.0}
                y2={3.0}
                fill="#10b981"
                fillOpacity={0.08}
              />
              <ReferenceLine
                y={2.0}
                stroke="#10b981"
                strokeDasharray="4 4"
                label={{
                  value: 'Inflační cíl ČNB 2,0 %',
                  position: 'insideTopRight',
                  fill: '#10b981',
                  fontSize: 11
                }}
              />

              <Area
                type="monotone"
                dataKey="cpi_yoy"
                name={INDICATORS.cpi_yoy.name}
                stroke={INDICATORS.cpi_yoy.color}
                fill="url(#macroCpiGrad)"
                strokeWidth={2.6}
              />
              <Line
                type="monotone"
                dataKey="unemployment"
                name={INDICATORS.unemployment.name}
                stroke={INDICATORS.unemployment.color}
                strokeWidth={2.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Druhý řádek: Dynamika HDP (YoY a QoQ) + Souhrnná tabulka */}
      <div className="two-col-detail-grid">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <span className="panel-eyebrow">Národní účty ČSÚ (Sezónně očištěno)</span>
              <h3>Růst HDP ČR: Meziroční (YoY %) a Mezičtvrtletní (QoQ %)</h3>
              <p className="panel-subtitle">
                Kombinace sloupcového grafu mezičtvrtletní dynamiky (QoQ) a křivky meziročního tempa růstu (YoY)
              </p>
            </div>
          </div>

          <div className="chart-canvas-wrap">
            <ResponsiveContainer width="100%" height={310}>
              <ComposedChart data={filteredSeries} margin={{ top: 12, right: 18, left: 0, bottom: 5 }}>
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
                  tickFormatter={(v) => `${formatNumberCz(v, 1)} %`}
                />
                <Tooltip content={<CustomChartTooltip />} />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                <ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={1.5} />

                <Bar
                  dataKey="gdp_qoq"
                  name={INDICATORS.gdp_qoq.name}
                  fill={INDICATORS.gdp_qoq.color}
                  radius={[4, 4, 0, 0]}
                  opacity={0.75}
                />
                <Line
                  type="monotone"
                  dataKey="gdp_yoy"
                  name={INDICATORS.gdp_yoy.name}
                  stroke={INDICATORS.gdp_yoy.color}
                  strokeWidth={2.8}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <span className="panel-eyebrow">Statistický souhrn ({selectedRange === 'ALL' ? 'Od 2015' : selectedRange})</span>
              <h3>Makroekonomické indikátory za zvolené období</h3>
              <p className="panel-subtitle">
                Přehled minim, maxim, průměrů a změny mezi začátkem a koncem vybraného období
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
                {macroStats.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <div className="table-ind-cell">
                        <span className="table-dot" style={{ backgroundColor: st.def.color }} />
                        <div>
                          <strong>{st.def.shortName}</strong>
                          <span className="table-subcode">{st.def.sourceCode} ({st.def.frequency})</span>
                        </div>
                      </div>
                    </td>
                    <td className="num-col strong-num">{formatNumberCz(st.current, 1)} %</td>
                    <td className="num-col">{formatNumberCz(st.avg, 1)} %</td>
                    <td className="num-col">{formatNumberCz(st.min, 1)} %</td>
                    <td className="num-col">{formatNumberCz(st.max, 1)} %</td>
                    <td className="num-col">
                      <span
                        className={`change-badge ${
                          st.delta > 0.01
                            ? 'change-positive'
                            : st.delta < -0.01
                            ? 'change-negative'
                            : 'change-neutral'
                        }`}
                      >
                        {formatSignedChangeCz(st.delta, 'pb', 1)}
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
