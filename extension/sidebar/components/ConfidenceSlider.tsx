import React, { useCallback } from "react";

interface ConfidenceSliderProps {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
}

function getConfidenceColor(v: number): string {
  if (v >= 0.8) return "var(--memorey-success)";
  if (v >= 0.5) return "var(--memorey-warning)";
  return "var(--memorey-error)";
}

export function ConfidenceSlider({ value, onChange, readonly }: ConfidenceSliderProps) {
  const pct = Math.round(value * 100);
  const color = getConfidenceColor(value);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(parseFloat(e.target.value));
    },
    [onChange]
  );

  const gradientStyle: React.CSSProperties = {
    background: `linear-gradient(to right, var(--memorey-error), var(--memorey-warning) 50%, var(--memorey-success))`,
  };

  return (
    <div className="memorey-confidence-slider">
      <div className="memorey-confidence-slider__label">
        Confidence: <span style={{ color, fontWeight: 600 }}>{value.toFixed(2)}</span>
      </div>
      <div className="memorey-confidence-slider__track-wrap">
        <div className="memorey-confidence-slider__track" style={gradientStyle} />
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={value}
          onChange={handleChange}
          disabled={readonly}
          className="memorey-confidence-slider__input"
        />
        <div
          className="memorey-confidence-slider__thumb-label"
          style={{ left: `${pct}%`, color }}
        >
          {pct}%
        </div>
      </div>
    </div>
  );
}
