/** Minimale Typen für die wenigen DOM-Zugriffe der Quellenprüfung (`jsdom` bringt keine eigenen mit). */
declare module 'jsdom' {
  export interface DomElement {
    id: string;
    textContent: string | null;
    querySelectorAll(selector: string): Iterable<DomElement>;
    querySelector(selector: string): DomElement | null;
    getAttribute(name: string): string | null;
    cloneNode(deep?: boolean): DomElement;
    remove(): void;
  }
  export interface DomDocument {
    querySelectorAll(selector: string): Iterable<DomElement>;
    querySelector(selector: string): DomElement | null;
  }
  export class JSDOM {
    constructor(html?: string);
    window: { document: DomDocument };
  }
}
