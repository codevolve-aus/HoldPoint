import {
  PDFButton, PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFSignature, PDFTextField,
  rgb, type PDFField, type PDFFont, type PDFImage, type PDFPage
} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { jsPDF } from 'jspdf';
import { loadFont } from './pdf';
import { photoDataURL } from './photos';
import { isoToDMY, todayISO, validate, visible } from './checks';
import type { BoxMap, Field, FormTemplate, PdfBox, Project, Submission } from '../types';

/*
 * Company PDF forms: the engineer uploads each QF form as a fillable PDF and maps its boxes to the
 * form's fields once. Approved PDFs are that paper form, filled in and flattened.
 * Anything the paper form has no box for (extra rows, photos, out-of-spec notes) and the approval
 * record go on pages added at the end, so nothing the supervisor entered is lost.
 */

/* ---------- Sources: everything a box can be filled with ---------- */

export interface Source {
  id: string;              // h:<header> | x:<approval> | f:<key>[#name|#at] | r:<section>:<row>:<key>[#name|#at]
  label: string;
  group: string;
  kind: 'text' | 'image';
  options?: string[];      // choice / checks options, for tick boxes
}

export const HEADER_KEYS = ['Project', 'Job number', 'Client', 'Responsible person', 'Location ref.', 'Date'];
const APPROVAL: [string, string][] = [
  ['approvedBy', 'Approved by'], ['approvedAt', 'Approved on'], ['version', 'Form version'],
  ['submittedBy', 'Submitted by (supervisor)'], ['itpRev', 'ITP revision'], ['formRev', 'Form template revision']
];

function fieldSources(f: Field, id: string, label: string, group: string): Source[] {
  if (f.type === 'photo') return [{ id, label: `${label} (photo)`, group, kind: 'image' }];
  if (f.type === 'signature') return [
    { id, label: `${label} (signature image)`, group, kind: 'image' },
    { id: `${id}#name`, label: `${label} · name`, group, kind: 'text' },
    { id: `${id}#at`, label: `${label} · date and time`, group, kind: 'text' }
  ];
  return [{ id, label, group, kind: 'text', options: f.options }];
}

export function sourcesFor(tpl: FormTemplate): Source[] {
  const out: Source[] = HEADER_KEYS.map((k) => ({ id: `h:${k}`, label: k, group: 'Job details (from the ITP)', kind: 'text' as const }));
  out.push(...APPROVAL.map(([k, l]) => ({ id: `x:${k}`, label: l, group: 'Approval', kind: 'text' as const })));
  for (const sec of tpl.sections) {
    if (sec.repeat) {
      for (let i = 0; i < sec.repeat.max; i++) {
        const group = `${sec.title} · ${sec.repeat.itemLabel} ${i + 1}`;
        for (const f of sec.fields) out.push(...fieldSources(f, `r:${sec.id}:${i}:${f.key}`, f.label, group));
      }
    } else {
      for (const f of sec.fields) out.push(...fieldSources(f, `f:${f.key}`, f.label, sec.title));
    }
  }
  return out;
}

/* ---------- Reading an uploaded PDF ---------- */

export interface ReadResult { boxes: PdfBox[]; warnings: string[] }

const kindOf = (f: PDFField): PdfBox['kind'] =>
  f instanceof PDFTextField ? 'text' : f instanceof PDFCheckBox ? 'checkbox' : f instanceof PDFRadioGroup ? 'radio'
    : f instanceof PDFDropdown ? 'dropdown' : f instanceof PDFOptionList ? 'list' : f instanceof PDFButton ? 'button'
      : f instanceof PDFSignature ? 'signature' : 'other';

/** Page index (0-based) and rectangle of each widget of a field. */
function widgetPlaces(doc: PDFDocument, field: PDFField) {
  const pages = doc.getPages();
  return field.acroField.getWidgets().map((w) => {
    const r = doc.context.getObjectRef(w.dict);
    let pageIndex = pages.findIndex((p) => p.ref === w.P());
    if (pageIndex < 0 && r) pageIndex = pages.findIndex((p) => (p.node.Annots()?.asArray() || []).some((a) => a === r));
    return { pageIndex: Math.max(0, pageIndex), rect: w.getRectangle() };
  });
}

export async function readBoxes(bytes: ArrayBuffer): Promise<ReadResult> {
  const warnings: string[] = [];
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const form = doc.getForm();
  if (form.hasXFA()) {
    warnings.push('This PDF was made with Adobe LiveCycle (XFA). HoldPoint uses its standard fillable boxes; check the test fill carefully.');
    form.deleteXFA();
  }
  const placed = form.getFields().map((f) => {
    const kind = kindOf(f);
    const where = widgetPlaces(doc, f)[0] || { pageIndex: 0, rect: { x: 0, y: 0, width: 0, height: 0 } };
    const box: PdfBox = { name: f.getName(), kind, page: where.pageIndex + 1 };
    if (f instanceof PDFRadioGroup || f instanceof PDFDropdown || f instanceof PDFOptionList) box.options = f.getOptions();
    if (f instanceof PDFTextField && f.isMultiline()) box.multiline = true;
    return { box, y: where.rect.y + where.rect.height, x: where.rect.x };
  });
  // Reading order: page, then top to bottom, then left to right.
  placed.sort((a, b) => a.box.page - b.box.page || Math.round(b.y - a.y) || a.x - b.x);
  return { boxes: placed.map((p) => p.box), warnings };
}

/* ---------- Matching boxes to fields automatically ---------- */

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Proposes a source for every box whose name clearly matches one field. The engineer checks and fixes the rest. */
export function autoMap(boxes: PdfBox[], tpl: FormTemplate): Record<string, BoxMap> {
  const idx = new Map<string, BoxMap[]>();
  const add = (k: string, m: BoxMap) => { if (!k) return; const l = idx.get(k) || []; if (!l.some((x) => x.source === m.source && x.option === m.option)) l.push(m); idx.set(k, l); };
  const addField = (f: Field, id: string, suffix: string) => {
    if (f.type === 'signature') {
      add(norm(f.key) + suffix, { source: id }); add(norm(f.label) + suffix, { source: id });
      add(norm(f.key) + 'name' + suffix, { source: `${id}#name` }); add(norm(f.key) + 'date' + suffix, { source: `${id}#at` });
      return;
    }
    add(norm(f.key) + suffix, { source: id }); add(norm(f.label) + suffix, { source: id });
    for (const o of f.options || []) {
      add(norm(o) + suffix, { source: id, option: o });
      add(norm(f.key) + norm(o) + suffix, { source: id, option: o });
      add(norm(f.label) + norm(o) + suffix, { source: id, option: o });
    }
  };
  HEADER_KEYS.forEach((k) => add(norm(k), { source: `h:${k}` }));
  add('jobno', { source: 'h:Job number' }); add('location', { source: 'h:Location ref.' });
  APPROVAL.forEach(([k, l]) => { add(norm(k), { source: `x:${k}` }); add(norm(l), { source: `x:${k}` }); });
  for (const sec of tpl.sections) {
    if (sec.repeat) {
      for (let i = 0; i < sec.repeat.max; i++) for (const f of sec.fields) {
        const id = `r:${sec.id}:${i}:${f.key}`;
        addField(f, id, String(i + 1));
        if (i === 0 && sec.repeat.max === 1) addField(f, id, '');
      }
    } else for (const f of sec.fields) addField(f, `f:${f.key}`, '');
  }
  const images = new Set(sourcesFor(tpl).filter((x) => x.kind === 'image').map((x) => x.id));
  const out: Record<string, BoxMap> = {};
  for (const b of boxes) {
    if (b.kind === 'other') continue;
    const hits = (idx.get(norm(b.name)) || []).filter((m) =>
      b.kind === 'checkbox' ? true
        : b.kind === 'button' || b.kind === 'signature' ? images.has(m.source) && !m.option // picture boxes take photos and signatures
          : !m.option && !images.has(m.source));
    if (hits.length === 1) out[b.name] = hits[0];
  }
  return out;
}

/* ---------- Filling ---------- */

export interface FillData {
  tpl: FormTemplate;
  sub: Submission;
  project: Project;
  approvedBy: string;
  approvedAt: string;
}

interface Resolved { value: any; field?: Field; hidden: boolean }

function fieldIn(tpl: FormTemplate, secId: string | null, key: string): Field | undefined {
  for (const s of tpl.sections) if ((secId === null && !s.repeat) || s.id === secId) { const f = s.fields.find((x) => x.key === key); if (f) return f; }
  return undefined;
}

function resolve(id: string, d: FillData): Resolved {
  const [base, part] = id.split('#');
  const pick = (v: any) => (part ? (v && typeof v === 'object' ? v[part] : undefined) : v);
  if (base.startsWith('h:')) {
    const k = base.slice(2);
    return { value: k === 'Date' ? isoToDMY(d.sub.date) : d.sub.header?.[k], hidden: false };
  }
  if (base.startsWith('x:')) {
    const k = base.slice(2);
    const v = { approvedBy: d.approvedBy, approvedAt: d.approvedAt, version: `v${d.sub.version}`, submittedBy: d.sub.supervisorEmail, itpRev: d.sub.itpRev, formRev: d.sub.templateRev }[k];
    return { value: v, hidden: false };
  }
  if (base.startsWith('f:')) {
    const key = base.slice(2); const f = fieldIn(d.tpl, null, key);
    return { value: pick(d.sub.values[key]), field: part ? undefined : f, hidden: !!f && !visible(f, d.sub.values) };
  }
  if (base.startsWith('r:')) {
    const [, sec, i, key] = base.split(':'); const row = (d.sub.values[sec] || [])[Number(i)];
    if (!row) return { value: undefined, hidden: false };
    const f = fieldIn(d.tpl, sec, key);
    return { value: pick(row[key]), field: part ? undefined : f, hidden: !!f && !visible(f, row) };
  }
  return { value: undefined, hidden: false };
}

function asText(v: any, f?: Field): string {
  if (v === undefined || v === null || v === '') return '';
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'object') return '';
  if (f?.type === 'date') return isoToDMY(String(v));
  if (f?.type === 'number' && f.unit && !f.unit.includes(' ')) return `${v} ${f.unit}`;
  return String(v);
}

const ticked = (v: any, option?: string) => {
  if (option) return Array.isArray(v) ? v.includes(option) : String(v ?? '') === option;
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== '' && v !== false && !/^(n|no|false|0)$/i.test(String(v));
};

/** Picks the PDF option that matches a value, e.g. 'S Sunny' matches 'S' or 'Sunny', 'Y' matches 'Yes'. */
function matchOption(v: any, opts: string[]): string | undefined {
  const s = String(v ?? '').trim(); if (!s) return undefined;
  const n = norm(s); const words = s.split(/\s+/).map(norm);
  return opts.find((o) => norm(o) === n) || opts.find((o) => words.includes(norm(o)))
    || opts.find((o) => norm(o).startsWith(n) || n.startsWith(norm(o)));
}

async function imageFor(doc: PDFDocument, v: any): Promise<{ img: PDFImage } | null> {
  const data = typeof v === 'string' && v.startsWith('photos/') ? await photoDataURL(v) : v?.image || null;
  if (!data) return null;
  try {
    const img = String(data).startsWith('data:image/png') ? await doc.embedPng(data) : await doc.embedJpg(data);
    return { img };
  } catch { return null; }
}

function drawFitted(page: PDFPage, img: PDFImage, r: { x: number; y: number; width: number; height: number }) {
  const s = Math.min(r.width / img.width, r.height / img.height);
  const w = img.width * s, h = img.height * s;
  page.drawImage(img, { x: r.x + (r.width - w) / 2, y: r.y + (r.height - h) / 2, width: w, height: h });
}

/** Bytes of a font that covers µ, ², ≥ and the like, for both pdf-lib and jsPDF. */
async function fontBytes(): Promise<{ b64: string | null; bytes: Uint8Array | null }> {
  const b64 = await loadFont();
  if (!b64) return { b64: null, bytes: null };
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return { b64, bytes };
}

/**
 * Fills the company PDF with a submission and flattens it, then adds pages for what had no box
 * and the approval record. Returns the finished PDF.
 */
export async function fillPdfTemplate(templateBytes: ArrayBuffer, mapping: Record<string, BoxMap>, d: FillData,
  opts: { appendix?: boolean } = {}): Promise<Blob> {
  const doc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  doc.registerFontkit(fontkit);
  const { b64, bytes } = await fontBytes();
  const font: PDFFont | null = bytes ? await doc.embedFont(bytes, { subset: true }) : null;
  const form = doc.getForm();
  if (form.hasXFA()) form.deleteXFA();
  const pages = doc.getPages();
  const used = new Set<string>();

  for (const field of form.getFields()) {
    const m = mapping[field.getName()];
    if (!m?.source) continue;
    used.add(m.source);
    const { value, field: f, hidden } = resolve(m.source, d);
    const isImage = (f?.type === 'photo' || f?.type === 'signature') && !m.source.includes('#');
    try {
      if (isImage) {
        const im = hidden ? null : await imageFor(doc, value);
        if (im) for (const w of widgetPlaces(doc, field)) drawFitted(pages[w.pageIndex], im.img, w.rect);
        form.removeField(field);
      } else if (field instanceof PDFTextField) {
        let t = hidden ? '' : asText(value, f);
        const max = field.getMaxLength(); if (max !== undefined && t.length > max) t = t.slice(0, max);
        field.setText(t);
      } else if (field instanceof PDFCheckBox) {
        if (!hidden && ticked(value, m.option)) field.check(); else field.uncheck();
      } else if (field instanceof PDFRadioGroup) {
        const o = hidden ? undefined : matchOption(value, field.getOptions());
        if (o) field.select(o); else field.clear();
      } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
        const o = hidden ? undefined : matchOption(value, field.getOptions());
        if (o) field.select(o); else field.clear();
      }
    } catch { /* a box that can't take this value stays blank; the value is listed on the added pages */ used.delete(m.source); }
  }

  // Buttons and signature boxes nobody filled can't be flattened reliably: drop them (the printed box stays).
  for (const field of form.getFields()) if (field instanceof PDFButton || field instanceof PDFSignature) form.removeField(field);
  if (font) form.updateFieldAppearances(font);
  form.flatten();

  // A small approval line at the foot of every page of the company form.
  const stamp = `APPROVED · ${d.approvedBy} · ${d.approvedAt} · ${d.sub.formCode} v${d.sub.version} · ${d.project.jobNo} · ${isoToDMY(d.sub.date)} · HoldPoint`;
  const sf = font || undefined;
  pages.forEach((p, i) => {
    try { p.drawText(`${stamp} · page ${i + 1} of ${pages.length}`, { x: 18, y: 7, size: 6.5, font: sf, color: rgb(0.09, 0.4, 0.2) }); } catch { /* stamp is a nicety */ }
  });

  if (opts.appendix !== false) {
    const extra = await buildAppendix(d, used, b64);
    if (extra) {
      const ad = await PDFDocument.load(extra);
      const copied = await doc.copyPages(ad, ad.getPageIndices());
      copied.forEach((p) => doc.addPage(p));
    }
  }
  return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' });
}

/* ---------- Added pages: values with no box, photos, out-of-spec notes, approval record ---------- */

async function buildAppendix(d: FillData, used: Set<string>, fontB64: string | null): Promise<ArrayBuffer | null> {
  const { tpl, sub } = d;
  const lines: { group: string; label: string; value: string }[] = [];
  const photos: { caption: string; v: any }[] = [];
  for (const s of sourcesFor(tpl)) {
    if (used.has(s.id) || s.id.startsWith('h:') || s.id.startsWith('x:')) continue;
    const r = resolve(s.id, d);
    if (r.hidden) continue;
    if (s.kind === 'image') { if (r.value) photos.push({ caption: `${s.group} · ${s.label}`, v: r.value }); continue; }
    const t = asText(r.value, r.field);
    if (t) lines.push({ group: s.group, label: s.label, value: t });
  }
  const spec = validate(tpl, sub.values).filter((i) => i.kind === 'spec');

  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const VAL = fontB64 ? 'DejaVu' : 'helvetica';
  if (fontB64) { pdf.addFileToVFS('DejaVuSans.ttf', fontB64); pdf.addFont('DejaVuSans.ttf', 'DejaVu', 'normal'); }
  const W = 210, M = 14, CW = W - 2 * M; let y = 0;
  const top = () => {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
    pdf.text(`${sub.formCode} · ${tpl.title}`, M, 16);
    pdf.setFont(VAL, 'normal'); pdf.setFontSize(8);
    pdf.text(`${d.project.jobNo} · ${d.project.name} · ${d.project.location} · ${isoToDMY(sub.date)} · v${sub.version}`, M, 21);
    pdf.setLineWidth(0.4); pdf.line(M, 24, W - M, 24); y = 31;
  };
  const need = (h: number) => { if (y + h > 282) { pdf.addPage(); top(); } };
  const heading = (s: string) => { need(10); pdf.setFillColor(236, 237, 234); pdf.rect(M, y, CW, 6, 'F'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text(s, M + 2, y + 4.2); y += 9; };
  const text = (s: string, color: [number, number, number] = [0, 0, 0]) => {
    pdf.setFont(VAL, 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...color);
    const l = pdf.splitTextToSize(s, CW); need(l.length * 4 + 1); pdf.text(l, M, y); y += l.length * 4 + 1; pdf.setTextColor(0);
  };

  top();
  pdf.setFont(VAL, 'normal'); pdf.setFontSize(8);
  pdf.text(pdf.splitTextToSize('Added by HoldPoint to the company form: entries the paper form has no box for, out-of-spec notes and the approval record.', CW), M, y); y += 9;

  if (spec.length) { heading('Out of spec'); spec.forEach((i) => text(`${i.label}: ${i.message}`, [185, 28, 28])); y += 2; }
  if (lines.length) {
    heading('Entries with no box on the form');
    let g = '';
    for (const l of lines) {
      if (l.group !== g) { g = l.group; need(6); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.text(g, M, y); y += 4.5; }
      text(`${l.label}: ${l.value}`);
    }
    y += 2;
  }
  if (photos.length) {
    heading('Photos and signatures with no box on the form');
    let col = 0;
    for (const p of photos) {
      const data = typeof p.v === 'string' && p.v.startsWith('photos/') ? await photoDataURL(p.v) : p.v?.image;
      if (col === 0) need(62);
      const x = M + col * (CW / 2 + 1);
      if (data) { try { pdf.addImage(data, String(data).startsWith('data:image/png') ? 'PNG' : 'JPEG', x, y, CW / 2 - 2, 52); } catch { pdf.rect(x, y, CW / 2 - 2, 52); } }
      else pdf.rect(x, y, CW / 2 - 2, 52);
      pdf.setFontSize(7); pdf.setFont(VAL, 'normal'); pdf.text(pdf.splitTextToSize(p.caption, CW / 2 - 2).slice(0, 2), x, y + 56);
      col = (col + 1) % 2; if (col === 0) y += 62;
    }
    if (col === 1) y += 62;
  }
  heading('Approval record');
  text(`Approved by ${d.approvedBy} on ${d.approvedAt}. Form ${sub.formCode} v${sub.version} (template rev ${sub.templateRev}), ITP rev ${sub.itpRev}. Submitted by ${sub.supervisorEmail}.`);
  for (const h of sub.history || []) text(`${h.at} · ${h.by} · ${h.what}`);
  return pdf.output('arraybuffer');
}

/* ---------- Checking a template before it's used ---------- */

/** Fills every text box with its own name and ticks every tick box, so the engineer can see which box is which. */
export async function previewBoxNames(templateBytes: ArrayBuffer): Promise<Blob> {
  const doc = await PDFDocument.load(templateBytes, { ignoreEncryption: true });
  const form = doc.getForm();
  if (form.hasXFA()) form.deleteXFA();
  for (const f of form.getFields()) {
    try {
      if (f instanceof PDFTextField) { f.setMaxLength(undefined); f.setFontSize(6); f.setText(f.getName()); }
      else if (f instanceof PDFCheckBox) f.check();
    } catch { /* leave it */ }
  }
  return new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' });
}

/** A made-up, fully filled submission for a test fill (every row, every field). */
export function sampleSubmission(tpl: FormTemplate): Submission {
  const val = (f: Field, n: number): any => {
    switch (f.type) {
      case 'number': return 10 + n;
      case 'date': return todayISO();
      case 'time': return `${String(6 + 2 * n).padStart(2, '0')}:00`;
      case 'choice': return f.options?.[n % (f.options.length || 1)] ?? 'Sample';
      case 'checks': return (f.options || []).filter((_, i) => i % 2 === 0);
      case 'signature': return undefined;
      case 'photo': return undefined;
      default: return `${f.label}${n ? ' ' + (n + 1) : ''}`.slice(0, 40);
    }
  };
  const values: Record<string, any> = {};
  for (const s of tpl.sections) {
    if (s.repeat) values[s.id] = Array.from({ length: s.repeat.max }, (_, i) => Object.fromEntries(s.fields.map((f) => [f.key, val(f, i)])));
    else for (const f of s.fields) values[f.key] = val(f, 0);
  }
  return {
    id: 'sample', projectId: 'sample', region: 'Sydney', date: todayISO(), formCode: tpl.code, templateRev: tpl.rev, itpRev: 'Rev 0',
    version: 1, status: 'submitted', header: { Project: 'Sample project', 'Job number': 'J0000', Client: 'Sample client', 'Responsible person': 'A. Supervisor', 'Location ref.': 'Pit 1' },
    values, comments: {}, supervisorEmail: 'supervisor@example.com', history: [{ at: 'sample', by: 'supervisor@example.com', what: 'Sample data for a test fill' }]
  } as Submission;
}

export const sampleProject = { id: 'sample', jobNo: 'J0000', name: 'Sample project', client: 'Sample client', region: 'Sydney', location: 'Pit 1', responsible: 'A. Supervisor', itpAuthorisedBy: '' } as Project;
