import React from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Calendar,
  ExternalLink
} from 'lucide-react';
import { Line, LineChart, ResponsiveContainer, YAxis } from 'recharts';
import {
  formatNumberCz,
  formatSignedChangeCz,
  formatValidDateCz
} from '../services/dataService';
import { IndicatorId, KpiSummary } from '../types/macro';

interface KpiCardProps {
  summary: KpiSummary;
  onInspect: (indicatorId: IndicatorId) => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({ summary, onInspect }) => {
  const {
    id,
    definition,
    currentValue,
    validDate,
    periodLabel,
    momChange,
    momChangeLabel,
    yoyChange,
    secondaryMetric,
    sparkline,
    min12m,
    max12m
  } = summary;

  const getChangeClass = (val: number) => {
    if (val > 0.001) return 'change-positive'; // Zelená pro kladnou změnu (+)
    if (val < -0.001) return 'change-negative'; // Červená pro zápornou změnu (-)
    return 'change-neutral';
  };

  const renderChangeIcon = (val: number) => {
    if (val > 0.001) return <ArrowUpRight size={13} />;
    if (val < -0.001) return <ArrowDownRight size={13} />;
    return <ArrowRight size={13} />;
  };

  // Pozice aktuální hodnoty v 12M min-max pásmu (0 - 100 %)
  const rangeSpan = max12m - min12m;
  const rangePositionPct =
    rangeSpan > 0.0001
      ? Math.min(100, Math.max(0, ((currentValue - min12m) / rangeSpan) * 100))
      : 50;

  const categoryLabelMap = {
    rates: 'Sazby & Swapy',
    macro: 'Makro ČR',
    fx: 'Devizový kurz'
  };

  return (
    <article
      className="kpi-card"
      onClick={() => onInspect(id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onInspect(id);
        }
      }}
      aria-label={`${definition.name}: ${formatNumberCz(currentValue, definition.decimals)} ${definition.unit}`}
    >
      <div
        className="kpi-card-accent"
        style={{ backgroundColor: definition.color }}
      />

      <div className="kpi-card-top">
        <div className="kpi-title-group">
          <div className="kpi-meta-badges">
            <span className={`kpi-cat-badge cat-${definition.category}`}>
              {categoryLabelMap[definition.category]}
            </span>
            <span className="kpi-source-badge">{definition.sourceName}</span>
          </div>
          <h3 className="kpi-title">{definition.name}</h3>
        </div>
        <span className="kpi-inspect-icon" title="Zobrazit v detailním interaktivním grafu">
          <ExternalLink size={14} />
        </span>
      </div>

      {/* Hlavní hodnota a mini sparkline */}
      <div className="kpi-main-row">
        <div className="kpi-value-block">
          <div className="kpi-value-number">
            {formatNumberCz(currentValue, definition.decimals)}
            <span className="kpi-value-unit">{definition.unit}</span>
          </div>
          <div className="kpi-validity" title={`Datum platnosti dat: ${formatValidDateCz(validDate)}`}>
            <Calendar size={12} />
            <span>
              Platnost: <strong>{formatValidDateCz(validDate)}</strong> ({periodLabel})
            </span>
          </div>
        </div>

        <div className="kpi-sparkline-box" aria-hidden="true">
          <ResponsiveContainer width="100%" height={46}>
            <LineChart data={sparkline}>
              <YAxis domain={['dataMin', 'dataMax']} hide />
              <Line
                type="monotone"
                dataKey="value"
                stroke={definition.color}
                strokeWidth={2.2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
          <span className="sparkline-caption">12M trend</span>
        </div>
      </div>

      {/* Sekundární metrika (např. u HDP nebo Reálné repo sazby) */}
      {secondaryMetric && (
        <div className="kpi-secondary-strip">
          <span>{secondaryMetric.label}:</span>
          <strong>
            {secondaryMetric.value > 0 ? '+' : ''}
            {formatNumberCz(secondaryMetric.value, definition.decimals)} {secondaryMetric.unit}
          </strong>
        </div>
      )}

      {/* Meziměsíční (MoM/QoQ) a meziroční (YoY) změny – barevně odlišené (zelená / červená) */}
      <div className="kpi-changes-grid">
        <div className="kpi-change-item">
          <span className="change-label">Změna {momChangeLabel}</span>
          <span className={`change-badge ${getChangeClass(momChange)}`}>
            {renderChangeIcon(momChange)}
            {formatSignedChangeCz(momChange, definition.changeUnit, definition.decimals)}
          </span>
        </div>

        <div className="kpi-change-item">
          <span className="change-label">Změna YoY (1R)</span>
          <span className={`change-badge ${getChangeClass(yoyChange)}`}>
            {renderChangeIcon(yoyChange)}
            {formatSignedChangeCz(yoyChange, definition.changeUnit, definition.decimals)}
          </span>
        </div>
      </div>

      {/* 12měsíční rozpětí Min – Max */}
      <div className="kpi-range-footer">
        <div className="range-labels">
          <span>12M Min: {formatNumberCz(min12m, definition.decimals)} {definition.unit}</span>
          <span>12M Max: {formatNumberCz(max12m, definition.decimals)} {definition.unit}</span>
        </div>
        <div className="range-bar-track">
          <div
            className="range-bar-fill"
            style={{
              width: `${rangePositionPct}%`,
              backgroundColor: definition.color
            }}
          />
          <div
            className="range-bar-Dot"
            style={{
              left: `${rangePositionPct}%`,
              borderColor: definition.color
            }}
          />
        </div>
      </div>
    </article>
  );
};
