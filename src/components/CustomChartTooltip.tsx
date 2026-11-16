import React from 'react';
import { INDICATORS } from '../config/indicators';
import { formatMonthYearCz, formatNumberCz, formatValidDateCz } from '../services/dataService';
import { IndicatorId, MacroDataPoint } from '../types/macro';

interface TooltipPayloadItem {
  dataKey: string;
  name: string;
  value: number;
  color: string;
  payload: MacroDataPoint & Record<string, number | string>;
}

interface CustomChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  extraNotes?: (point: MacroDataPoint) => React.ReactNode;
}

export const CustomChartTooltip: React.FC<CustomChartTooltipProps> = ({
  active,
  payload,
  label,
  extraNotes
}) => {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const point = payload[0].payload;
  const formattedMonth = label ? formatMonthYearCz(label) : '';
  const validDate = point?.validDate ? formatValidDateCz(point.validDate) : '';

  return (
    <div className="custom-chart-tooltip">
      <div className="tooltip-header">
        <span className="tooltip-period">{formattedMonth}</span>
        {point?.quarter && <span className="tooltip-quarter">{point.quarter}</span>}
      </div>
      {validDate && (
        <div className="tooltip-subdate">Platnost k: {validDate}</div>
      )}
      <div className="tooltip-divider" />
      <div className="tooltip-rows">
        {payload.map((entry) => {
          const ind = INDICATORS[entry.dataKey as IndicatorId];
          const decimals = ind ? ind.decimals : 2;
          const unit = ind ? ind.unit : '%';
          const displayName = ind ? ind.shortName : entry.name;

          return (
            <div key={entry.dataKey} className="tooltip-row">
              <div className="tooltip-series-label">
                <span
                  className="tooltip-dot"
                  style={{ backgroundColor: entry.color || ind?.color || '#3b82f6' }}
                />
                <span>{displayName}</span>
              </div>
              <span className="tooltip-series-val">
                {typeof entry.value === 'number'
                  ? `${formatNumberCz(entry.value, decimals)} ${unit}`
                  : '—'}
              </span>
            </div>
          );
        })}
      </div>
      {extraNotes && point && (
        <div className="tooltip-extra">{extraNotes(point)}</div>
      )}
    </div>
  );
};
