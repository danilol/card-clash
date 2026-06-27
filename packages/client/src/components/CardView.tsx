import React from 'react';
import type { PlayerView, StatKey } from '@card-clash/engine';

interface CardViewProps {
  view: PlayerView;
  onSelectStat?: (statKey: StatKey) => void;
  disabled?: boolean;
}

export function CardView({
  view,
  onSelectStat,
  disabled = false,
}: CardViewProps): React.JSX.Element {
  const topCard = view?.yourTopCard;
  const stats = topCard?.stats;

  const isYourTurn = view?.chooser === view?.you;

  if (!topCard) {
    return (
      <div style={{ color: 'white', padding: '10px' }}>No card available</div>
    );
  }

  return (
    <div style={styles.cardContainer}>
      <div style={styles.cardHeader}>
        <h2 style={styles.cardName}>{topCard.name}</h2>
        {view.yourTopCardIsSuperTrump && (
          <span style={styles.superBadge}>⭐ SUPER</span>
        )}
      </div>

      <div style={styles.statsList}>
        {view.statDefinitions?.map((def) => {
          const rawValue = stats?.[def.key as keyof typeof stats];

          const displayValue =
            def.key === 'bounty' && typeof rawValue === 'number'
              ? rawValue.toLocaleString()
              : (rawValue ?? 'N/A');

          const directionHint = def.direction === 'low' ? '▼ (Low Wins)' : '▲';

          return (
            <button
              key={def.key}
              disabled={!isYourTurn || disabled}
              onClick={() => onSelectStat?.(def.key)}
              style={{
                ...styles.statButton,
                cursor: isYourTurn ? 'pointer' : 'not-allowed',
                opacity: isYourTurn ? 1 : 0.75,
              }}
            >
              <span style={styles.statLabel}>
                {def.label} <small style={styles.hint}>{directionHint}</small>
              </span>
              <span style={styles.statValue}>{displayValue}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  cardContainer: {
    backgroundColor: '#1e1e24',
    color: '#fff',
    borderRadius: '12px',
    padding: '20px',
    width: '320px',
    boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
    fontFamily: 'sans-serif',
    marginTop: '15px',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '2px solid #3e3e42',
    paddingBottom: '10px',
    marginBottom: '15px',
  },
  cardName: {
    margin: 0,
    fontSize: '1.4rem',
    color: '#f1c40f',
  },
  superBadge: {
    backgroundColor: '#f1c40f',
    color: '#000',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    padding: '3px 6px',
    borderRadius: '4px',
  },
  statsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  statButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 14px',
    backgroundColor: '#2d2d30',
    border: '1px solid #3e3e42',
    borderRadius: '6px',
    color: 'inherit',
    fontSize: '0.95rem',
    width: '100%',
    textAlign: 'left' as const,
  },
  statLabel: {
    fontWeight: '500',
  },
  hint: {
    color: '#888',
    marginLeft: '5px',
    fontSize: '0.75rem',
  },
  statValue: {
    fontWeight: 'bold',
    color: '#f1c40f',
  },
};
