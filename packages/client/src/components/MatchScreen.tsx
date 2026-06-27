import React from 'react';
import { CardView } from './CardView';
import type { PlayerView, StatKey } from '@card-clash/engine';

interface MatchScreenProps {
  view: PlayerView;
  onSelectStat?: (statKey: StatKey) => void;
}

export function MatchScreen({
  view,
  onSelectStat,
}: MatchScreenProps): React.JSX.Element {
  const getStatLabel = (key: string, definitions: readonly any[]) => {
    return definitions?.find((d) => d.key === key)?.label || key;
  };

  const isYourTurn = view?.chooser === view?.you;

  return (
    <div style={styles.pageWrapper}>
      <header style={styles.scoreboard}>
        <div style={styles.scoreBlock}>
          <span style={styles.scoreLabel}>YOUR DECK</span>
          <span style={styles.scoreValue}>🎴 {view.yourStackCount}</span>
        </div>

        <div style={styles.potBlock}>
          <span style={styles.potLabel}>POT CARDS</span>
          <span
            style={{
              ...styles.potValue,
              color: view.potCount > 0 ? '#ff7979' : '#f5f6fa',
              textShadow:
                view.potCount > 0 ? '0 0 10px rgba(255,121,121,0.4)' : 'none',
            }}
          >
            🃏 {view.potCount}
          </span>
        </div>

        {view.lastRound &&
          (() => {
            const isWinnerYou = view.lastRound.winner === view.you;
            const isTie = view.lastRound.winner === null;

            const yourPlayedCard = view.lastRound.playedCards[view.you]?.[0];
            const opponentId =
              Object.keys(view.lastRound.playedCards).find(
                (id) => id !== view.you,
              ) || '';
            const opponentPlayedCard =
              view.lastRound.playedCards[opponentId]?.[0];

            const statKey = view.lastRound.stat;
            const statLabel = getStatLabel(statKey, view.statDefinitions);
            const yourValue =
              yourPlayedCard?.stats?.[
                statKey as keyof typeof yourPlayedCard.stats
              ];
            const opponentValue =
              opponentPlayedCard?.stats?.[
                statKey as keyof typeof opponentPlayedCard.stats
              ];

            return (
              <div
                style={{
                  ...styles.lastRoundResult,
                  borderLeft: isTie
                    ? '4px solid #f1c40f'
                    : isWinnerYou
                      ? '4px solid #2ecc71'
                      : '4px solid #e74c3c',
                }}
              >
                <div style={styles.lastRoundSummary}>
                  <span style={styles.lastRoundLabel}>LAST ROUND OUTCOME</span>
                  <h3
                    style={{
                      ...styles.lastRoundStatus,
                      color: isTie
                        ? '#f1c40f'
                        : isWinnerYou
                          ? '#2ecc71'
                          : '#e74c3c',
                    }}
                  >
                    {isTie
                      ? "🤝 IT'S A DRAW!"
                      : isWinnerYou
                        ? '🎉 YOU WON THE ROUND'
                        : '💥 OPPONENT WON THE ROUND'}
                  </h3>
                </div>

                <div style={styles.showdownRow}>
                  <div style={styles.showdownFighter}>
                    <span style={styles.fighterName}>
                      {yourPlayedCard?.name || 'You'}
                    </span>
                    <span style={styles.fighterStat}>
                      {yourValue?.toLocaleString() ?? 'N/A'}
                    </span>
                  </div>

                  <div style={styles.vsBadge}>
                    VS <br />
                    <small style={{ fontSize: '0.65rem', color: '#aaa' }}>
                      {statLabel}
                    </small>
                  </div>

                  <div style={styles.showdownFighter}>
                    <span style={{ ...styles.fighterName, textAlign: 'right' }}>
                      {opponentPlayedCard?.name || 'Opponent'}
                    </span>
                    <span
                      style={{
                        ...styles.fighterStat,
                        color: '#e74c3c',
                        textAlign: 'right',
                      }}
                    >
                      {opponentValue?.toLocaleString() ?? 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}

        <div style={styles.scoreBlock}>
          <span style={styles.scoreLabel}>OPPONENT</span>
          <span style={styles.scoreValue}>🎴 {view.opponentStackCount}</span>
        </div>
      </header>

      <div
        style={{
          ...styles.turnBanner,
          background: isYourTurn
            ? 'linear-gradient(90deg, rgba(39,174,96,0) 0%, rgba(39,174,96,1) 50%, rgba(39,174,96,0) 100%)'
            : 'linear-gradient(90deg, rgba(192,57,43,0) 0%, rgba(192,57,43,1) 50%, rgba(192,57,43,0) 100%)',
        }}
      >
        <h2 style={styles.turnText}>
          {isYourTurn
            ? '⚡ YOUR TURN — CHOOSE A STAT ⚡'
            : "⏳ OPPONENT'S TURN — WAITING..."}
        </h2>
      </div>

      <main style={styles.arena}>
        <div style={styles.cardWrapper}>
          <CardView view={view} onSelectStat={onSelectStat} />
        </div>
      </main>
    </div>
  );
}

const styles = {
  pageWrapper: {
    backgroundColor: '#0f1115', // Sleek dark space background
    backgroundImage:
      'radial-gradient(circle at 50% 50%, #1a1f29 0%, #0f1115 100%)',
    color: '#f5f6fa',
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column' as const,
    fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: '20px',
    boxSizing: 'border-box' as const,
  },
  scoreboard: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '40px',
    backgroundColor: 'rgba(21, 26, 36, 0.85)',
    border: '1px solid #2c3545',
    padding: '12px 30px',
    borderRadius: '16px',
    maxWidth: '600px',
    margin: '0 auto 20px auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    backdropFilter: 'blur(8px)',
  },
  scoreBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  scoreLabel: {
    fontSize: '0.75rem',
    letterSpacing: '1.5px',
    color: '#7f8c8d',
    fontWeight: 'bold',
    marginBottom: '4px',
  },
  scoreValue: {
    fontSize: '1.5rem',
    fontWeight: '800',
    color: '#e1b12c',
  },
  potBlock: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    borderLeft: '2px solid #2c3545',
    borderRight: '2px solid #2c3545',
    padding: '0 40px',
  },
  potLabel: {
    fontSize: '0.8rem',
    letterSpacing: '2px',
    color: '#f1c40f',
    fontWeight: '900',
    marginBottom: '2px',
  },
  potValue: {
    fontSize: '1.8rem',
    fontWeight: '900',
    color: '#f1c40f',
    textShadow: '0 0 10px rgba(241,196,15,0.4)',
  },
  turnBanner: {
    width: '100%',
    padding: '10px 0',
    textAlign: 'center' as const,
    marginBottom: '25px',
  },
  turnText: {
    margin: 0,
    fontSize: '1.1rem',
    letterSpacing: '2px',
    fontWeight: '800',
    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
  },
  arena: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    paddingBottom: '40px',
  },
  cardWrapper: {
    transform: 'scale(1.05)', // Gently pops your card layout size
    transition: 'transform 0.3s ease',
  },
  footerContainer: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '10px',
  },
  debugToggle: {
    backgroundColor: '#1c2331',
    color: '#a4b0be',
    border: '1px solid #2f3542',
    padding: '8px 16px',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '0.85rem',
    transition: 'all 0.2s',
  },
  debugPayload: {
    width: '100%',
    maxWidth: '800px',
    maxHeight: '250px',
    overflowY: 'auto' as const,
    backgroundColor: '#090a0f',
    border: '1px solid #1c2331',
    borderRadius: '8px',
    padding: '15px',
    color: '#7bed9f',
    boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
  },
  lastRoundResult: {
    backgroundColor: '#161a23',
    borderRadius: '12px',
    padding: '14px 20px',
    maxWidth: '560px',
    width: '100%',
    margin: '0 auto 20px auto',
    boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '10px',
  },
  lastRoundSummary: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #232b3b',
    paddingBottom: '6px',
  },
  lastRoundLabel: {
    fontSize: '0.7rem',
    fontWeight: 'bold',
    letterSpacing: '1px',
    color: '#7f8c8d',
  },
  lastRoundStatus: {
    margin: 0,
    fontSize: '0.95rem',
    fontWeight: 'bold',
    letterSpacing: '0.5px',
  },
  showdownRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '15px',
  },
  showdownFighter: {
    display: 'flex',
    flexDirection: 'column' as const,
    flex: 1,
  },
  fighterName: {
    fontSize: '0.9rem',
    fontWeight: '600',
    color: '#ecf0f1',
    whiteSpace: 'nowrap' as const,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  fighterStat: {
    fontSize: '1.1rem',
    fontWeight: '800',
    color: '#2ecc71',
    marginTop: '2px',
  },
  vsBadge: {
    backgroundColor: '#232b3b',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '0.75rem',
    fontWeight: 'bold',
    color: '#8e44ad',
    textAlign: 'center' as const,
    lineHeight: '1.2',
    minWidth: '90px',
  },
};
