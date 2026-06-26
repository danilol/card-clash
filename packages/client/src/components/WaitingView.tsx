import type { Match } from '../state/reducer';
import React, { useState } from 'react';

interface WaitingViewProps {
  view: Match;
}

export function WaitingView({ view }: WaitingViewProps): React.JSX.Element {
  const link: string = view?.link || '';

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);

      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div style={{ backgroundColor: 'lightgreen' }}>
      <h1>Hi {view?.nickname}!</h1>
      <p>Waiting for opponent…</p>
      {view && <p>Share this link: {link}</p>}
      <button onClick={handleCopy}>{copied ? 'Copied!' : 'Copy link'}</button>
    </div>
  );
}
