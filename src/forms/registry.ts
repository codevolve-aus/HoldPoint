import type { ComponentType } from 'react';
import QF20b from './QF20b';
import QF45c from './QF45c';
import QF21 from './QF21';
import QF23 from './QF23';
import QF30 from './QF30';

/**
 * The QF forms HoldPoint can fill on screen, each built to look exactly like the company's paper form.
 * A form an ITP refers to that isn't here is treated as paper only.
 */
export interface PaperForm {
  code: string;
  title: string;
  rev: string;
  revDate: string;
  pages: number;
  pageW: number;
  Component: ComponentType;
  /** Out-of-spec and missing-entry warnings, shown to the supervisor before submitting and to the engineer when reviewing. */
  checks: (v: Record<string, any>) => string[];
}

const num = (x: any) => { const n = parseFloat(String(x ?? '').replace(',', '.').replace(/[^\d.-]/g, '')); return isFinite(n) ? n : null; };
const filled = (v: Record<string, any>) => Object.entries(v).some(([, x]) => x !== '' && x !== false && x != null && !(Array.isArray(x) && !x.length));

function qf20b(v: Record<string, any>): string[] {
  const out: string[] = [];
  for (let r = 0; r < 7; r++) {
    const rh = num(v[`amb_${r}_9`]), st = num(v[`amb_${r}_7`]), dp = num(v[`amb_${r}_8`]);
    const ok = String(v[`amb_${r}_11`] || '').trim().toUpperCase();
    const bad: string[] = [];
    if (rh !== null && rh > 85) bad.push(`humidity ${rh}% is above 85%`);
    if (st !== null && dp !== null && st - dp < 3) bad.push(`surface is only ${Math.round((st - dp) * 10) / 10} °C above dew point (needs 3 °C)`);
    if (bad.length) out.push(`Ambient reading ${r + 1}${v[`amb_${r}_0`] ? ` (${v[`amb_${r}_0`]})` : ''}: ${bad.join(' and ')}${ok.startsWith('Y') ? ', but "OK to paint" says Y' : ''}.`);
  }
  for (let c = 0; c < 3; c++) {
    const s = num(v[`ct_${c}_wfs`]), a = num(v[`ct_${c}_wfa`]);
    if (s !== null && a !== null && a < s) out.push(`Coating column ${c + 1}: wet film achieved ${a} is below the ${s} specified.`);
  }
  for (const [p, n] of [['adh', 'Adhesion'], ['moist', 'Moisture'], ['oth', 'Other']]) if (v[`${p}_fail`]) out.push(`${n} testing is marked Fail.`);
  return out;
}

function qf45c(v: Record<string, any>): string[] {
  const out: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = num(v[`l${i}_dust`]);
    const name = v[`l${i}_loc`] ? `"${v[`l${i}_loc`]}"` : `Location ${i + 1}`;
    if (d !== null && d > 2) out.push(`${name}: dust quantity rating ${d} is worse than 2.`);
    const any = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].some((n) => /^y/i.test(String(v[`l${i}_csp${n}`] || '')));
    if (v[`l${i}_loc`] && !any) out.push(`${name}: no CSP profile marked Y.`);
  }
  return out;
}

function qf21(v: Record<string, any>): string[] {
  const spec = num(v.wft); const out: string[] = [];
  if (spec === null) return Object.keys(v).some((k) => /^g\d+$/.test(k) && v[k]) ? ['Specified WFT is empty.'] : [];
  for (let n = 1; n <= 12; n++) { const r = num(v[`g${n}`]); if (r !== null && r < spec) out.push(`Gauge ${n}: ${r} µm is below the ${spec} µm specified.`); }
  return out;
}

function qf23(v: Record<string, any>): string[] {
  const out: string[] = []; const n = num(v.num);
  if (n !== null && n > 0 && !v.rp_yes) out.push(`${n} holidays detected and the repairs aren't marked done.`);
  for (const k of ['dft', 'har', 'spo', 'hv']) if (/^f/i.test(String(v[`e_${k}_pf`] || ''))) out.push(`Test equipment row ${k.toUpperCase()} is marked fail.`);
  return out;
}

function qf30(v: Record<string, any>): string[] {
  const out: string[] = [];
  if (v.fail) out.push('Coating is marked Failed.');
  const sp = num(v.sp), avg = num(v.avg);
  if (sp !== null && avg !== null && avg < sp) out.push(`Average pull-off ${avg} is below the ${sp} specified.`);
  if (!v.pass && !v.fail && filled(v)) out.push('Conclusion (Passed or Failed) isn\'t ticked.');
  return out;
}

export const PAPER_FORMS: PaperForm[] = [
  { code: 'QF-20b', title: 'Daily Coating Inspection Report (Trowel & Plural)', rev: '1.0.1', revDate: '26-10-2026', pages: 2, pageW: 794, Component: QF20b, checks: qf20b },
  { code: 'QF-45c', title: 'Dust and Blast Profile Testing (Concrete)', rev: '1.0.1', revDate: '22/07/2026', pages: 2, pageW: 794, Component: QF45c, checks: qf45c },
  { code: 'QF-21', title: 'Wet Film Thickness Gauges Readings Report', rev: '1.0.1', revDate: '', pages: 1, pageW: 816, Component: QF21, checks: qf21 },
  { code: 'QF-23', title: 'Holiday Report', rev: '2.1.1', revDate: '18/07/2023', pages: 1, pageW: 794, Component: QF23, checks: qf23 },
  { code: 'QF-30', title: 'Adhesion Report Form', rev: '4.0.2', revDate: '16/09/2024', pages: 1, pageW: 794, Component: QF30, checks: qf30 }
];

export const formFor = (code: string) => PAPER_FORMS.find((f) => f.code.toLowerCase() === code.toLowerCase());
export const runChecks = (code: string, v: Record<string, any>) => {
  const f = formFor(code); if (!f) return [];
  return filled(v) ? f.checks(v) : ['Nothing has been filled in yet.'];
};
