import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('App', () => {
  it('rendert App-Name und die Startseite mit Suchfeld', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /MDM Doctor/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Gerätename' })).toBeInTheDocument();
  });
});
