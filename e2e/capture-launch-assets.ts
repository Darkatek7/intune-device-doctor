/**
 * Rohmaterial für den Launch-Film (kein Teil der E2E-Abnahme, läuft nicht mit `playwright test`).
 *
 * Erzeugt im Demo-Modus mit fiktiven Contoso-Daten, jeweils Hell und Dunkel:
 * - clips/   60-fps-Clips einzelner Momente (H.264, 3840×2160 bei --dpr=2)
 * - stills/  Vollbilder der Endzustände
 * - cutouts/ freigestellte Elemente (Suchfeld, Kacheln, Sheet …) mit transparentem Hintergrund
 * - manifest.json  Liste aller Dateien mit Dauer und Beschreibung
 * Ausgabe: e2e-artifacts/launch/ (gitignored).
 *
 * Warum nicht `recordVideo`: Playwright zeichnet dort mit ca. 25 fps verlustbehaftet in VP8 auf.
 * Hier läuft die Seite stattdessen auf einer virtuellen Uhr (`page.clock`, steuert Timer, rAF,
 * performance.now); Web-Animationen (CSS-Übergänge, Motion/WAAPI) werden je Bild auf dieselbe
 * Zeit gesetzt. Jedes Bild ist ein Screenshot – bildgenau, ruckelfrei, in beliebiger Auflösung.
 *
 * Aufruf (ffmpeg im PATH für die MP4-Kodierung, sonst bleiben PNG-Sequenzen liegen):
 *   npm run capture:launch
 *   npm run capture:launch -- --only=05,07 --theme=dark --dpr=1.3334 --keep-frames
 * Läuft unter BASE_URL (Standard http://localhost:4174) schon ein Demo-Build, wird er genutzt;
 * sonst baut das Skript selbst (VITE_APP_MODE=demo) und startet `vite preview`.
 */
import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium, type Browser, type Locator, type Page } from '@playwright/test';
import { buildFixtureZip, FIXTURE_FILE_NAME } from '../src/diagnostics/fixture';

type Theme = 'light' | 'dark';

interface Options {
  only: string[] | null;
  themes: Theme[];
  dpr: number;
  fps: number;
  keepFrames: boolean;
  baseUrl: string;
  outDir: string;
}

function parseOptions(argv: string[]): Options {
  const get = (name: string) =>
    argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const theme = get('theme');
  return {
    only: get('only')?.split(',') ?? null,
    themes: theme === 'light' || theme === 'dark' ? [theme] : ['dark', 'light'],
    dpr: Number(get('dpr') ?? 2),
    fps: Number(get('fps') ?? 60),
    keepFrames: argv.includes('--keep-frames'),
    baseUrl: process.env.BASE_URL ?? 'http://localhost:4174',
    outDir: path.resolve('e2e-artifacts', 'launch'),
  };
}

const VIEWPORT = { width: 1920, height: 1080 } as const;
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Läuft vor jedem Seitenskript: Synchronisation der Web-Animationen mit der virtuellen Uhr und
 * ein Puffer für Worker-Nachrichten (der Analyse-Worker läuft in Echtzeit; ohne Puffer wäre die
 * Fortschrittsanzeige im Clip nur ein Blitz). Als String, da tsconfig.node.json kein DOM-Lib hat.
 */
const INIT_SCRIPT = `(() => {
  const seen = new WeakMap();
  window.__launchSync = (now) => {
    for (const animation of document.getAnimations()) {
      let state = seen.get(animation);
      if (!state) {
        // Motion setzt startTime nach der (virtuellen) Uhr – eine Startzeit „in der Zukunft“
        // ergäbe eine negative currentTime; solche Animationen beginnen jetzt.
        const current = typeof animation.currentTime === 'number' ? animation.currentTime : 0;
        state = { origin: now - Math.max(0, current), done: false };
        seen.set(animation, state);
      }
      if (state.done) continue;
      const elapsed = now - state.origin;
      const end = animation.effect ? animation.effect.getComputedTiming().endTime : 0;
      if (Number.isFinite(end) && elapsed >= end) {
        state.done = true;
        animation.finish();
      } else {
        animation.pause();
        animation.currentTime = elapsed;
      }
    }
  };

  window.__launchWorkerDelay = 0;
  const RealWorker = window.Worker;
  if (!RealWorker) return;
  let releaseAt = 0;
  window.Worker = class extends RealWorker {
    set onmessage(handler) {
      super.onmessage = handler && ((event) => {
        const delay = window.__launchWorkerDelay;
        if (!delay) return handler.call(this, event);
        releaseAt = Math.max(Date.now(), releaseAt) + delay;
        setTimeout(() => handler.call(this, event), releaseAt - Date.now());
      });
    }
    get onmessage() {
      return super.onmessage;
    }
  };
})()`;

/** Für Freisteller: Seitenhintergrund und Umgebungslicht ausblenden. */
const TRANSPARENT_CSS = `
  html, body, #root { background: transparent !important; }
  .ambient { display: none !important; }
`;

/** Bildgenauer Rekorder: virtuelle Zeit vorspulen, Animationen setzen, Screenshot. */
class Recorder {
  private frame = 0;
  private virtualMs = 0;
  private readonly frameMs: number;

  constructor(
    private readonly page: Page,
    private readonly dir: string,
    fps: number,
  ) {
    this.frameMs = 1000 / fps;
    mkdirSync(dir, { recursive: true });
  }

  get seconds(): number {
    return this.virtualMs / 1000;
  }

  /** Ein Bild: Uhr um ein Frame weiter, dann aufnehmen. */
  async step(): Promise<void> {
    const target = Math.round((this.frame + 1) * this.frameMs);
    await this.page.clock.runFor(target - this.virtualMs);
    this.virtualMs = target;
    await this.page.evaluate(`window.__launchSync(performance.now())`);
    this.frame++;
    await this.page.screenshot({
      // JPEG q95 statt PNG: bei 4K etwa doppelt so schnell, nach H.264 nicht unterscheidbar.
      path: path.join(this.dir, `frame-${String(this.frame).padStart(5, '0')}.jpg`),
      type: 'jpeg',
      quality: 95,
      caret: 'initial',
    });
  }

  /** Bilder für `ms` Millisekunden aufnehmen. */
  async hold(ms: number): Promise<void> {
    const frames = Math.round(ms / this.frameMs);
    for (let i = 0; i < frames; i++) await this.step();
  }

  /** Pro Bild eine Aktion ausführen (t = 0…1, mit Ease-in-out), z. B. Maus- oder Scrollfahrt. */
  async tween(ms: number, onFrame: (t: number) => Promise<void>): Promise<void> {
    const frames = Math.max(1, Math.round(ms / this.frameMs));
    for (let i = 1; i <= frames; i++) {
      const linear = i / frames;
      const eased = linear < 0.5 ? 4 * linear ** 3 : 1 - (-2 * linear + 2) ** 3 / 2;
      await onFrame(eased);
      await this.step();
    }
  }
}

interface Point {
  x: number;
  y: number;
}

async function centerOf(locator: Locator): Promise<Point> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Element nicht sichtbar: ${locator.toString()}`);
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Kachel über den Anfang ihres accessible name (wie e2e/helpers.ts, ohne Netzwerk-Fixture). */
function tile(page: Page, title: string): Locator {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return page.getByRole('button', { name: new RegExp(`^${escaped}`) });
}

/** Während der Aufnahme: Maus gleitend bewegen (Klicks ohne Actionability-Wartezeit). */
async function glide(rec: Recorder, page: Page, from: Point, to: Point, ms: number) {
  await rec.tween(ms, (t) =>
    page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t),
  );
}

async function click(rec: Recorder, page: Page, at: Point): Promise<void> {
  await page.mouse.move(at.x, at.y);
  await page.mouse.down();
  await rec.hold(70);
  await page.mouse.up();
}

/** Tippt Zeichen für Zeichen in natürlichem Rhythmus. */
async function typeSlowly(rec: Recorder, page: Page, text: string): Promise<void> {
  for (const [i, char] of [...text].entries()) {
    await page.keyboard.type(char);
    await rec.hold(char === '-' ? 160 : 70 + ((i * 37) % 50));
  }
}

/** Virtuelle Zeit ohne Aufnahme vorspulen; Web-Animationen laufen in Frame-Schritten mit. */
async function advance(page: Page, ms: number): Promise<void> {
  for (let done = 0; done < ms; done += 16) {
    await page.clock.runFor(16);
    await page.evaluate(`window.__launchSync(performance.now())`);
  }
}

/** Wartet in virtueller Zeit (ohne Aufnahme), bis die Bedingung gilt. */
async function advanceUntil(page: Page, condition: () => Promise<boolean>, maxMs = 8000) {
  for (let waited = 0; waited < maxMs; waited += 48) {
    if (await condition()) return;
    await advance(page, 48);
  }
  throw new Error('Zeitüberschreitung beim Warten auf den Zielzustand');
}

async function tilesReady(page: Page): Promise<boolean> {
  return (
    (await page.locator('button[data-tile-id]').count()) > 0 &&
    (await page.locator('[aria-busy="true"]').count()) === 0
  );
}

/** Scrollt den Sheet-Inhalt (erster scrollbarer Nachfahre des Dialogs) auf eine Position. */
const SCROLL_SHEET_SCRIPT = `(ratio) => {
  const dialog = document.querySelector('[role="dialog"]');
  if (!dialog) return;
  const scroller = [...dialog.querySelectorAll('*')].find(
    (el) => el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflowY !== 'visible',
  );
  if (scroller) scroller.scrollTop = (scroller.scrollHeight - scroller.clientHeight) * ratio;
}`;

/** Simuliert das Ziehen und Ablegen der Beispiel-ZIP auf die Seite. */
const DRAG_SCRIPT = `([type, name, base64]) => {
  if (!window.__launchTransfer) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const transfer = new DataTransfer();
    transfer.items.add(new File([bytes], name, { type: 'application/zip' }));
    window.__launchTransfer = transfer;
  }
  const event = new DragEvent(type, {
    bubbles: true,
    cancelable: true,
    dataTransfer: window.__launchTransfer,
  });
  document.body.dispatchEvent(event);
}`;

interface Moment {
  id: string;
  title: string;
  /** Vorbereitung ohne Aufnahme (Seite laden, Zustand herstellen) */
  setup: (page: Page) => Promise<void>;
  /** Aufnahme */
  record: (rec: Recorder, page: Page) => Promise<void>;
  /** Vollbilder am Ende des Moments */
  stills?: string[];
  /** Freisteller am Ende: Dateiname → Element */
  cutouts?: (page: Page) => Record<string, Locator>;
}

const searchField = (page: Page) => page.getByRole('combobox', { name: 'Gerätename' });

async function submitSearch(page: Page, device: string): Promise<void> {
  await searchField(page).fill(device);
  await searchField(page).press('Enter');
}

/** Demo-Gerät laden, ohne die Ladephase aufzunehmen. */
async function loadDevice(page: Page, device: string): Promise<void> {
  await submitSearch(page, device);
  await advanceUntil(page, () => tilesReady(page));
  await advance(page, 1500);
}

const PC014_TILES = [
  'Gerätestatus',
  'Compliance',
  'Letzter Check-in',
  'Betriebssystem',
  'BitLocker',
  'Defender',
  'Richtlinien',
];

function tileCutouts(page: Page, prefix: string, titles: string[]): Record<string, Locator> {
  return Object.fromEntries(
    titles.map((title) => [
      `${prefix}-tile-${title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/-$/, '')}`,
      tile(page, title),
    ]),
  );
}

async function scrollSheet(rec: Recorder, page: Page, ms: number): Promise<void> {
  await rec.tween(ms, (t) => page.evaluate(`(${SCROLL_SHEET_SCRIPT})(${t})`));
}

const MOMENTS: Moment[] = [
  {
    id: '01-start',
    title: 'Leere Startseite mit großem Suchfeld',
    setup: async () => {},
    record: (rec) => rec.hold(4000),
    stills: ['start'],
    cutouts: (page) => ({
      'search-field': page.getByRole('search'),
      'hero-glyph': page.locator('section .app-glyph'),
    }),
  },
  {
    id: '02-typing-pc014',
    title: 'CONTOSO-PC014 wird eingetippt, Vorschläge erscheinen',
    setup: async () => {},
    record: async (rec, page) => {
      const field = await centerOf(searchField(page));
      await rec.hold(600);
      await glide(rec, page, { x: field.x + 260, y: field.y + 220 }, field, 700);
      await click(rec, page, field);
      await rec.hold(300);
      await typeSlowly(rec, page, 'CONTOSO-PC014');
      await rec.hold(1200);
    },
    stills: ['typing-pc014'],
    cutouts: (page) => ({ 'search-field-typed': page.getByRole('search') }),
  },
  {
    id: '03-tiles-pc014',
    title: 'Enter: Platzhalter, dann fliegen die Kacheln gestaffelt ein',
    setup: async (page) => {
      await searchField(page).fill('CONTOSO-PC014');
    },
    record: async (rec, page) => {
      await rec.hold(300);
      await searchField(page).press('Enter');
      await rec.hold(4500);
    },
    stills: ['dashboard-pc014'],
    cutouts: (page) => ({
      ...tileCutouts(page, 'pc014', PC014_TILES),
      'pc014-grid': page.getByRole('list', { name: 'Statuskacheln' }),
    }),
  },
  {
    id: '04-bitlocker-critical',
    title: 'Rote BitLocker-Kachel: Maus fährt hin, Hover',
    setup: (page) => loadDevice(page, 'CONTOSO-PC014'),
    record: async (rec, page) => {
      const target = await centerOf(tile(page, 'BitLocker'));
      await rec.hold(500);
      await glide(rec, page, { x: VIEWPORT.width / 2, y: 150 }, target, 1100);
      await rec.hold(2000);
    },
    stills: ['bitlocker-hover'],
  },
  {
    id: '05-sheet-bitlocker',
    title: 'Detail-Sheet wächst aus der Kachel: Befund → Ursache → Lösung',
    setup: async (page) => {
      await loadDevice(page, 'CONTOSO-PC014');
      const target = await centerOf(tile(page, 'BitLocker'));
      await page.mouse.move(target.x, target.y);
    },
    record: async (rec, page) => {
      await rec.hold(400);
      await click(rec, page, await centerOf(tile(page, 'BitLocker')));
      await rec.hold(1800);
      await scrollSheet(rec, page, 3500);
      await rec.hold(1500);
    },
    stills: ['sheet-bitlocker'],
    cutouts: (page) => ({ 'sheet-bitlocker': page.getByRole('dialog') }),
  },
  {
    id: '06-pc042-conflict',
    title: 'CONTOSO-PC042: Richtlinienkonflikt, Sheet öffnet sich',
    setup: async (page) => {
      await searchField(page).fill('CONTOSO-PC042');
    },
    record: async (rec, page) => {
      await rec.hold(300);
      await searchField(page).press('Enter');
      await rec.hold(3200);
      const target = await centerOf(tile(page, 'Richtlinien'));
      await glide(rec, page, { x: VIEWPORT.width / 2, y: 200 }, target, 900);
      await rec.hold(300);
      await click(rec, page, target);
      await rec.hold(2000);
      await scrollSheet(rec, page, 3000);
      await rec.hold(1200);
    },
    stills: ['sheet-pc042'],
    cutouts: (page) => ({ 'sheet-pc042': page.getByRole('dialog') }),
  },
  {
    id: '07-zip-drop',
    title: 'DiagLogs-ZIP wird abgelegt, lokale Analyse, PRT-Befund',
    setup: async (page) => {
      await page.evaluate('window.__launchWorkerDelay = 450');
    },
    record: async (rec, page) => {
      const zip = Buffer.from(buildFixtureZip()).toString('base64');
      const drag = (type: string) =>
        page.evaluate(`(${DRAG_SCRIPT})(${JSON.stringify([type, FIXTURE_FILE_NAME, zip])})`);
      await rec.hold(600);
      await drag('dragenter');
      await drag('dragover');
      await rec.hold(1300);
      await drag('drop');
      await advanceAndRecordUntil(rec, () => tilesReady(page), 9000);
      await rec.hold(2500);
      const target = await centerOf(tile(page, 'Entra-Join & PRT'));
      await glide(rec, page, { x: VIEWPORT.width / 2, y: 200 }, target, 900);
      await click(rec, page, target);
      await rec.hold(2200);
      await scrollSheet(rec, page, 2500);
      await rec.hold(1000);
    },
    stills: ['zip-prt'],
    cutouts: (page) => ({ 'sheet-prt': page.getByRole('dialog') }),
  },
  {
    id: '08-pc050-permissions',
    title: 'CONTOSO-PC050: fehlende Berechtigung, Dashboard bleibt nutzbar',
    setup: async (page) => {
      await searchField(page).fill('CONTOSO-PC050');
    },
    record: async (rec, page) => {
      await rec.hold(300);
      await searchField(page).press('Enter');
      await rec.hold(4500);
    },
    stills: ['permissions-pc050'],
  },
  {
    id: '09-healthy-pc001',
    title: 'CONTOSO-PC001: alles grün (Finale)',
    setup: async (page) => {
      await searchField(page).fill('CONTOSO-PC001');
    },
    record: async (rec, page) => {
      await rec.hold(300);
      await searchField(page).press('Enter');
      await rec.hold(7500);
    },
    stills: ['healthy-pc001'],
    cutouts: (page) => ({
      ...tileCutouts(page, 'pc001', PC014_TILES),
      'pc001-grid': page.getByRole('list', { name: 'Statuskacheln' }),
    }),
  },
];

/** Aufnehmen, bis die Bedingung gilt (z. B. Analyse fertig). */
async function advanceAndRecordUntil(
  rec: Recorder,
  condition: () => Promise<boolean>,
  maxMs: number,
) {
  const start = rec.seconds;
  while (!(await condition())) {
    if ((rec.seconds - start) * 1000 > maxMs)
      throw new Error('Zeitüberschreitung bei der Aufnahme');
    await rec.step();
  }
}

/** Ausschnitt um ein Element mit Rand (Schatten bleiben erhalten), transparenter Hintergrund. */
async function cutout(page: Page, locator: Locator, file: string): Promise<void> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`Freisteller nicht sichtbar: ${file}`);
  const margin = 48;
  const x = Math.max(0, box.x - margin);
  const y = Math.max(0, box.y - margin);
  await page.screenshot({
    path: file,
    omitBackground: true,
    clip: {
      x,
      y,
      width: Math.min(VIEWPORT.width - x, box.width + 2 * margin),
      height: Math.min(VIEWPORT.height - y, box.height + 2 * margin),
    },
  });
}

function encode(framesDir: string, fps: number, out: string): boolean {
  const result = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-loglevel',
      'error',
      '-framerate',
      String(fps),
      '-i',
      path.join(framesDir, 'frame-%05d.jpg'),
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '12',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      out,
    ],
    { stdio: 'inherit' },
  );
  return result.status === 0;
}

interface ManifestEntry {
  moment: string;
  theme: Theme;
  title: string;
  clip: string | null;
  frames: string | null;
  seconds: number;
  stills: string[];
  cutouts: string[];
}

async function captureMoment(
  browser: Browser,
  moment: Moment,
  theme: Theme,
  opts: Options,
): Promise<ManifestEntry> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: opts.dpr,
    colorScheme: theme,
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin',
  });
  const page = await context.newPage();

  // Wie e2e/helpers.ts: nur localhost und nur GET – Live-Endpunkte sind unerreichbar.
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const web = url.protocol === 'http:' || url.protocol === 'https:';
    if (web && (!LOCAL_HOSTS.has(url.hostname) || request.method() !== 'GET')) await route.abort();
    else await route.fallback();
  });
  await page.addInitScript(`localStorage.setItem('mdm-doctor.theme', ${JSON.stringify(theme)});`);
  await page.addInitScript(INIT_SCRIPT);
  await page.clock.install({ time: new Date('2026-10-15T09:41:00+02:00') });
  await page.goto(opts.baseUrl);
  await searchField(page).waitFor();
  await page.clock.pauseAt(new Date('2026-10-15T09:41:05+02:00'));
  await advance(page, 800);
  await moment.setup(page);

  const base = path.join(opts.outDir, theme);
  const framesDir = path.join(base, 'frames', moment.id);
  rmSync(framesDir, { recursive: true, force: true });
  const rec = new Recorder(page, framesDir, opts.fps);
  await moment.record(rec, page);

  const stills: string[] = [];
  mkdirSync(path.join(base, 'stills'), { recursive: true });
  for (const name of moment.stills ?? []) {
    const file = path.join(base, 'stills', `${name}.png`);
    await page.screenshot({ path: file });
    stills.push(path.relative(opts.outDir, file));
  }

  const cutouts: string[] = [];
  const targets = moment.cutouts?.(page);
  if (targets) {
    mkdirSync(path.join(base, 'cutouts'), { recursive: true });
    await page.addStyleTag({ content: TRANSPARENT_CSS });
    await page.evaluate(`window.__launchSync(performance.now())`);
    for (const [name, locator] of Object.entries(targets)) {
      const file = path.join(base, 'cutouts', `${name}.png`);
      await cutout(page, locator, file);
      cutouts.push(path.relative(opts.outDir, file));
    }
  }
  await context.close();

  mkdirSync(path.join(base, 'clips'), { recursive: true });
  const clip = path.join(base, 'clips', `${moment.id}.mp4`);
  const encoded = encode(framesDir, opts.fps, clip);
  if (encoded && !opts.keepFrames) rmSync(framesDir, { recursive: true, force: true });

  return {
    moment: moment.id,
    theme,
    title: moment.title,
    clip: encoded ? path.relative(opts.outDir, clip) : null,
    frames: encoded && !opts.keepFrames ? null : path.relative(opts.outDir, framesDir),
    seconds: rec.seconds,
    stills,
    cutouts,
  };
}

async function reachable(url: string): Promise<boolean> {
  try {
    return (await fetch(url)).ok;
  } catch {
    return false;
  }
}

async function startServer(baseUrl: string): Promise<ChildProcess | null> {
  if (await reachable(baseUrl)) return null;
  const env = { ...process.env, VITE_APP_MODE: 'demo' };
  const build = spawnSync('npx', ['vite', 'build'], { stdio: 'inherit', env });
  if (build.status !== 0) throw new Error('Build fehlgeschlagen');
  const port = new URL(baseUrl).port || '4174';
  const server = spawn('npx', ['vite', 'preview', '--port', port, '--strictPort'], {
    env,
    stdio: 'ignore',
  });
  for (let i = 0; i < 100 && !(await reachable(baseUrl)); i++)
    await new Promise((r) => setTimeout(r, 200));
  if (!(await reachable(baseUrl)))
    throw new Error(`Preview-Server unter ${baseUrl} nicht erreichbar`);
  return server;
}

async function main(): Promise<void> {
  const opts = parseOptions(process.argv.slice(2));
  const moments = MOMENTS.filter((m) => !opts.only || opts.only.some((id) => m.id.startsWith(id)));
  const server = await startServer(opts.baseUrl);
  const browser = await chromium.launch();
  const manifest: ManifestEntry[] = [];
  try {
    for (const theme of opts.themes) {
      for (const moment of moments) {
        const started = Date.now();
        const entry = await captureMoment(browser, moment, theme, opts);
        manifest.push(entry);
        console.log(
          `✓ ${theme} ${moment.id} – ${entry.seconds.toFixed(1)} s Clip (${((Date.now() - started) / 1000).toFixed(0)} s Aufnahme)`,
        );
      }
    }
  } finally {
    await browser.close();
    server?.kill();
  }
  // Teilläufe (--only/--theme) ergänzen das bestehende Manifest statt es zu ersetzen.
  mkdirSync(opts.outDir, { recursive: true });
  const manifestFile = path.join(opts.outDir, 'manifest.json');
  const previous: ManifestEntry[] = existsSync(manifestFile)
    ? (JSON.parse(readFileSync(manifestFile, 'utf8')) as { entries: ManifestEntry[] }).entries
    : [];
  const entries = [
    ...previous.filter((p) => !manifest.some((m) => m.moment === p.moment && m.theme === p.theme)),
    ...manifest,
  ].sort((a, b) => a.theme.localeCompare(b.theme) || a.moment.localeCompare(b.moment));
  writeFileSync(
    manifestFile,
    JSON.stringify({ viewport: VIEWPORT, dpr: opts.dpr, fps: opts.fps, entries }, null, 2),
  );
  console.log(`Fertig: ${manifest.length} Momente → ${opts.outDir}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
