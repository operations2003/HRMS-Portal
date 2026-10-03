import React from 'react';
import { Clock, RotateCcw, Sparkles } from 'lucide-react';

/**
 * 12-Hour Time Picker with dedicated AM / PM selectors
 * Guarantees foolproof time adjustments without 24-hour confusion
 */
export const TimePicker12 = ({
  label,
  value = { hour: '12', minute: '00', period: 'AM' },
  onChange,
  required = false,
  disabled = false,
  originalTimeStr = null,
  shiftPreset = null,
  extraPresets = [],
  allowClear = false,
  onClear = null,
  isOptional = false,
  isEnabled = true,
  onToggleEnabled = null,
}) => {
  const safeVal = {
    hour: value?.hour || '12',
    minute: value?.minute || '00',
    period: value?.period || 'AM',
  };

  const safeLabel = typeof label === 'string' ? label : 'Time';
  const labelId = `toggle-${safeLabel.replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase()}`;

  const hours = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
  
  // Standard 60-minute selection
  const minutes = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

  const handleHourChange = (e) => {
    if (onChange) {
      onChange({
        ...safeVal,
        hour: e.target.value,
      });
    }
  };

  const handleMinuteChange = (e) => {
    if (onChange) {
      onChange({
        ...safeVal,
        minute: e.target.value,
      });
    }
  };

  const handlePeriodChange = (period) => {
    if (disabled || !isEnabled) return;
    if (onChange) {
      onChange({
        ...safeVal,
        period,
      });
    }
  };

  // Compute 24-hour representation for preview
  const get24HourStr = () => {
    let h = parseInt(safeVal.hour, 10);
    const m = String(safeVal.minute || '00').padStart(2, '0');
    if (isNaN(h)) h = 12;
    if (safeVal.period === 'PM' && h < 12) h += 12;
    if (safeVal.period === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  };

  return (
    <div className="space-y-2 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-200/90 transition-all hover:border-slate-300">
      {/* Header Row: Label & Presets */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isOptional && onToggleEnabled && (
            <input
              type="checkbox"
              id={labelId}
              checked={isEnabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300 cursor-pointer"
            />
          )}
          <label
            htmlFor={labelId}
            className="block text-xs font-bold text-slate-800 cursor-pointer select-none"
          >
            {safeLabel} {required && <span className="text-rose-500">*</span>}
          </label>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {shiftPreset && isEnabled && (
            <button
              type="button"
              onClick={shiftPreset.onClick}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-2 py-0.5 rounded-md border border-brand-200 transition-colors cursor-pointer"
              title="Quickly set to scheduled shift time"
            >
              <Sparkles className="w-3 h-3 text-brand-500" />
              {shiftPreset.label}
            </button>
          )}

          {allowClear && isEnabled && onClear && (
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-slate-400 hover:text-rose-600 px-1.5 py-0.5 rounded hover:bg-rose-50 transition-colors cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {isEnabled ? (
        <>
          {/* Controls Box: Hour : Minute + AM/PM Toggle */}
          <div className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs focus-within:ring-2 focus-within:ring-brand-500/20 focus-within:border-brand-500">
            <div className="pl-1 text-slate-400 shrink-0">
              <Clock className="w-4 h-4" />
            </div>

            {/* Hour Dropdown */}
            <div className="flex-1 min-w-[64px]">
              <label className="sr-only">Hour</label>
              <select
                value={safeVal.hour}
                onChange={handleHourChange}
                disabled={disabled}
                className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                {hours.map((h) => (
                  <option key={h} value={h}>
                    {h} hr
                  </option>
                ))}
              </select>
            </div>

            <span className="text-slate-400 font-extrabold text-base select-none">:</span>

            {/* Minute Dropdown */}
            <div className="flex-1 min-w-[64px]">
              <label className="sr-only">Minute</label>
              <select
                value={safeVal.minute}
                onChange={handleMinuteChange}
                disabled={disabled}
                className="w-full bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-brand-500 cursor-pointer"
              >
                {minutes.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </select>
            </div>

            {/* AM / PM Segmented Control */}
            <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0 shadow-inner">
              <button
                type="button"
                disabled={disabled}
                onClick={() => handlePeriodChange('AM')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer select-none ${
                  safeVal.period === 'AM'
                    ? 'bg-brand-600 text-white shadow-xs ring-1 ring-brand-700/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                aria-pressed={safeVal.period === 'AM'}
              >
                AM
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => handlePeriodChange('PM')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer select-none ${
                  safeVal.period === 'PM'
                    ? 'bg-brand-600 text-white shadow-xs ring-1 ring-brand-700/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
                aria-pressed={safeVal.period === 'PM'}
              >
                PM
              </button>
            </div>
          </div>

          {/* Quick presets row if provided */}
          {extraPresets && extraPresets.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] text-slate-400 font-medium">Quick Set:</span>
              {extraPresets.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={preset.onClick}
                  className="text-[10px] font-medium bg-white hover:bg-brand-50 text-slate-600 hover:text-brand-700 px-2 py-0.5 rounded border border-slate-200 hover:border-brand-300 transition-colors cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {/* Preview & Original Info Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-slate-200/60">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Selected:</span>
              <span className="font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                {safeVal.hour}:{safeVal.minute} {safeVal.period}
              </span>
              <span className="text-slate-400 text-[10px]">
                ({get24HourStr()} 24-hr)
              </span>
            </div>

            {originalTimeStr && (
              <span className="text-slate-400 text-[11px]">
                Original: <strong className="text-slate-600 font-medium">{originalTimeStr}</strong>
              </span>
            )}
          </div>
        </>
      ) : (
        <div className="p-3 bg-white/60 rounded-xl border border-dashed border-slate-200 text-center">
          <p className="text-xs text-slate-500">
            Check-out departure time is omitted (session will remain active/open).
          </p>
          {onToggleEnabled && (
            <button
              type="button"
              onClick={() => onToggleEnabled(true)}
              className="mt-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer"
            >
              + Specify Check-Out Departure Time
            </button>
          )}
        </div>
      )}
    </div>
  );
};
