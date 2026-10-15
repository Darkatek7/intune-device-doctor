import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { buildFixtureZip, FIXTURE_FILE_NAME } from '../diagnostics/fixture';
import { de } from '../i18n/de';
import { useDiagnosticsAnalysis } from './useDiagnosticsAnalysis';

const fixtureFile = (): File =>
  new File([new Uint8Array(buildFixtureZip())], FIXTURE_FILE_NAME, { type: 'application/zip' });

describe('useDiagnosticsAnalysis', () => {
  it('startet im Zustand idle', () => {
    const { result } = renderHook(() => useDiagnosticsAnalysis());
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('analysiert das Fixture und liefert Report und Dateiname', async () => {
    const { result } = renderHook(() => useDiagnosticsAnalysis());
    act(() => {
      void result.current.analyze(fixtureFile());
    });
    expect(result.current.state.status).toBe('running');
    expect(result.current.state.fileName).toBe(FIXTURE_FILE_NAME);

    await waitFor(() => expect(result.current.state.status).toBe('done'));
    expect(result.current.state.report?.deviceNameFromFile).toBe('CONTOSO-PC042');
  });

  it('lehnt Dateien ohne .zip-Endung ohne Analyse ab', async () => {
    const { result } = renderHook(() => useDiagnosticsAnalysis());
    await act(async () => {
      await result.current.analyze(new File(['x'], 'notizen.txt'));
    });
    expect(result.current.state).toMatchObject({
      status: 'error',
      error: de.zipView.errors.notZip,
      fileName: 'notizen.txt',
    });
  });

  it('meldet „keine gültige DiagLogs-ZIP“, wenn die Analyse wirft oder nichts erkennt', async () => {
    const { result } = renderHook(() => useDiagnosticsAnalysis());
    await act(async () => {
      await result.current.analyze(new File(['kein zip'], 'a.zip'));
    });
    expect(result.current.state.error).toBe(de.zipView.errors.invalid);
  });

  it('reset/cancel setzen auf idle zurück und verwerfen laufende Ergebnisse', async () => {
    const { result } = renderHook(() => useDiagnosticsAnalysis());
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.analyze(fixtureFile());
    });
    act(() => result.current.cancel());
    await act(async () => {
      await pending;
    });
    expect(result.current.state).toEqual({ status: 'idle' });
  });

  it('eine neue Datei ersetzt die vorherige Analyse', async () => {
    const { result } = renderHook(() => useDiagnosticsAnalysis());
    act(() => {
      void result.current.analyze(new File(['kein zip'], 'erste.zip'));
    });
    act(() => {
      void result.current.analyze(fixtureFile());
    });
    await waitFor(() => expect(result.current.state.status).toBe('done'));
    expect(result.current.state.fileName).toBe(FIXTURE_FILE_NAME);
  });
});
