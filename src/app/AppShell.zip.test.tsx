import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFixtureZip, FIXTURE_FILE_NAME } from '../diagnostics/fixture';
import { de } from '../i18n/de';
import { renderApp } from '../test/renderApp';

const fixtureFile = (): File =>
  new File([new Uint8Array(buildFixtureZip())], FIXTURE_FILE_NAME, { type: 'application/zip' });

const tile = (id: string) => document.querySelector<HTMLButtonElement>(`[data-tile-id="${id}"]`);
const tileButtons = () =>
  screen.queryAllByRole('button').filter((b) => b.getAttribute('aria-haspopup') === 'dialog');

async function openExampleZip(user: ReturnType<typeof userEvent.setup>) {
  renderApp();
  await user.click(screen.getByRole('button', { name: new RegExp(de.zipView.exampleChip) }));
  return screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC042' });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ZIP-Analyse in der App', () => {
  it('zeigt nach „Beispiel-ZIP analysieren“ die vier ZIP-Kacheln – ohne fetch', async () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('fetch darf bei der ZIP-Analyse nicht aufgerufen werden');
    });
    vi.stubGlobal('fetch', fetchSpy);
    const user = userEvent.setup();

    await openExampleZip(user);

    await waitFor(() => expect(tileButtons()).toHaveLength(4));
    expect(screen.getByText(new RegExp(de.zipView.kind))).toBeInTheDocument();
    expect(screen.getByText(FIXTURE_FILE_NAME)).toBeInTheDocument();

    expect(tile('entraJoin')).toHaveTextContent(de.tiles.entraJoin);
    expect(tile('entraJoin')).toHaveTextContent(de.severity.critical);
    expect(tile('win32Apps')).toHaveTextContent(de.tiles.win32Apps);
    expect(tile('enrollment')).toHaveTextContent(de.tiles.enrollment);
    expect(tile('diagCollection')).toHaveTextContent(de.tiles.diagCollection);

    // Die Win32-Kachel nennt den Fehlercode im Detail.
    await user.click(tile('win32Apps')!);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('0x80070642');
    // Demo-Modus: App-Name aus dem Mock-Katalog statt GUID, mit Link ins Intune Admin Center.
    expect(
      await within(dialog).findByText('Installation fehlgeschlagen: Contoso VPN Client 5.1'),
    ).toBeInTheDocument();
    const appLink = within(dialog).getByRole('link', { name: new RegExp(de.links.openApp) });
    expect(appLink).toHaveAttribute(
      'href',
      'https://intune.microsoft.com/#view/Microsoft_Intune_Apps/SettingsMenu/~/0/appId/00000000-0000-0000-0000-0000000000A2',
    );

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('bietet das Zusammenführen an und zeigt danach beide Kachelquellen mit Chip', async () => {
    const user = userEvent.setup();
    await openExampleZip(user);

    const offer = await screen.findByRole('region', {
      name: de.zipView.merge.title('CONTOSO-PC042'),
    });
    await user.click(within(offer).getByRole('button', { name: de.zipView.merge.action }));

    await waitFor(() => expect(tileButtons()).toHaveLength(11));
    expect(window.location.search).toMatch(/device=.+&mode=demo/);
    expect(screen.getByRole('heading', { level: 1, name: 'CONTOSO-PC042' })).toBeInTheDocument();
    expect(screen.getByText(de.zipView.chip.label)).toBeInTheDocument();

    // Entfernen: nur noch die 7 Standard-Kacheln, kein Chip.
    await user.click(screen.getByRole('button', { name: de.zipView.chip.remove }));
    await waitFor(() => expect(tileButtons()).toHaveLength(7));
    expect(screen.queryByText(de.zipView.chip.label)).not.toBeInTheDocument();
  });

  it('verwirft die ZIP-Befunde beim Wechsel auf ein anderes Gerät', async () => {
    const user = userEvent.setup();
    await openExampleZip(user);
    await user.click(await screen.findByRole('button', { name: de.zipView.merge.action }));
    await waitFor(() => expect(tileButtons()).toHaveLength(11));

    const input = screen.getByRole('combobox', { name: de.field.label });
    await user.clear(input);
    await user.type(input, 'CONTOSO-PC001{Enter}');

    await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC001' });
    await waitFor(() => expect(tileButtons()).toHaveLength(7));
    expect(screen.queryByText(de.zipView.chip.label)).not.toBeInTheDocument();
  });

  it('analysiert eine über das Datei-Feld gewählte ZIP', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(screen.getByTestId('dropzone-input'), fixtureFile());

    expect(
      await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC042' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(tileButtons()).toHaveLength(4));
    expect(tile('win32Apps')).toBeInTheDocument();
    expect(await screen.findByText(de.zipView.merge.action)).toBeInTheDocument();
  });

  it('meldet Nicht-ZIP-Dateien in der Drop-Zone, ohne zu analysieren', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderApp();
    await user.upload(
      screen.getByTestId('dropzone-input'),
      new File(['x'], 'notizen.txt', { type: 'text/plain' }),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(de.dropZoneUi.notZip);
    expect(screen.getByRole('heading', { name: de.hero.title })).toBeInTheDocument();
  });

  it('zeigt bei einer ungültigen ZIP eine Fehlermeldung und führt zurück', async () => {
    const user = userEvent.setup();
    renderApp();
    await user.upload(
      screen.getByTestId('dropzone-input'),
      new File(['das ist kein zip'], 'kaputt.zip', { type: 'application/zip' }),
    );

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(de.zipView.errors.invalid);

    await user.click(within(alert).getByRole('button', { name: de.zipView.back }));
    expect(await screen.findByRole('heading', { name: de.hero.title })).toBeInTheDocument();
  });

  it('Browser-Zurück führt aus der ZIP-Ansicht zur Startseite', async () => {
    const user = userEvent.setup();
    await openExampleZip(user);
    await waitFor(() => expect(tileButtons()).toHaveLength(4));

    await act(async () => {
      window.history.back();
      await new Promise((r) => setTimeout(r, 30));
    });
    expect(await screen.findByRole('heading', { name: de.hero.title })).toBeInTheDocument();
  });

  it('„Andere Datei“ kehrt zur Startseite zurück', async () => {
    const user = userEvent.setup();
    await openExampleZip(user);
    await user.click(screen.getByRole('button', { name: de.zipView.back }));
    expect(await screen.findByRole('heading', { name: de.hero.title })).toBeInTheDocument();
  });

  it('nimmt eine auf die Seite gezogene ZIP an und zeigt dabei das Overlay', async () => {
    renderApp();
    const dataTransfer = { types: ['Files'], files: [fixtureFile()] };

    fireEvent.dragEnter(window, { dataTransfer });
    expect(await screen.findByTestId('drop-overlay')).toHaveTextContent(de.zipView.overlay.title);

    fireEvent.drop(window, { dataTransfer });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'CONTOSO-PC042' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('drop-overlay')).not.toBeInTheDocument());
  });

  it('meldet eine auf die Seite gezogene Nicht-ZIP-Datei als Fehler', async () => {
    renderApp();
    const file = new File(['x'], 'notizen.txt', { type: 'text/plain' });
    fireEvent.drop(window, { dataTransfer: { types: ['Files'], files: [file] } });
    expect(await screen.findByRole('alert')).toHaveTextContent(de.zipView.errors.notZip);
  });
});

describe('Ticket-Notiz mit ZIP-Befunden', () => {
  it('kopiert in der reinen ZIP-Ansicht eine Notiz im ZIP-Modus', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await openExampleZip(user);
    await waitFor(() => expect(tileButtons()).toHaveLength(4));

    await user.click(screen.getByRole('button', { name: de.ticket.button }));
    const note = writeText.mock.calls[0]![0];
    expect(note).toContain(de.rules.ticket.heading('CONTOSO-PC042'));
    expect(note).toContain(de.rules.ticket.modeZip);
    expect(note).toContain('0x80070642');
    writeText.mockRestore();
  });

  it('enthält nach dem Zusammenführen auch die ZIP-Kacheln', async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    await openExampleZip(user);
    await user.click(await screen.findByRole('button', { name: de.zipView.merge.action }));
    await waitFor(() => expect(tileButtons()).toHaveLength(11));

    const button = screen.getByRole('button', { name: de.ticket.button });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    const note = writeText.mock.calls[0]![0];
    expect(note).toContain(de.rules.ticket.modeDemo);
    expect(note).toContain(de.tiles.win32Apps);
    expect(note).toContain(de.tiles.compliance);
    writeText.mockRestore();
  });
});
