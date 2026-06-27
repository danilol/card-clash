import React, { useState, useEffect } from 'react';
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

  const [imgSrc, setImgSrc] = useState<string | null>(null);

  useEffect(() => {
    if (topCard?.id) {
      setImgSrc(`/images/cards/${topCard.id}.png`);
    } else {
      setImgSrc(null);
    }
  }, [topCard?.id]);

  if (!topCard) {
    return (
      <div style={{ color: 'white', padding: '10px' }}>No card available</div>
    );
  }

  const handleImgError = () => {
    if (topCard?.id && imgSrc === `/images/cards/${topCard.id}.png`) {
      setImgSrc(`/images/cards/${topCard.id}.jpg`);
    } else {
      setImgSrc(null);
    }
  };

  return (
    <div style={styles.cardContainer}>
      {/* 1. PREMIUM HEADER */}
      <div style={styles.cardHeader}>
        <h2 style={styles.cardName}>{topCard.name}</h2>
        {view.yourTopCardIsSuperTrump && (
          <span style={styles.superBadge}>⭐ SUPER</span>
        )}
      </div>

      {/* 2. ART BOX FRAME (Masks fake transparent checkered backgrounds cleanly) */}
      <div style={styles.artFrame}>
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={topCard.name}
            onError={handleImgError}
            style={styles.characterArt}
          />
        ) : (
          <div style={styles.fallbackArt}>
            <span style={{ fontSize: '2.5rem' }}>🏴‍☠️</span>
            <small style={{ color: '#555', fontWeight: 'bold' }}>WANTED</small>
          </div>
        )}
      </div>

      {/* 3. LIST OF STATISTICS */}
      <div style={styles.statsList}>
        {view.statDefinitions?.map((def) => {
          const rawValue = stats?.[def.key as keyof typeof stats];

          const displayValue =
            def.key === 'bounty' && typeof rawValue === 'number'
              ? rawValue.toLocaleString()
              : (rawValue ?? 'N/A');

          const directionHint = def.direction === 'low' ? '▼ (Low Wins)' : '▲';
          const canClick = isYourTurn && !disabled;

          return (
            <button
              key={def.key}
              disabled={!canClick}
              onClick={() => onSelectStat?.(def.key)}
              style={{
                ...styles.statButton,
                cursor: canClick ? 'pointer' : 'not-allowed',
                opacity: canClick ? 1 : 0.6,
                // Add a bright border highlight on your turn
                border: canClick ? '1px solid #3e3e42' : '1px solid #252528',
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

// 📐 Polished Trading Card CSS Blueprints
const styles: Record<string, React.CSSProperties> = {
  cardContainer: {
    backgroundColor: '#151518',
    color: '#fff',
    borderRadius: '16px',
    padding: '16px',
    width: '340px', // Uniform physical card width
    boxShadow:
      '0 15px 35px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)',
    fontFamily: '"Segoe UI", Roboto, sans-serif',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    border: '2px solid #2d2d35',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: '4px',
  },
  cardName: {
    margin: 0,
    fontSize: '1.25rem',
    fontWeight: '800',
    color: '#f1c40f',
    letterSpacing: '0.3px',
  },
  superBadge: {
    backgroundColor: '#f1c40f',
    color: '#000',
    fontSize: '0.7rem',
    fontWeight: '900',
    padding: '2px 6px',
    borderRadius: '4px',
  },
  artFrame: {
    width: '100%',
    height: '180px', // Dedicated framing container height
    backgroundColor: '#0b0b0d', // Pure dark backdrop completely hides checkered fake transparent boxes!
    backgroundImage: 'linear-gradient(180deg, #111115 0%, #050507 100%)',
    borderRadius: '10px',
    overflow: 'hidden',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    border: '1px solid #26262b',
    position: 'relative',
  },
  characterArt: {
    width: '100%',
    height: '100%',
    objectFit: 'contain', // Prevents Buggy from getting squished or clipped
    padding: '4px', // Nice breathing room frame gutter
  },
  fallbackArt: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    opacity: 0.4,
  },
  statsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  statButton: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 12px',
    backgroundColor: '#1d1d22',
    borderRadius: '6px',
    color: 'inherit',
    fontSize: '0.9rem',
    width: '100%',
    textAlign: 'left' as const,
    transition: 'all 0.1s ease',
  },
  statLabel: {
    fontWeight: '600',
    color: '#bdc3c7',
  },
  hint: {
    color: '#666',
    marginLeft: '4px',
    fontSize: '0.7rem',
    fontWeight: 'normal',
  },
  statValue: {
    fontWeight: '800',
    color: '#f1c40f',
  },
};
