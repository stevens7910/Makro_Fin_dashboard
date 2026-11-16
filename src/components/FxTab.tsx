import React, { useMemo, useState } from 'react';
import {
  Area,
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
import { FX_INDICATOR_IDS, INDICATORS } from '../config/indicators';
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

interface FxTabProps {
  series: MacroDataPoint[];
  focusedIndicator: IndicatorId | null;
}

export const FxTab: React.FC<FxTabProps> = ({ series }) => {
  // Výchozí zobrazení posledních 12 měsíců ('1Y' -> tlačítko 1R)
  const [selectedRange, setSelectedRange] = useState<TimeRangeKey>('1Y');

  const filteredSeries = useMemo(
    () => filterSeriesByRange(series, selectedRange),
    [series, selectedRange]
  );

  const enrichedFxSeries = useMemo(() => {
    return filteredSeries.map((pt) => ({
      ...pt,
      eur_usd_cross: Number((pt.fx_eur / pt.fx_usd).toFixed(4))
    }));
  }, [filteredSeries]);

  const fxStats = useMemo(() => {
    if (filteredSeries.length === 0) return [];
    const first = filteredSeries[0];
    const last = filteredSeries[filteredSeries.length - 1];

    return FX_INDICATOR_IDS.map((id) => {
      const def = INDICATORS[id];
      const vals = filteredSeries.map((p) => p[id]);
      const min = Math.min(...vals);
      const max = Math.max(...vals);
      const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
      const pctChange = first[id] !== 0 ? ((last[id] - first[id]) / first[id]) * 100 : 0;

      return {
        id,
        def,
        current: last[id],
        min,
        max,
        avg: Number(avg.toFixed(2)),
        pctChange: Number(pctChange.toFixed(2))
      };
    });
  }, [filteredSeries]);

  const periodSpanText = useMemo(() => {
    if (filteredSeries.length === 0) return '';
    return `${formatMonthYearCz(filteredSeries[0].date)} – ${formatMonthYearCz(
      filteredSeries[filteredSeries.length - 1].date
    )} (${filteredSeries.length} měs.)`;
  }, [filteredSeries]);

  return (
    <div className="tab-view fx-tab">
      <div className="chart-panel">
        <div className="chart-panel-header">
          <div>
            <span className="panel-eyebrow">Devizový trh ČNB</span>
            <h2>Vývoj měnových kurzů CZK / EUR a CZK / USD</h2>
            <p className="panel-subtitle">
              Oficiální kurzy devizového trhu České národní banky v Kč za 1 EUR a 1 USD (pokles křivky znamená posílení koruny)
            </p>
          </div>
        </div>

        <TimeRangeSelector
          selectedRange={selectedRange}
          onChangeRange={setSelectedRange}
          periodInfoLabel={periodSpanText}
          onExportCsv={() => exportSeriesToCsv(filteredSeries, FX_INDICATOR_IDS, 'cz_kurzy_czk_eur_usd')}
        />

        <div className="chart-canvas-wrap">
          <ResponsiveContainer width="100%" height={390}>
            <ComposedChart data={enrichedFxSeries} margin={{ top: 14, right: 20, left: 0, bottom: 8 }}>
              <defs>
                <linearGradient id="eurGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="usdGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#14b8a6" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#14b8a6" stopOpacity={0.02} />
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
                domain={['auto', 'auto']}
                tickFormatter={(v) => `${formatNumberCz(v, 1)} Kč`}
              />
              <Tooltip
                content={
                  <CustomChartTooltip
                    extraNotes={(pt) => (
                      <div className="tooltip-spread-summary">
                        <span>Implikovaný kurz EUR/USD:</span>
                        <strong>{formatNumberCz(pt.fx_eur / pt.fx_usd, 4)} USD</strong>
                      </div>
                    )}
                  />
                }
              />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />

              {selectedRange === 'ALL' && (
                <ReferenceLine
                  y={27.0}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: 'Kurzový závazek ČNB 27,00 Kč/EUR (do 04/2017)',
                    position: 'insideTopRight',
                    fill: '#f59e0b',
                    fontSize: 11
                  }}
                />
              )}

              <Area
                type="monotone"
                dataKey="fx_eur"
                name={INDICATORS.fx_eur.name}
                stroke={INDICATORS.fx_eur.color}
                fill="url(#eurGrad)"
                strokeWidth={2.8}
              />
              <Area
                type="monotone"
                dataKey="fx_usd"
                name={INDICATORS.fx_usd.name}
                stroke={INDICATORS.fx_usd.color}
                fill="url(#usdGrad)"
                strokeWidth={2.5}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Druhý řádek: Křížový kurz EUR/USD + Statistická tabulka */}
      <div className="two-col-detail-grid">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <span className="panel-eyebrow">Globální devizový kontext</span>
              <h3>Implikovaný křížový kurz EUR / USD</h3>
              <p className="panel-subtitle">
                Poměr kurzů CZK/EUR ku CZK/USD ukazující sílu eura vůči americkému dolaru
              </p>
            </div>
          </div>

          <div className="chart-canvas-wrap">
            <ResponsiveContainer width="100%" height={270}>
              <ComposedChart data={enrichedFxSeries} margin={{ top: 10, right: 16, left: 0, bottom: 5 }}>
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
                  tickFormatter={(v) => `${formatNumberCz(v, 2)} $`}
                />
                <Tooltip
                  labelFormatter={(l) => formatMonthYearCz(String(l))}
                  formatter={(val: number) => [`${formatNumberCz(val, 4)} USD/EUR`, 'Kurz EUR/USD']}
                  contentStyle={{
                    backgroundColor: 'var(--bg-elevated)',
                    borderColor: 'var(--border-strong)',
                    borderRadius: '10px'
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="eur_usd_cross"
                  name="Implikovaný kurz EUR / USD"
                  stroke="#f59e0b"
                  strokeWidth={2.4}
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <div>
              <span className="panel-eyebrow">Statistika měnových párů ({selectedRange === 'ALL' ? 'Od 2015' : selectedRange})</span>
              <h3>Pásmo volatility a průměrné kurzy</h3>
              <p className="panel-subtitle">
                Souhrnné ukazatele devizových kurzů CZK/EUR a CZK/USD za vybrané období ({periodSpanText})
              </p>
            </div>
          </div>

          <div className="stats-table-wrapper">
            <table className="analytical-table">
              <thead>
                <tr>
                  <th>Měnový pár</th>
                  <th>Aktuálně</th>
                  <th>Průměr</th>
                  <th>Nejsilnější CZK (Min)</th>
                  <th>Nejslabší CZK (Max)</th>
                  <th>Změna za období</th>
                </tr>
              </thead>
              <tbody>
                {fxStats.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <div className="table-ind-cell">
                        <span className="table-dot" style={{ backgroundColor: st.def.color }} />
                        <div>
                          <strong>{st.def.name}</strong>
                          <span className="table-subcode">{st.def.sourceCode}</span>
                        </div>
                      </div>
                    </td>
                    <td className="num-col strong-num">{formatNumberCz(st.current, 2)} Kč</td>
                    <td className="num-col">{formatNumberCz(st.avg, 2)} Kč</td>
                    <td className="num-col">{formatNumberCz(st.min, 2)} Kč</td>
                    <td className="num-col">{formatNumberCz(st.max, 2)} Kč</td>
                    <td className="num-col">
                      <span
                        className={`change-badge ${
                          st.pctChange > 0.01
                            ? 'change-positive'
                            : st.pctChange < -0.01
                            ? 'change-negative'
                            : 'change-neutral'
                        }`}
                      >
                        {formatSignedChangeCz(st.pctChange, 'pct', 2)}
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
