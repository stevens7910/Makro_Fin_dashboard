import React from 'react';
import { Calendar, Download } from 'lucide-react';
import { TIME_RANGE_OPTIONS } from '../config/indicators';
import { TimeRangeKey } from '../types/macro';

interface TimeRangeSelectorProps {
  selectedRange: TimeRangeKey;
  onChangeRange: (range: TimeRangeKey) => void;
  onExportCsv?: () => void;
  periodInfoLabel?: string;
}

export const TimeRangeSelector: React.FC<TimeRangeSelectorProps> = ({
  selectedRange,
  onChangeRange,
  onExportCsv,
  periodInfoLabel
}) => {
  return (
    <div className="time-range-toolbar">
      <div className="time-range-left">
        <span className="time-range-caption">
          <Calendar size={14} />
          <span>Časové období:</span>
        </span>
        <div className="time-range-group" role="group" aria-label="Volba časového období grafu">
          {TIME_RANGE_OPTIONS.map((opt) => {
            const active = selectedRange === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                className={`range-btn ${active ? 'active' : ''}`}
                onClick={() => onChangeRange(opt.key)}
                title={opt.description}
              >
                {opt.shortLabel}
              </button>
            );
          })}
        </div>
        {periodInfoLabel && <span className="period-span-badge">{periodInfoLabel}</span>}
      </div>

      {onExportCsv && (
        <button
          type="button"
          className="export-csv-btn"
          onClick={onExportCsv}
          title="Exportovat zobrazené časové období do CSV (UTF-8 pro Excel)"
        >
          <Download size={14} />
          <span>Export CSV</span>
        </button>
      )}
    </div>
  );
};
