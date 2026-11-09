/**
 * Kleiner, toleranter XML-Leser für den Analyse-Worker (dort gibt es keinen DOMParser).
 * Liefert einen schlanken Elementbaum (Name, Attribute, Text, Kinder) mit harten Grenzen für
 * Elementzahl, Verschachtelung und Textlänge. Keine DTD-/Entity-Auflösung außer den fünf
 * Standard-Entities und numerischen Zeichenverweisen (DOCTYPE wird übersprungen).
 * Kein Validator: fehlerhaftes XML ergibt, was sich sinnvoll lesen lässt.
 */

export interface XmlElement {
  /** Qualifizierter Name wie im Dokument (mit Präfix, falls vorhanden) */
  name: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  /** Zusammengefasster, getrimmter Text (auf die Textgrenze gekürzt) */
  text: string;
}

export interface XmlLimits {
  /** Höchstzahl Elemente (Standard 200 000) */
  maxElements?: number;
  /** Höchste Verschachtelungstiefe (Standard 64) */
  maxDepth?: number;
  /** Höchste Textlänge je Element (Standard 2000 Zeichen) */
  maxTextLength?: number;
  /** Höchste Länge je Attributwert (Standard 1000 Zeichen) */
  maxAttrLength?: number;
}

export interface XmlParseResult {
  root: XmlElement | null;
  elementCount: number;
  /** Eine Grenze wurde erreicht, der Rest des Dokuments wurde nicht gelesen */
  truncated: boolean;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

function decodeEntities(value: string): string {
  if (!value.includes('&')) return value;
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    try {
      if (body.startsWith('#x') || body.startsWith('#X'))
        return String.fromCodePoint(parseInt(body.slice(2), 16));
      if (body.startsWith('#')) return String.fromCodePoint(parseInt(body.slice(1), 10));
    } catch {
      return whole;
    }
    return ENTITIES[body.toLowerCase()] ?? whole;
  });
}

const NAME_RE = /[^\s/>]+/y;
const ATTR_RE = /\s*([^\s=/>"']+)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;

/** Lokaler Name ohne Namensraum-Präfix. */
export function xmlLocalName(name: string): string {
  const colon = name.indexOf(':');
  return colon >= 0 ? name.slice(colon + 1) : name;
}

export function parseXmlLite(xml: string, limits: XmlLimits = {}): XmlParseResult {
  const maxElements = limits.maxElements ?? 200_000;
  const maxDepth = limits.maxDepth ?? 64;
  const maxText = limits.maxTextLength ?? 2000;
  const maxAttr = limits.maxAttrLength ?? 1000;

  let root: XmlElement | null = null;
  let rootClosed = false;
  let count = 0;
  let truncated = false;
  const stack: XmlElement[] = [];
  const length = xml.length;
  let i = xml.charCodeAt(0) === 0xfeff ? 1 : 0;

  const addText = (raw: string): void => {
    const top = stack[stack.length - 1];
    if (!top || top.text.length >= maxText) return;
    const piece = decodeEntities(raw).trim();
    if (piece === '') return;
    top.text = (top.text === '' ? piece : `${top.text} ${piece}`).slice(0, maxText);
  };

  while (i < length) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) {
      addText(xml.slice(i));
      break;
    }
    if (lt > i) addText(xml.slice(i, lt));
    i = lt;

    if (xml.startsWith('<!--', i)) {
      const end = xml.indexOf('-->', i + 4);
      i = end < 0 ? length : end + 3;
    } else if (xml.startsWith('<![CDATA[', i)) {
      const end = xml.indexOf(']]>', i + 9);
      const top = stack[stack.length - 1];
      const body = xml.slice(i + 9, end < 0 ? length : end);
      if (top && top.text.length < maxText) {
        const piece = body.trim();
        if (piece !== '')
          top.text = (top.text === '' ? piece : `${top.text} ${piece}`).slice(0, maxText);
      }
      i = end < 0 ? length : end + 3;
    } else if (xml.startsWith('<?', i)) {
      const end = xml.indexOf('?>', i + 2);
      i = end < 0 ? length : end + 2;
    } else if (xml.startsWith('<!', i)) {
      // DOCTYPE (ggf. mit internem Teilbereich in [ ]) – nicht ausgewertet
      let depth = 0;
      let j = i + 2;
      for (; j < length; j++) {
        const ch = xml[j];
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
        else if (ch === '>' && depth <= 0) break;
      }
      i = j + 1;
    } else if (xml.startsWith('</', i)) {
      const end = xml.indexOf('>', i + 2);
      const name = xml.slice(i + 2, end < 0 ? length : end).trim();
      i = end < 0 ? length : end + 1;
      for (let s = stack.length - 1; s >= 0; s--) {
        if (stack[s]!.name === name) {
          stack.length = s;
          break;
        }
      }
      if (stack.length === 0 && root) rootClosed = true;
    } else {
      NAME_RE.lastIndex = i + 1;
      const nameMatch = NAME_RE.exec(xml);
      if (!nameMatch) {
        i += 1;
        continue;
      }
      const element: XmlElement = { name: nameMatch[0], attrs: {}, children: [], text: '' };
      let j = i + 1 + nameMatch[0].length;
      for (;;) {
        ATTR_RE.lastIndex = j;
        const attr = ATTR_RE.exec(xml);
        if (!attr || attr.index !== j) break;
        j = ATTR_RE.lastIndex;
        element.attrs[attr[1]!] = decodeEntities(attr[2] ?? attr[3] ?? '').slice(0, maxAttr);
      }
      const close = xml.indexOf('>', j);
      const selfClosing = close > 0 && xml[close - 1] === '/';
      i = close < 0 ? length : close + 1;

      if (rootClosed) continue; // Inhalt nach dem Wurzelelement ignorieren
      if (count >= maxElements || stack.length >= maxDepth) {
        truncated = true;
        break;
      }
      count++;
      const parent = stack[stack.length - 1];
      if (parent) parent.children.push(element);
      else root ??= element;
      if (!selfClosing) stack.push(element);
      else if (stack.length === 0) rootClosed = true;
    }
  }
  return { root, elementCount: count, truncated };
}

/** Alle Nachfahren (Tiefensuche, Dokumentreihenfolge) mit lokalem Namen `name`. */
export function findXmlDescendants(root: XmlElement, localName: string): XmlElement[] {
  const found: XmlElement[] = [];
  const walk = (element: XmlElement): void => {
    for (const child of element.children) {
      if (xmlLocalName(child.name) === localName) found.push(child);
      walk(child);
    }
  };
  if (xmlLocalName(root.name) === localName) found.push(root);
  walk(root);
  return found;
}
