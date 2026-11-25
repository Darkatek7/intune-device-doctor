import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { de } from '../i18n/de';
import type { PostureCheckResult } from '../rules/posture';
import { PostureCheckList } from './PostureCheckList';

const t = de.posture.view.checks;
const URL_BASE = 'https://learn.microsoft.com/de-de/mem/intune/protect/';

function check(
  id: string,
  status: PostureCheckResult['status'],
  extra: Partial<PostureCheckResult> = {},
): PostureCheckResult {
  return {
    id,
    tile: 'postureComplianceWindows',
    label: `Einstellung ${id}`,
    status,
    level: null,
    actual: `Ist ${id}`,
    expected: `Soll ${id}`,
    docsUrl: `${URL_BASE}${id}`,
    counted: true,
    ...extra,
  };
}

const CHECKS: PostureCheckResult[] = [
  check('a-met', 'met', { subject: 'Contoso Basis', level: 1 }),
  check('b-dev', 'deviating', { subject: 'Contoso Basis', properties: ['bitLockerEnabled'] }),
  check('c-nc', 'notChecked', { subject: 'Contoso Basis', reason: 'Keine v1.0-Eigenschaft' }),
  check('d-dev', 'deviating', { subject: 'Contoso Basis', level: 2 }),
  check('e-met', 'met'),
  check('f-dev', 'deviating', { subject: 'Contoso Zweit', counted: false }),
];

const filterButton = (name: string) => screen.getByRole('radio', { name: new RegExp(name) });

describe('PostureCheckList', () => {
  it('zeigt die Filter mit Zählern und startet bei Abweichungen', () => {
    render(<PostureCheckList checks={CHECKS} />);
    const group = screen.getByRole('radiogroup', { name: t.filterLabel });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => r.textContent)).toEqual([
      'Abweichungen (3)',
      'Nicht prüfbar (1)',
      'Erfüllt (2)',
      'Alle (6)',
    ]);
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByTestId('posture-check')).toHaveLength(3);
  });

  it('startet bei „Alle“, wenn es keine Abweichung gibt', () => {
    render(<PostureCheckList checks={[check('x', 'met'), check('y', 'notChecked')]} />);
    expect(filterButton('Alle')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getAllByTestId('posture-check')).toHaveLength(2);
  });

  it('gruppiert nach Richtlinie und sortiert Abweichungen, nicht prüfbar, erfüllt', async () => {
    const user = userEvent.setup();
    render(<PostureCheckList checks={CHECKS} />);
    await user.click(filterButton('Alle'));
    const groups = screen.getAllByTestId('posture-check-group');
    expect(groups).toHaveLength(3);
    expect(within(groups[0]!).getByRole('heading', { name: 'Contoso Basis' })).toBeInTheDocument();
    expect(
      within(groups[0]!)
        .getAllByTestId('posture-check')
        .map((row) => row.getAttribute('data-status')),
    ).toEqual(['deviating', 'deviating', 'notChecked', 'met']);
    // Gruppe ohne Richtlinie (Reihenfolge des ersten Auftretens) hat keine Überschrift
    expect(within(groups[1]!).queryByRole('heading')).not.toBeInTheDocument();
    expect(within(groups[1]!).getAllByTestId('posture-check')).toHaveLength(1);
    expect(within(groups[2]!).getByRole('heading', { name: 'Contoso Zweit' })).toBeInTheDocument();
  });

  it('filtert und wechselt per Pfeiltasten', async () => {
    const user = userEvent.setup();
    render(<PostureCheckList checks={CHECKS} />);
    filterButton('Abweichungen').focus();
    await user.keyboard('{ArrowRight}');
    expect(filterButton('Nicht prüfbar')).toHaveAttribute('aria-checked', 'true');
    expect(filterButton('Nicht prüfbar')).toHaveFocus();
    expect(filterButton('Nicht prüfbar')).toHaveAttribute('tabindex', '0');
    expect(filterButton('Abweichungen')).toHaveAttribute('tabindex', '-1');
    expect(screen.getAllByTestId('posture-check')).toHaveLength(1);
    await user.keyboard('{ArrowRight}');
    expect(screen.getAllByTestId('posture-check')).toHaveLength(2);
    await user.keyboard('{End}');
    expect(filterButton('Alle')).toHaveFocus();
    expect(screen.getAllByTestId('posture-check')).toHaveLength(6);
  });

  it('zeigt bei leerem Filter einen ruhigen Text', async () => {
    const user = userEvent.setup();
    render(<PostureCheckList checks={[check('x', 'met')]} />);
    await user.click(filterButton('Nicht prüfbar'));
    expect(screen.queryAllByTestId('posture-check')).toHaveLength(0);
    expect(screen.getByText(t.empty.notChecked)).toBeInTheDocument();
  });

  it('zeigt je Zeile Status als Text, Ist, Empfehlung, Stufe, Grund, Hinweis und technischen Namen', async () => {
    const user = userEvent.setup();
    render(<PostureCheckList checks={CHECKS} />);
    await user.click(filterButton('Alle'));
    const rows = screen.getAllByTestId('posture-check');
    const byLabel = (label: string) => rows.find((r) => r.textContent?.includes(label))!;

    const dev = byLabel('Einstellung b-dev');
    expect(within(dev).getByText(de.posture.view.overall.deviating)).toBeInTheDocument();
    expect(within(dev).getByText('Ist b-dev')).toBeInTheDocument();
    expect(within(dev).getByText('Soll b-dev')).toBeInTheDocument();
    const code = within(dev).getByText('bitLockerEnabled');
    expect(code.tagName).toBe('CODE');
    expect(code).toHaveAttribute('lang', 'en');

    const nc = byLabel('Einstellung c-nc');
    expect(within(nc).getByText(de.posture.view.overall.notChecked)).toBeInTheDocument();
    expect(within(nc).getByText('Keine v1.0-Eigenschaft')).toBeInTheDocument();

    expect(within(byLabel('Einstellung a-met')).getByText('Stufe 1')).toBeInTheDocument();
    expect(within(byLabel('Einstellung e-met')).queryByText(/^Stufe/)).not.toBeInTheDocument();

    expect(within(byLabel('Einstellung f-dev')).getByText(t.notCounted)).toBeInTheDocument();
    expect(within(dev).queryByText(t.notCounted)).not.toBeInTheDocument();
  });

  it('hat je Zeile einen eigenen, sicheren Link mit sprechendem Namen', async () => {
    const user = userEvent.setup();
    render(<PostureCheckList checks={CHECKS} />);
    await user.click(filterButton('Alle'));
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(6);
    const link = screen.getByRole('link', { name: t.sourceLabel('Einstellung a-met') });
    expect(link).toHaveAttribute('href', `${URL_BASE}a-met`);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(link).toHaveTextContent(t.learn);
  });

  it('wiederholt den Grund nicht, wenn er schon als Ist-Wert steht', () => {
    const reason = 'Über die dokumentierte API nicht verfügbar';
    render(<PostureCheckList checks={[check('z', 'notChecked', { actual: reason, reason })]} />);
    expect(screen.getAllByText(reason)).toHaveLength(1);
    expect(screen.queryByText(t.reason)).not.toBeInTheDocument();
  });
});
