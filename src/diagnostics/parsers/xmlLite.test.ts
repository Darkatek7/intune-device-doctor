import { describe, expect, it } from 'vitest';
import { findXmlDescendants, parseXmlLite, xmlLocalName } from './xmlLite';

describe('parseXmlLite', () => {
  it('liest Elemente, Attribute, Text und Kinder', () => {
    const { root, elementCount, truncated } = parseXmlLite(
      '<?xml version="1.0" encoding="utf-8"?>\n<!-- Kommentar -->\n' +
        '<Report Version="1"><Item Id="a" Name=\'B &amp; C\'>Text &lt;1&gt;</Item><Empty/></Report>',
    );
    expect(truncated).toBe(false);
    expect(elementCount).toBe(3);
    expect(root?.name).toBe('Report');
    expect(root?.attrs).toEqual({ Version: '1' });
    const [item, empty] = root!.children;
    expect(item?.attrs).toEqual({ Id: 'a', Name: 'B & C' });
    expect(item?.text).toBe('Text <1>');
    expect(empty?.name).toBe('Empty');
    expect(empty?.children).toEqual([]);
  });

  it('überspringt BOM, DOCTYPE mit Teilbereich, CDATA und Verarbeitungsanweisungen', () => {
    const xml =
      '﻿<?xml version="1.0"?><!DOCTYPE r [<!ENTITY x "y">]><r><![CDATA[<roh> & so]]><a>1</a></r>';
    const { root } = parseXmlLite(xml);
    expect(root?.name).toBe('r');
    expect(root?.text).toBe('<roh> & so');
    expect(root?.children.map((c) => c.name)).toEqual(['a']);
  });

  it('löst nur Standard-Entities und Zeichenverweise auf (keine eigenen Entities)', () => {
    const { root } = parseXmlLite('<r a="&#65;&#x42;&unbekannt;">&quot;&apos;&#x1F600;</r>');
    expect(root?.attrs['a']).toBe('AB&unbekannt;');
    expect(root?.text).toBe('"\'😀');
  });

  it('Namensräume: lokaler Name; Inhalt nach dem Wurzelelement wird ignoriert', () => {
    const { root } = parseXmlLite('<ns:Root xmlns:ns="urn:x"><ns:A/></ns:Root><Extra/>');
    expect(xmlLocalName(root!.name)).toBe('Root');
    expect(findXmlDescendants(root!, 'A')).toHaveLength(1);
  });

  it('tolerant gegenüber fehlerhaftem XML (fehlende Endtags, abgeschnitten)', () => {
    const { root } = parseXmlLite('<r><a><b>x</a><c>y');
    expect(root?.children.map((c) => c.name)).toEqual(['a', 'c']);
    expect(root?.children[1]?.text).toBe('y');
    expect(parseXmlLite('kein xml').root).toBeNull();
    expect(parseXmlLite('').root).toBeNull();
  });

  it('Grenzen: Elementzahl, Tiefe, Textlänge und Attributlänge', () => {
    const many = `<r>${'<a/>'.repeat(50)}</r>`;
    const capped = parseXmlLite(many, { maxElements: 10 });
    expect(capped.truncated).toBe(true);
    expect(capped.elementCount).toBe(10);
    expect(capped.root?.children).toHaveLength(9);

    const deep = parseXmlLite(`${'<a>'.repeat(100)}${'</a>'.repeat(100)}`, { maxDepth: 5 });
    expect(deep.truncated).toBe(true);
    expect(deep.elementCount).toBe(5);

    const long = parseXmlLite(`<r v="${'x'.repeat(50)}">${'y'.repeat(50)}</r>`, {
      maxTextLength: 10,
      maxAttrLength: 20,
    });
    expect(long.root?.text).toHaveLength(10);
    expect(long.root?.attrs['v']).toHaveLength(20);
  });

  it('findXmlDescendants liefert Treffer in Dokumentreihenfolge, auch die Wurzel selbst', () => {
    const { root } = parseXmlLite('<M n="0"><x><M n="1"/></x><M n="2"><M n="3"/></M></M>');
    expect(findXmlDescendants(root!, 'M').map((e) => e.attrs['n'])).toEqual(['0', '1', '2', '3']);
  });

  it('verarbeitet große flache Dokumente in kurzer Zeit', () => {
    const xml = `<r>${'<item id="1" name="Beispiel">wert</item>'.repeat(60_000)}</r>`;
    const started = performance.now();
    const { root, elementCount } = parseXmlLite(xml);
    expect(root?.children).toHaveLength(60_000);
    expect(elementCount).toBe(60_001);
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
