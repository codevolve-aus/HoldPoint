import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { dmyToIso, isoToDMY } from '../lib/db';
import { normaliseFormRef } from '../lib/itpParse';
import { formFor } from '../forms/registry';
import type { Company, ItpItem, ItpRevision, Project, QfRecord, SignOff, SignOn } from '../types';

/*
 * The ITP exactly as the company's PDF lays it out: landscape A4 pages, the document header block on every page,
 * the 9 columns (No. · Activity / Operation · Specification · Reference Document · Acceptance Criteria ·
 * Inspection By · Sign · Date · Inspection Type), one Sign / Date row per inspecting party, the comments and
 * notes after the last line, and the ITP sign-on table on its own page.
 */

const PAGE_W = 1123, PAGE_H = 794, INNER_W = PAGE_W - 46;
const BODY_BUDGET = 500;      // px of lines per page under the header block and column headings
const NOTES_H = 190;
const INK = '#1D4ED8';
const bd = '1px solid #000';
/** '0', 'Rev 0', 'Revision 0' all print as '0' after the printed word Revision. */
export const revNo = (r: string) => r.replace(/^\s*rev(ision)?\.?\s*/i, '').trim();
const COLS = [3.6, 28.8, 9.1, 9, 21.7, 9.9, 5.5, 5.5, 6.9];

export interface ItpPaperProps {
  project: Project;
  rev: ItpRevision;
  company: Company;
  offs: Record<string, SignOff>;
  signOn: SignOn | null;
  records: QfRecord[];
  editable: boolean;
  changed?: Record<number, 'new' | 'changed'>;
  onSign: (item: ItpItem, partyIndex: number) => void;
  onDate: (item: ItpItem, partyIndex: number, dmy: string) => void;
  onForm: (item: ItpItem, code: string) => void;
  onSignOn: (cell: string, kind: 'text' | 'sign', value?: string) => void;
}

export default function ItpPaper(props: ItpPaperProps) {
  const { rev } = props;
  const items = rev.itp.items;
  const measureRef = useRef<HTMLTableElement>(null);
  const [heights, setHeights] = useState<number[] | null>(null);
  const sig = JSON.stringify([items.map((i) => [i.no, i.activity.length, i.criteria.length, i.spec.length, i.reference.length, i.inspectedBy.length]), Object.keys(props.offs).length, props.records.length]);

  const measure = () => {
    const t = measureRef.current; if (!t) return;
    setHeights([...t.querySelectorAll<HTMLElement>('tbody[data-line]')].map((b) => b.getBoundingClientRect().height));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(measure, [sig]);
  // Measure again once the form font has loaded: line heights change with it.
  useEffect(() => { let live = true; document.fonts?.ready.then(() => live && measure()); return () => { live = false; }; }, []);

  const pages = useMemo(() => {
    const hs = heights || items.map(() => 120);
    const out: ItpItem[][] = []; let cur: ItpItem[] = []; let used = 0;
    items.forEach((it, i) => { if (cur.length && used + hs[i] > BODY_BUDGET) { out.push(cur); cur = []; used = 0; } cur.push(it); used += hs[i]; });
    out.push(cur);
    const notesOwn = used + NOTES_H > BODY_BUDGET + 40;
    const list: { lines: ItpItem[]; notes: boolean; signOn: boolean }[] = out.map((l, i) => ({ lines: l, notes: !notesOwn && i === out.length - 1, signOn: false }));
    if (notesOwn) list.push({ lines: [], notes: true, signOn: false });
    list.push({ lines: [], notes: false, signOn: true });
    return list;
  }, [heights, items]);

  return (
    <>
      {pages.map((pg, i) => (
        <div key={i} className="paper" style={{ width: PAGE_W, height: PAGE_H, padding: '18px 23px 0', fontFamily: 'Carlito, Calibri, Arial, sans-serif', fontSize: 12.5 }}>
          <HeaderBlock {...props} />
          {pg.lines.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: 16 }}>
              <Cols /><ColumnHeads />
              {pg.lines.map((it) => <Line key={it.no} item={it} {...props} />)}
            </table>
          )}
          {pg.notes && <Notes notes={rev.itp.notes} company={props.company} />}
          {pg.signOn && <SignOnTable {...props} />}
          <div style={{ position: 'absolute', left: 41, right: 113, bottom: 14, borderTop: '2px solid #4A4A4A', paddingTop: 6, display: 'flex', justifyContent: 'space-between', fontSize: 12, lineHeight: '16px' }}>
            <div><b>Rev Date:</b> {rev.itp.date || rev.uploadedAt.split(',')[0]}<br /><b>Authorised By:</b> {props.project.itpAuthorisedBy || '—'}</div>
            <div style={{ alignSelf: 'flex-end', fontWeight: 700 }}>Page {i + 1} of {pages.length}</div>
            <div style={{ width: 96 }}><b>Rev:</b> {revNo(rev.rev)}<br /><b>Status:</b> {rev.status === 'live' ? 'Current' : rev.status === 'draft' ? 'Draft' : 'Superseded'}</div>
          </div>
        </div>
      ))}
      {createPortal(
        <div aria-hidden="true" style={{ position: 'absolute', left: -20000, top: 0, width: INNER_W, visibility: 'hidden', fontFamily: 'Carlito, Calibri, Arial, sans-serif', fontSize: 12.5 }}>
          <table ref={measureRef} style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <Cols />
            {items.map((it) => <Line key={it.no} item={it} {...props} measuring />)}
          </table>
        </div>, document.body)}
    </>
  );
}

const Cols = () => <colgroup>{COLS.map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>;

function ColumnHeads() {
  const th: CSSProperties = { border: bd, padding: '2px 4px', textAlign: 'center', fontWeight: 700, fontSize: 13, verticalAlign: 'top', lineHeight: '16px', background: '#BFBFBF' };
  return (
    <thead>
      <tr>
        <th style={{ ...th, textAlign: 'left' }}>No.</th><th style={th}>Activity / Operation</th><th style={th}>Specification</th><th style={th}>Reference Document</th>
        <th style={th}>Acceptance<br />Criteria</th><th style={th}>Inspection<br />By</th><th style={th}>Sign</th><th style={th}>Date</th><th style={th}>Inspection Type</th>
      </tr>
    </thead>
  );
}

function HeaderBlock({ project: p, rev, company }: ItpPaperProps) {
  const td: CSSProperties = { border: bd, padding: '0 3px', height: 19 };
  const up = (s?: string) => (s || '').toUpperCase();
  return (
    <>
      <div style={{ border: bd, borderBottom: 'none', display: 'flex', height: 58 }}>
        <div style={{ width: 207, borderRight: bd, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {company.logo ? <img src={company.logo} alt={company.name} style={{ maxWidth: 180, maxHeight: 50, objectFit: 'contain' }} />
            : <div style={{ width: 92, height: 42, border: '1px dashed #9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: '#6B7280', fontFamily: 'Arial, sans-serif' }}>Company logo</div>}
        </div>
        <div style={{ padding: '9px 6px', fontWeight: 700, fontSize: 14.5, lineHeight: '20px' }}>DOCUMENT TITLE: INSPECTION AND TEST PLAN<br />DOCUMENT ID: {rev.itp.docId} Revision {revNo(rev.rev)}</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontWeight: 700, fontSize: 13.5 }}>
        <colgroup>{[8.9, 33.2, 30.6, 15.2, 12.1].map((w, i) => <col key={i} style={{ width: `${w}%` }} />)}</colgroup>
        <tbody>
          <tr><td style={td}>CLIENT:</td><td style={td}>{up(p.client)}</td><td style={td}>LOCATION REF: <span style={{ fontWeight: 400 }}>{up(p.location)}</span></td><td style={td}>DATE:</td><td style={td}>{rev.itp.date}</td></tr>
          <tr><td style={td}>PROJECT:</td><td colSpan={2} style={td}>{up(rev.itp.project || p.name)}</td><td style={td}>JOB NUMBER:</td><td style={td}>{p.jobNo}</td></tr>
          <tr><td rowSpan={2} style={td}>ITEM NAME:</td><td rowSpan={2} colSpan={2} style={{ ...td, color: '#E11D1D' }}>{up(rev.itp.itemName)}</td><td style={td}>RESPONSIBLE PERSON:</td><td style={td}>{up(p.responsible)}</td></tr>
          <tr><td style={{ ...td, whiteSpace: 'nowrap' }}>AUTHORISATION OF ITP:</td><td style={td}>{up(p.itpAuthorisedBy)}</td></tr>
        </tbody>
      </table>
    </>
  );
}

/** Splits the reference text so each QF form named in it becomes a link. Forms linked to the line but not named are added at the end. */
function refParts(item: ItpItem): { text?: string; code?: string }[] {
  const out: { text?: string; code?: string }[] = [];
  const re = /(?:Form\s*)?QF\s*[-.]?\s*\d{1,3}\s*[a-z]?\b/gi;
  const used = new Set<string>(); let last = 0; let m: RegExpExecArray | null;
  const s = item.reference || '';
  while ((m = re.exec(s))) {
    const code = normaliseFormRef(m[0]); const match = code && item.forms.find((f) => f.toLowerCase() === code.toLowerCase());
    if (!match) continue;
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    out.push({ code: match }); used.add(match); last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  for (const f of item.forms) if (!used.has(f)) out.push({ text: '\n' }, { code: f });
  return out;
}

function Line({ item, offs, records, editable, changed, onSign, onDate, onForm, measuring }: ItpPaperProps & { item: ItpItem; measuring?: boolean }) {
  const parties = item.inspectedBy.length ? item.inspectedBy : [''];
  const n = parties.length;
  const flag = changed?.[item.no];
  const cell: CSSProperties = { border: bd, verticalAlign: 'top' };
  const partyRow = (i: number): ReactNode[] => {
    const off = offs[`${item.no}_${i}`];
    const label = `line ${item.no}, ${parties[i] || 'inspection'}`;
    return [
      <td key="by" style={{ ...cell, padding: '4px 4px 0', textAlign: 'center', height: 52 }}>{parties[i]}</td>,
      <td key="sign" style={{ ...cell, padding: 2, textAlign: 'center' }}>
        {editable && !measuring
          ? <button type="button" onClick={() => onSign(item, i)} aria-label={off?.image ? `Sign again: ${label}` : `Sign ${label}`}
            style={{ width: '100%', minHeight: 44, height: '100%', border: off?.image ? 'none' : `1px dashed ${INK}`, borderRadius: 4, background: off?.image ? 'transparent' : '#EFF6FF', color: INK, fontFamily: 'Arial, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {off?.image ? <img src={off.image} alt={`Signed by ${off.name}`} style={{ maxWidth: '100%', maxHeight: 40 }} /> : <span className="noprint">Sign</span>}
          </button>
          : off?.image ? <img src={off.image} alt={`Signed by ${off.name}`} title={`${off.name} · ${off.signedAt || ''}`} style={{ maxWidth: '100%', maxHeight: 40 }} /> : null}
      </td>,
      <td key="date" style={{ ...cell, padding: 2, textAlign: 'center', color: INK, fontSize: 10.5, letterSpacing: -0.2 }}>
        {editable && !measuring
          ? <label style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 44, height: '100%', border: '1px solid #BFDBFE', borderRadius: 4, background: '#F8FAFF', fontWeight: 600, cursor: 'pointer' }}>
            {off?.date || <span className="noprint" style={{ color: '#4B5259' }}>Set date</span>}
            <input type="date" aria-label={`Date, ${label}`} value={dmyToIso(off?.date)} onChange={(e) => onDate(item, i, isoToDMY(e.target.value))}
              onClick={(e) => { try { (e.target as any).showPicker?.(); } catch { /* older browsers open on tap */ } }}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, border: 'none', padding: 0, cursor: 'pointer' }} />
          </label>
          : <div style={{ paddingTop: 4 }}>{off?.date}</div>}
      </td>
    ];
  };
  return (
    <tbody data-line={item.no} style={{ lineHeight: '16px', background: flag ? '#FFFBEB' : undefined }}>
      <tr>
        <td rowSpan={n} style={{ ...cell, padding: 4 }}>{item.no}.{flag && <div className="noprint" style={{ marginTop: 6, fontSize: 9, fontWeight: 700, lineHeight: '11px', color: '#92400E', fontFamily: 'Arial, sans-serif' }}>{flag === 'new' ? 'NEW' : 'CHANGED'}</div>}</td>
        <td rowSpan={n} style={{ ...cell, padding: '4px 8px 10px', textAlign: 'center', whiteSpace: 'pre-line' }}>{item.activity}</td>
        <td rowSpan={n} style={{ ...cell, padding: 4, textAlign: 'center', fontWeight: 700, fontSize: 11.5, lineHeight: '15px', whiteSpace: 'pre-line' }}>{item.spec}</td>
        <td rowSpan={n} style={{ ...cell, padding: 4, textAlign: 'center', fontWeight: 700, fontSize: 11.5, lineHeight: '15px', whiteSpace: 'pre-line' }}>
          {refParts(item).map((part, k) => part.text !== undefined ? <span key={k}>{part.text}</span> : <FormLink key={k} item={item} code={part.code!} records={records} onForm={onForm} measuring={measuring} />)}
        </td>
        <td rowSpan={n} style={{ ...cell, padding: '4px 6px', textAlign: 'center', whiteSpace: 'pre-line' }}>{item.criteria}</td>
        {partyRow(0)}
        <td rowSpan={n} style={{ ...cell, padding: 4, textAlign: 'center', whiteSpace: 'pre-line' }}>{item.type.replace(/\s*Release/i, '\nRelease')}</td>
      </tr>
      {parties.slice(1).map((_, k) => <tr key={k}>{partyRow(k + 1)}</tr>)}
    </tbody>
  );
}

function FormLink({ item, code, records, onForm, measuring }: { item: ItpItem; code: string; records: QfRecord[]; onForm: ItpPaperProps['onForm']; measuring?: boolean }) {
  const mine = records.filter((r) => r.itemNo === item.no && r.code === code);
  const known = !!formFor(code);
  const ret = mine.filter((r) => r.status === 'returned').length, ok = mine.filter((r) => r.status === 'approved').length;
  const note = mine.length ? `${mine.length} ${mine.length === 1 ? 'record' : 'records'}${ret ? ` · ${ret} returned` : ok === mine.length ? ' · approved' : ''}` : '';
  const color = ret ? '#991B1B' : mine.length && ok === mine.length ? '#166534' : '#075985';
  if (!known) return <span title="Paper form: not filled in HoldPoint">Form {code}</span>;
  return (
    <span style={{ display: 'inline-block' }}>
      <button type="button" disabled={measuring} onClick={() => onForm(item, code)} title={`QF-${code.slice(3)} records for line ${item.no}`}
        style={{ background: 'none', border: 'none', padding: '2px 0', color: '#C2410C', font: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', minHeight: 24 }}>Form {code}</button>
      {note && <span className="noprint" style={{ display: 'block', fontFamily: 'Arial, sans-serif', fontSize: 9.5, lineHeight: '12px', color }}>{note}</span>}
    </span>
  );
}

function Notes({ notes, company }: { notes: string[]; company: Company }) {
  const td: CSSProperties = { border: bd, padding: '1px 4px' };
  return (
    <>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: -1 }}>
        <tbody>
          <tr><td style={{ ...td, fontWeight: 700 }}>Comments:</td></tr>
          {notes.map((n, i) => {
            const m = /^(Note\s*\d+\s*:)\s*(.*)$/is.exec(n);
            return <tr key={i}><td style={td}>{m ? <><b>{m[1]}</b> {m[2]}</> : <><b>Note {i + 1}:</b> {n}</>}</td></tr>;
          })}
          <tr><td style={{ ...td, height: 16 }} /></tr>
          <tr><td style={{ ...td, fontWeight: 700 }}>H = Hold Point.&nbsp; W = Witness Point.&nbsp; M = Monitor Regularly</td></tr>
        </tbody>
      </table>
      <div style={{ textAlign: 'center', fontStyle: 'italic', fontSize: 14, marginTop: 16 }}>All Responsible inspectorates are to sign onto ITP at the time of inspection, or completion in acceptance of works compliance:</div>
      <span hidden>{company.name}</span>
    </>
  );
}

function SignOnTable({ signOn, editable, onSignOn }: ItpPaperProps) {
  const cells = signOn?.cells || {};
  const heads = ['NAME', 'ROLE /COMPANY', 'SIGNATURE', 'NAME', 'ROLE /COMPANY', 'SIGNATURE'];
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: 16, fontFamily: 'Arial, sans-serif', fontSize: 10.5 }}>
      <tbody>
        <tr><td colSpan={6} style={{ border: bd, background: '#BFBFBF', textAlign: 'center', padding: '3px 0 4px', fontWeight: 700, lineHeight: '15px' }}>ITP SIGN-ON<br /><span style={{ fontWeight: 400, fontStyle: 'italic', color: INK }}>Responsible inspectorates are to sign on to the ITP</span></td></tr>
        <tr style={{ height: 28, textAlign: 'center' }}>{heads.map((h, i) => <td key={i} style={{ border: bd, borderRight: i === 2 ? '2px solid #000' : bd }}>{h}</td>)}</tr>
        {[0, 1, 2, 3, 4, 5].map((r) => (
          <tr key={r} style={{ height: 40 }}>
            {heads.map((h, c) => {
              const k = `${r}_${c}`; const v = cells[k] || ''; const isSig = c % 3 === 2;
              const style: CSSProperties = { border: bd, borderRight: c === 2 ? '2px solid #000' : bd, padding: 0, textAlign: 'center', color: INK };
              if (isSig) return (
                <td key={c} style={style}>
                  {editable ? <button type="button" onClick={() => onSignOn(k, 'sign')} aria-label={`Sign-on row ${r + 1} signature`} style={{ width: '100%', height: 40, border: 'none', background: v ? 'transparent' : '#F8FAFF', color: INK, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>
                    {v ? <img src={v} alt="Signature" style={{ maxHeight: 36, maxWidth: '100%' }} /> : <span className="noprint">Sign</span>}</button>
                    : v ? <img src={v} alt="Signature" style={{ maxHeight: 36, maxWidth: '100%' }} /> : null}
                </td>
              );
              return (
                <td key={c} style={style}>
                  {editable ? <input aria-label={`Sign-on row ${r + 1} ${h.toLowerCase()}`} defaultValue={v} onBlur={(e) => e.target.value !== v && onSignOn(k, 'text', e.target.value)}
                    style={{ width: '100%', height: 39, boxSizing: 'border-box', border: 'none', background: 'transparent', textAlign: 'center', color: INK, fontSize: 12 }} />
                    : <span style={{ fontSize: 12 }}>{v}</span>}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
