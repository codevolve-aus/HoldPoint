import type { Field, FormTemplate, Section, Values } from '../types';

export interface Issue { path: string; label: string; message: string; kind: 'missing' | 'spec' }

const blank = (v: any) => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

export const visible = (f: Field, scope: Record<string, any>) =>
  !f.showIf || f.showIf.in.includes(String(scope[f.showIf.key] ?? ''));

/** Returns a message if the value is out of spec, else ''. */
export function specMessage(f: Field, value: any, row: Record<string, any>, form: Values): string {
  const ch = f.check;
  if (!ch || blank(value)) return '';
  const ref = ch.ref ? ` (${ch.ref})` : '';
  if (ch.allowed && !ch.allowed.includes(String(value))) return `${value} is outside ${ch.allowed[0]} to ${ch.allowed[ch.allowed.length - 1]}${ref}`;
  const num = Number(value);
  if (Number.isNaN(num)) return '';
  const unit = f.unit && !f.unit.includes(' ') ? ' ' + f.unit : '';
  if (ch.min !== undefined && num < ch.min) return `${num}${unit} is under the ${ch.min}${unit} minimum${ref}`;
  if (ch.max !== undefined && num > ch.max) return `${num}${unit} is over the ${ch.max}${unit} maximum${ref}`;
  if (ch.lt !== undefined && num >= ch.lt) return `${num}${unit} must be under ${ch.lt}${unit}${ref}`;
  if (ch.minFrom) {
    const ref2 = row[ch.minFrom] ?? form[ch.minFrom];
    const lim = Number(ref2);
    if (!blank(ref2) && !Number.isNaN(lim) && num < lim) return `${num}${unit} is under the specified ${lim}${unit}${ref}`;
  }
  return '';
}

export function rowRuleMessages(sec: Section, row: Record<string, any>): string[] {
  return (sec.rowRules || []).flatMap((r) => {
    const a = Number(row[r.a]); const b = Number(row[r.b]);
    if (blank(row[r.a]) || blank(row[r.b]) || Number.isNaN(a) || Number.isNaN(b)) return [];
    const m = Math.round((a - b) * 10) / 10;
    return m < r.min ? [`${r.label}: ${m} °C, needs at least ${r.min} °C${r.ref ? ` (${r.ref})` : ''}`] : [];
  });
}

/** All missing required values and out-of-spec values for a form. */
export function validate(tpl: FormTemplate, values: Values): Issue[] {
  const out: Issue[] = [];
  for (const sec of tpl.sections) {
    if (sec.repeat) {
      const rows: Record<string, any>[] = values[sec.id] || [];
      if (rows.length < sec.repeat.min) out.push({ path: sec.id, label: sec.title, message: `Add at least ${sec.repeat.min} ${sec.repeat.itemLabel.toLowerCase()}`, kind: 'missing' });
      rows.forEach((row, i) => {
        for (const f of sec.fields) {
          if (!visible(f, row)) continue;
          const path = `${sec.id}.${i}.${f.key}`; const label = `${sec.repeat!.itemLabel} ${i + 1} · ${f.label}`;
          if (f.required && blank(row[f.key])) out.push({ path, label, message: 'Required', kind: 'missing' });
          const m = specMessage(f, row[f.key], row, values);
          if (m) out.push({ path, label, message: m, kind: 'spec' });
        }
        rowRuleMessages(sec, row).forEach((m) => out.push({ path: `${sec.id}.${i}`, label: `${sec.repeat!.itemLabel} ${i + 1}`, message: m, kind: 'spec' }));
      });
    } else {
      for (const f of sec.fields) {
        if (!visible(f, values)) continue;
        if (f.required && blank(values[f.key])) out.push({ path: f.key, label: f.label, message: 'Required', kind: 'missing' });
        const m = specMessage(f, values[f.key], {}, values);
        if (m) out.push({ path: f.key, label: f.label, message: m, kind: 'spec' });
      }
    }
  }
  return out;
}

export const todayISO = () => {
  const d = new Date(); const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
export const isoToDMY = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
export const nowText = () => new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });

/** Fill template defaults ('today' becomes today's date). */
export function initialValues(tpl: FormTemplate): Values {
  const v: Values = {};
  for (const sec of tpl.sections) {
    const def = (f: Field) => (f.default === 'today' ? todayISO() : f.default);
    if (sec.repeat) {
      v[sec.id] = Array.from({ length: sec.repeat.min }, () => Object.fromEntries(sec.fields.filter((f) => f.default).map((f) => [f.key, def(f)])));
    } else {
      for (const f of sec.fields) if (f.default) v[f.key] = def(f);
    }
  }
  return v;
}
