import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  onePieceDeck,
  projectFor,
  createMatch,
  mulberry32,
} from '@card-clash/engine';
import { CardView } from './CardView';

describe('CardView (deferred render test, landed in 3.1)', () => {
  it('renders all 8 labeled stats of the top card', () => {
    const state = createMatch(onePieceDeck, ['alice', 'bob'], mulberry32(1));
    const view = projectFor(state, 'alice');

    render(<CardView view={view} />);

    expect(view.statDefinitions).toHaveLength(8);
    for (const def of view.statDefinitions) {
      // Escape the label — a future label with regex metacharacters must not
      // break the matcher.
      const escaped = def.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(screen.getByText(new RegExp(escaped))).toBeTruthy();
    }
  });
});
