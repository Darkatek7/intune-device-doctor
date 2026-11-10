import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import { ViewFallback } from './ViewFallback';

describe('ViewFallback', () => {
  it('meldet das Laden für Hilfstechnik (aria-busy, Statusrolle) und blendet verzögert ein', () => {
    render(<ViewFallback />);
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-busy', 'true');
    expect(status).toHaveTextContent(de.states.loading);
    // Verzögertes Einblenden: kein Aufblitzen bei schnellem Laden
    expect(status).toHaveClass('fade-in-delayed');
  });
});
