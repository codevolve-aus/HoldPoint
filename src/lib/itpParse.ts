/*
 * Reads an ITP's header and items from text with positions (PDF) or from table rows (Word).
 * Pure functions: no browser APIs, so they can be tested in Node.
 *
 * Every result is a draft: the engineer checks it side by side with the original before publishing.
 */

export interface TextItem { str: string; x: number; y: number; w: number } // y from the top of the page
export interface VLine { x: number; y0: number; y1: number } // y from the top of the page
export interface PageText { width: number; height: number; items: TextItem[]; vlines: VLine[] }

export interface ParsedItem {
  no: number;
  activity: string;
  spec: string;
  reference: string;
  criteria: string;
  inspectedBy: string[];
  type: string;
  formRefs: string[];        // forms named in the reference column, normalised, e.g. QF-20b
  mentionedRefs: string[];   // forms named only in the activity or criteria text
}

export interface ParsedItp {
  header: { client: string; project: string; itemName: string; jobNo: string; responsible: string; authorisedBy: string; locationRef: string; docId: string; rev: string; date: string };
  items: ParsedItem[];
  notes: string[];
  warnings: string[];
}

type Col = 'no' | 'activity' | 'spec' | 'reference' | 'criteria' | 'by' | 'sign' | 'date' | 'type';

const COL_WORDS: [Col, RegExp][] = [
  ['no', /^(no\.?|item)$/i],
  ['activity', /activity|operation/i],
  ['spec', /specification/i],
  ['reference', /reference/i],
  ['criteria', /acceptance|criteria/i],
  ['by', /inspection\s*by|^by$/i],
  ['sign', /^sign/i],
  ['date', /^date$/i],
  ['type', /type/i]
];

/* ---------- helpers ---------- */

export function normaliseFormRef(s: string): string | null {
  const m = /QF\s*[-.]?\s*(\d{1,3})\s*([a-z])?\b/i.exec(s);
  return m ? `QF-${m[1]}${(m[2] || '').toLowerCase()}` : null;
}

export function formRefsIn(text: string): string[] {
  const out = new Set<string>();
  const re = /(?:Form\s*)?QF\s*[-.]?\s*\d{1,3}\s*[a-z]?\b/gi;
  for (const m of text.match(re) || []) { const n = normaliseFormRef(m); if (n && !/QF-0?1$/.test(n)) out.add(n); }
  return [...out];
}

/** Split "McElligotts Supervision John Holland Representative" into parties. */
export function splitParties(s: string): string[] {
  const t = s.replace(/\s+/g, ' ').trim();
  if (!t) return [];
  const parts = t.split(/(?<=\b(?:Supervision|Representative|Rep\.?|Inspector|Engineer|Supervisor|Release))\s+/i).map((x) => x.trim()).filter(Boolean);
  return parts.length ? parts : [t];
}

export function cleanType(s: string): string {
  const t = s.toUpperCase().replace(/[^HWM]/g, '');
  return t || s.trim();
}

/** Joins text pieces on one line, adding a space only where there's a visible gap. */
function joinLine(items: TextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let out = ''; let end = -1e9;
  for (const it of sorted) {
    const gap = it.x - end;
    if (out && gap > 1.2 && !out.endsWith(' ') && !it.str.startsWith(' ')) out += ' ';
    out += it.str; end = it.x + it.w;
  }
  return out.replace(/\s+/g, ' ').trim();
}

function groupLines(items: TextItem[], tol = 3): TextItem[][] {
  const sorted = [...items].filter((i) => i.str.trim()).sort((a, b) => a.y - b.y || a.x - b.x);
  const lines: TextItem[][] = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last[0].y - it.y) <= tol) last.push(it); else lines.push([it]);
  }
  return lines;
}

/** Turns wrapped cell lines back into paragraphs; keeps breaks before bullets and after full stops. */
function cellText(items: TextItem[]): string {
  const lines = groupLines(items, 4).map(joinLine).filter(Boolean);
  let out = '';
  for (const l of lines) {
    if (!out) { out = l; continue; }
    const brk = /[.:]$/.test(out) || /^[-•–]\s/.test(l) || /^[-•–]/.test(l) || /^(RECORD|CHECK |NOTE|TAKE|WFT\s*=|DFT\s*=|AS2700|HOLIDAY)/.test(l) || (/^[A-Z0-9 &/(),.-]{6,}$/.test(l) && !/^[A-Z0-9 &/(),.-]{6,}$/.test(out.split('\n').pop() || ''));
    out += (brk ? '\n' : ' ') + l;
  }
  return out.replace(/ +\n/g, '\n').replace(/\s+-\s+(?=[a-z])/g, '-').trim();
}

/* ---------- PDF ---------- */

const HEADER_LABELS: [keyof ParsedItp['header'], RegExp][] = [
  ['client', /CLIENT\s*:/i],
  ['project', /PROJECT\s*:/i],
  ['itemName', /ITEM\s*NAME\s*:/i],
  ['locationRef', /LOCATION\s*REF\.?\s*:/i],
  ['date', /(?<!REV\s)\bDATE\s*:/i],
  ['jobNo', /JOB\s*(?:NUMBER|NO\.?)\s*:/i],
  ['responsible', /RESPONSIBLE\s*PERSON\s*:/i],
  ['authorisedBy', /AUTHORI[SZ]ATION\s*OF\s*ITP\s*:/i],
  ['docId', /DOCUMENT\s*ID\s*:/i]
];

function readHeader(lines: string[]): ParsedItp['header'] {
  const h: ParsedItp['header'] = { client: '', project: '', itemName: '', jobNo: '', responsible: '', authorisedBy: '', locationRef: '', docId: '', rev: '', date: '' };
  for (const line of lines) {
    const hits: { key: keyof ParsedItp['header']; start: number; end: number }[] = [];
    for (const [key, re] of HEADER_LABELS) {
      const g = new RegExp(re.source, 'gi'); let m: RegExpExecArray | null;
      while ((m = g.exec(line))) hits.push({ key, start: m.index, end: m.index + m[0].length });
    }
    hits.sort((a, b) => a.start - b.start);
    hits.forEach((hit, i) => {
      const val = line.slice(hit.end, i + 1 < hits.length ? hits[i + 1].start : undefined).trim();
      if (val && !h[hit.key]) h[hit.key] = val;
    });
  }
  const rev = /(Revision|Rev\.?)\s*([0-9A-Z.]+)/i.exec(h.docId);
  if (rev) { h.rev = `Rev ${rev[2]}`; h.docId = h.docId.slice(0, rev.index).trim(); }
  h.docId = h.docId.replace(/\s*-\s*/g, '-');
  h.date = h.date.replace(/\s*-\s*/g, '-');
  return h;
}

/** Column x-edges from the table's vertical border lines (repeated on most rows). */
function columnEdges(page: PageText, headerItems: TextItem[], tableTop: number): { col: Col; x0: number; x1: number }[] | null {
  // only borders inside the table, and only x positions that repeat on 2+ rows
  const count = new Map<number, number>();
  page.vlines.filter((l) => l.y1 > tableTop + 2).forEach((l) => { const x = Math.round(l.x); count.set(x, (count.get(x) || 0) + 1); });
  const xs = [...count.entries()].filter(([, n]) => n >= 2).map(([x]) => x).sort((a, b) => a - b);
  // merge borders within 4pt (double lines)
  const edges: number[] = [];
  for (const x of xs) if (!edges.length || x - edges[edges.length - 1] > 4) edges.push(x);
  if (edges.length < 4) return null;
  const cols: { col: Col; x0: number; x1: number }[] = [];
  for (let i = 0; i < edges.length - 1; i++) {
    const x0 = edges[i], x1 = edges[i + 1];
    const words = joinLine(headerItems.filter((t) => t.x + t.w / 2 > x0 && t.x + t.w / 2 < x1));
    const hit = COL_WORDS.find(([, re]) => re.test(words));
    if (hit && !cols.some((c) => c.col === hit[0])) cols.push({ col: hit[0], x0, x1 });
  }
  return cols.length >= 4 ? cols : null;
}

/** Fallback when there are no borders: split halfway between header word centres. */
function columnsFromHeader(headerItems: TextItem[], width: number): { col: Col; x0: number; x1: number }[] {
  const found: { col: Col; cx: number }[] = [];
  for (const line of groupLines(headerItems, 14)) {
    for (const it of line) {
      const hit = COL_WORDS.find(([, re]) => re.test(it.str.trim()));
      if (hit && !found.some((f) => f.col === hit[0])) found.push({ col: hit[0], cx: it.x + it.w / 2 });
    }
  }
  found.sort((a, b) => a.cx - b.cx);
  return found.map((f, i) => ({ col: f.col, x0: i ? (found[i - 1].cx + f.cx) / 2 : 0, x1: i + 1 < found.length ? (f.cx + found[i + 1].cx) / 2 : width }));
}

export function parseItpPages(pages: PageText[]): ParsedItp {
  const warnings: string[] = [];
  let header: ParsedItp['header'] | null = null;
  const notes: string[] = [];
  const cells = new Map<number, Record<Col, TextItem[]>>();
  let current = -1;

  let lastCols: { col: Col; x0: number; x1: number }[] | null = null;
  pages.forEach((page, pi) => {
    // every heading row on the page (a page can hold the end of one table and the start of another)
    const hdrs = page.items.filter((t) => /^activity/i.test(t.str.trim()) && page.items.some((u) => Math.abs(u.y - t.y) < 3 && /specification|acceptance/i.test(u.str)));
    const hdr = hdrs[0];
    const lines = groupLines(page.items).map(joinLine);
    if (!header) header = readHeader(lines.filter((l) => /:/.test(l)).slice(0, 12));

    // Notes / comments anywhere on the page (usually the last page)
    for (const l of lines) if (/^note\s*\d+\s*:/i.test(l)) notes.push(l);
    if (notes.length) {
      // join continuation lines of notes
      const all = lines; for (let i = 0; i < all.length; i++) if (/^note\s*\d+\s*:/i.test(all[i])) {
        let s = all[i]; let j = i + 1;
        while (j < all.length && !/^(note\s*\d+\s*:|h\s*=|\s*$)/i.test(all[j]) && !/^(CONTRACTOR|CLIENT|NAME|SIGN|DATE|Rev Date|Authorised)/i.test(all[j])) { s += ' ' + all[j]; j++; }
        const idx = notes.findIndex((n) => n.startsWith(all[i].slice(0, 7))); if (idx >= 0) notes[idx] = s.replace(/\s+/g, ' ');
      }
    }
    if (!hdr && !lastCols) return;

    let cols = lastCols!;
    if (hdr) {
      // heading row: the line with "Activity" plus a second wrapped heading line just under it
      const headerItems = page.items.filter((t) => t.y >= hdr.y - 3 && t.y <= hdr.y + 16 && t.str.trim());
      const edges = columnEdges(page, headerItems, hdr.y - 12);
      cols = edges || columnsFromHeader(headerItems, page.width);
      if (!edges && pi === 0) warnings.push('No table borders found: columns were estimated from the headings. Check the text in each column.');
      lastCols = cols;
    }
    const inHeading = (t: TextItem) => hdrs.some((h) => t.y >= h.y - 3 && t.y <= h.y + 16);
    // the document header block (CLIENT, PROJECT, ITEM NAME…) sits above the table on every page
    const firstHeading = hdr ? hdr.y - 3 : page.height / 3;
    const labelYs = page.items.filter((t) => /^(CLIENT|PROJECT|ITEM NAME|JOB NUMBER|RESPONSIBLE|AUTHORI|DOCUMENT|DATE)/.test(t.str.trim()) && t.y < firstHeading).map((t) => t.y);
    const headerBottom = labelYs.length ? Math.max(...labelYs) + 8 : 0;
    const stopYs = page.items.filter((t) => (/^(Comments?\s*:|Note\s*\d+\s*:?|H\s*=\s*Hold)/i.test(t.str.trim()) && t.x < page.width / 4) || /^(ITP\s*SIGN|Responsible inspectorates)/i.test(t.str.trim())).map((t) => t.y);
    const footerTop = Math.min(...page.items.filter((t) => /Rev\s*Date|Authorised By/i.test(t.str)).map((t) => t.y), ...stopYs, page.height) - 4;
    const colOf = (t: TextItem): Col | null => { const cx = t.x + Math.min(t.w, 20) / 2; const c = cols.find((k) => cx >= k.x0 - 1 && cx < k.x1 + 1); return c ? c.col : null; };

    const body = page.items.filter((t) => t.y > headerBottom && t.y < footerTop && t.str.trim() && !inHeading(t));
    const noCol = cols.find((c) => c.col === 'no');
    const starts = body.filter((t) => noCol && colOf(t) === 'no' && /^\d{1,3}\.?$/.test(t.str.trim())).sort((a, b) => a.y - b.y);
    for (const t of body.sort((a, b) => a.y - b.y)) {
      const s = starts.filter((st) => st.y <= t.y + 5).pop();
      if (s) current = parseInt(s.str, 10);
      if (current < 0) continue;
      const col = colOf(t); if (!col || col === 'no') continue;
      if (!cells.has(current)) cells.set(current, { no: [], activity: [], spec: [], reference: [], criteria: [], by: [], sign: [], date: [], type: [] });
      // offset y by page so lines from different pages don't merge
      cells.get(current)![col].push({ ...t, y: t.y + pi * 10000 });
    }
  });

  const items: ParsedItem[] = [...cells.entries()].sort((a, b) => a[0] - b[0]).map(([no, c]) => {
    const reference = cellText(c.reference);
    const activity = cellText(c.activity);
    const criteria = cellText(c.criteria);
    const formRefs = formRefsIn(reference);
    const mentioned = formRefsIn(activity + ' ' + criteria).filter((r) => !formRefs.includes(r));
    return {
      no, activity, spec: cellText(c.spec), criteria, formRefs, mentionedRefs: mentioned,
      reference: reference.split('\n').map((l) => l.trim()).filter((l) => l && !/^Form\s*QF/i.test(l)).join('\n').replace(/Form\s*QF\s*[-.]?\s*\d+\s*[a-z]?\b/gi, '').trim(),
      inspectedBy: splitParties(cellText(c.by).replace(/\n/g, ' ')),
      type: cleanType(cellText(c.type))
    };
  });

  if (!items.length) warnings.push('No ITP items were found. Check the file is the ITP table, or add the items by hand.');
  const nums = items.map((i) => i.no);
  for (let n = 1; n <= Math.max(0, ...nums); n++) if (!nums.includes(n)) warnings.push(`Item ${n} wasn't found. Add it by hand if it exists.`);
  items.forEach((i) => { if (!i.activity) warnings.push(`Item ${i.no}: no activity text was read.`); if (!/^[HWM]+$/.test(i.type)) warnings.push(`Item ${i.no}: inspection type "${i.type || 'blank'}" isn't H, W or M.`); });

  return { header: header || readHeader([]), items, notes: [...new Set(notes)], warnings };
}

/* ---------- Word (.docx converted to HTML rows) ---------- */

/** rows: every table row as an array of cell texts (from mammoth's HTML). headerLines: paragraphs/rows above the table. */
export function parseItpRows(rows: string[][], headerLines: string[]): ParsedItp {
  const warnings: string[] = [];
  const hIdx = rows.findIndex((r) => r.some((c) => /activity/i.test(c)) && r.some((c) => /acceptance|criteria/i.test(c)));
  const header = readHeader(headerLines.concat(rows.slice(0, Math.max(0, hIdx)).map((r) => r.join('  '))));
  const notes = headerLines.concat(rows.flat()).filter((l) => /^note\s*\d+\s*:/i.test(l.trim())).map((l) => l.trim());
  if (hIdx < 0) return { header, items: [], notes, warnings: ['The ITP table heading row (Activity, Acceptance Criteria) wasn\'t found.'] };
  const map: Partial<Record<Col, number>> = {};
  rows[hIdx].forEach((c, i) => { const hit = COL_WORDS.find(([, re]) => re.test(c.trim())); if (hit && map[hit[0]] === undefined) map[hit[0]] = i; });
  if (map.no === undefined) map.no = 0;
  const items: ParsedItem[] = [];
  for (const r of rows.slice(hIdx + 1)) {
    const n = parseInt((r[map.no!] || '').trim(), 10);
    if (Number.isNaN(n)) {
      // continuation row (item split over a page break in Word)
      const last = items[items.length - 1];
      if (last && r.some((c) => c.trim())) {
        const add = (k: Col) => (map[k] !== undefined ? (r[map[k]!] || '').trim() : '');
        if (add('activity')) last.activity += '\n' + add('activity');
        if (add('criteria')) last.criteria += '\n' + add('criteria');
      }
      continue;
    }
    const get = (k: Col) => (map[k] !== undefined ? (r[map[k]!] || '').trim() : '');
    const reference = get('reference');
    const formRefs = formRefsIn(reference);
    items.push({
      no: n, activity: get('activity'), spec: get('spec'), criteria: get('criteria'), formRefs,
      mentionedRefs: formRefsIn(get('activity') + ' ' + get('criteria')).filter((x) => !formRefs.includes(x)),
      reference: reference.replace(/Form\s*QF\s*[-.]?\s*\d+\s*[a-z]?\b/gi, '').replace(/\n{2,}/g, '\n').trim(),
      inspectedBy: splitParties(get('by')), type: cleanType(get('type'))
    });
  }
  if (!items.length) warnings.push('No ITP items were found under the heading row.');
  return { header, items, notes, warnings };
}
