import type { CSSProperties } from 'react';

interface StarRatingControlProps {
  value: number; // 0-5; 0 = unrated
  onChange: (value: number) => void;
  disabled?: boolean;
  size?: 'small' | 'medium';
}

const STAR_VALUES = [1, 2, 3, 4, 5] as const;

export function StarRatingControl({ value, onChange, disabled = false, size = 'medium' }: StarRatingControlProps) {
  const fontSize = size === 'small' ? '13px' : '17px';

  const containerStyle: CSSProperties = {
    display: 'flex',
    gap: '1px',
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div style={containerStyle}>
      {STAR_VALUES.map((starValue) => {
        const filled = starValue <= value;
        return (
          <button
            key={starValue}
            type="button"
            disabled={disabled}
            onClick={() => onChange(starValue === value ? 0 : starValue)}
            title={`${starValue} star${starValue !== 1 ? 's' : ''}${starValue === value ? ' (click to clear)' : ''}`}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              lineHeight: 1,
              fontSize,
              color: filled ? '#f59e0b' : '#d1d5db',
              cursor: disabled ? 'default' : 'pointer',
            }}
          >
            {filled ? '★' : '☆'}
          </button>
        );
      })}
    </div>
  );
}
