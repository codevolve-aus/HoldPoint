import { createContext, useContext, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { photoURL, uploadPhoto } from '../lib/photos';
import type { FormHead } from '../lib/db';
import type { Company } from '../types';

/*
 * Building blocks for the hand-built paper forms. Each QF form is laid out exactly like the company's PDF;
 * these pieces put an input on each blank. When the form is locked (submitted, approved, printing) they show
 * the entry as plain text in "ink" so the page reads like a filled-in paper form.
 */

export const INK = '#1D4ED8';

export interface SigValue { image: string; name: string; at: string; date?: string }

export interface FormApi {
  get: (k: string) => any;
  set: (k: string, v: any) => void;
  locked: boolean;
  head: FormHead;
  company: Company;
  recordId: string;
  sign: (k: string, label: string) => void;   // opens the signature window for a signature line
}

const Ctx = createContext<FormApi>(null as unknown as FormApi);
export const FormProvider = ({ api, children }: { api: FormApi; children: ReactNode }) => <Ctx.Provider value={api}>{children}</Ctx.Provider>;
export const useForm = () => useContext(Ctx);

export interface PaperFormProps { }

const inkText: CSSProperties = { color: INK, font: 'inherit', fontWeight: 400 };

/** One page of paper. */
export function Page({ w = 794, h = 1123, style, children }: { w?: number; h?: number; style?: CSSProperties; children: ReactNode }) {
  return <div className="paper" style={{ width: w, height: h, ...style }}>{children}</div>;
}

/** The company logo, or a placeholder box until the admin uploads one. */
export function Logo({ w, h, style }: { w: number; h: number; style?: CSSProperties }) {
  const { company } = useForm();
  if (company.logo) return <img src={company.logo} alt={company.name} style={{ width: w, height: h, objectFit: 'contain', ...style }} />;
  return <div style={{ width: w, height: h, border: '1px dashed #9CA3AF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#6B7280', fontFamily: 'Arial, sans-serif', ...style }}>Company logo</div>;
}

/** A blank on a ruled line. `value` shows a fixed entry (job details from the ITP), otherwise `k` is the stored entry. */
export function U({ k, value, w, label, style, align }: { k?: string; value?: string; w?: number | string; label?: string; style?: CSSProperties; align?: 'left' | 'center' | 'right' }) {
  const f = useForm();
  const v = value !== undefined ? value : (f.get(k!) ?? '');
  // w="100%" in a row of text: take the rest of the line, like a ruled blank does on paper.
  const grow: CSSProperties = w === '100%' ? { flex: 1, width: 'auto', minWidth: 40 } : { width: w, flex: 'none' };
  const base: CSSProperties = { ...grow, border: 'none', borderBottom: '1px solid #000', background: 'transparent', padding: '0 3px', textAlign: align, ...inkText, ...style };
  if (f.locked || value !== undefined) return <span style={{ ...base, display: 'inline-block', minHeight: '1.2em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', verticalAlign: 'bottom' }}>{v || ' '}</span>;
  return <input aria-label={label || k} value={v} onChange={(e) => f.set(k!, e.target.value)} style={{ ...base, height: '1.35em' }} />;
}

/** A blank without a line (the line is drawn by the table or the paper). */
export function Bare({ k, w, label, style, align, maxLength }: { k: string; w?: number | string; label?: string; style?: CSSProperties; align?: 'left' | 'center' | 'right'; maxLength?: number }) {
  return <U k={k} w={w} label={label} align={align} style={{ borderBottom: 'none', ...style }} {...(maxLength ? {} : {})} />;
}

/** A table cell that is a blank. */
export function Cell({ k, label, style, tdStyle, align = 'center', h, colSpan }: { k: string; label?: string; style?: CSSProperties; tdStyle?: CSSProperties; align?: 'left' | 'center' | 'right'; h?: number; colSpan?: number }) {
  const f = useForm();
  const v = f.get(k) ?? '';
  const base: CSSProperties = { width: '100%', height: h || '100%', minHeight: h || 20, boxSizing: 'border-box', border: 'none', background: 'transparent', padding: '0 3px', textAlign: align, ...inkText, ...style };
  return (
    <td colSpan={colSpan} style={{ border: '1px solid #000', padding: 0, ...tdStyle }}>
      {f.locked
        ? <div style={{ ...base, display: 'flex', alignItems: 'center', justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center', overflow: 'hidden', whiteSpace: 'nowrap' }}>{v}</div>
        : <input aria-label={label || k} value={v} onChange={(e) => f.set(k, e.target.value)} style={base} />}
    </td>
  );
}

/** A tick box. */
export function Tick({ k, label, size = 13, style }: { k: string; label?: string; size?: number; style?: CSSProperties }) {
  const f = useForm();
  const on = !!f.get(k);
  if (f.locked) return (
    <span aria-label={`${label || k}: ${on ? 'ticked' : 'not ticked'}`} style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size, border: '1px solid #000', boxSizing: 'border-box', color: INK, fontSize: size, lineHeight: 1, fontWeight: 700, verticalAlign: 'middle', flex: 'none', ...style }}>{on ? '✓' : ''}</span>
  );
  return <input type="checkbox" aria-label={label || k} checked={on} onChange={() => f.set(k, !on)} style={{ width: size, height: size, margin: 0, accentColor: INK, verticalAlign: 'middle', flex: 'none', ...style }} />;
}

/** A tick box with its printed label after it. */
export function TickL({ k, children, gap = 6, style }: { k: string; children: ReactNode; gap?: number; style?: CSSProperties }) {
  return <label style={{ display: 'inline-flex', alignItems: 'center', gap, ...style }}><Tick k={k} label={typeof children === 'string' ? children : k} />{children}</label>;
}

/** A box for writing, sketching or photos: free text plus any number of photos taken on site. */
export function Area({ k, h, label, style }: { k: string; h: number; label: string; style?: CSSProperties }) {
  const f = useForm();
  const photos: string[] = f.get(`${k}_photos`) || [];
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const text = f.get(k) ?? '';
  const add = async (file: File) => {
    setBusy(true); setErr('');
    try { const p = await uploadPhoto(f.recordId, k, file); f.set(`${k}_photos`, [...photos, p]); }
    catch (e: any) { setErr(navigator.onLine ? e?.message || 'Upload failed' : 'No signal: take the photo again when back online'); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ border: '1px solid #000', height: h, position: 'relative', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', ...style }}>
      {f.locked
        ? <div style={{ ...inkText, padding: '6px 8px', whiteSpace: 'pre-wrap', fontSize: 13 }}>{text}</div>
        : <textarea aria-label={label} value={text} onChange={(e) => f.set(k, e.target.value)} style={{ flex: photos.length ? '0 0 46px' : 1, width: '100%', boxSizing: 'border-box', border: 'none', resize: 'none', background: 'transparent', padding: '6px 8px', fontSize: 13, ...inkText }} />}
      {photos.length > 0 && (
        <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 6, padding: '0 6px 6px', alignItems: 'stretch', overflow: 'hidden' }}>
          {photos.map((p) => <Photo key={p} path={p} onRemove={f.locked ? undefined : () => f.set(`${k}_photos`, photos.filter((x) => x !== p))} />)}
        </div>
      )}
      {!f.locked && (
        <label className="noprint" style={{ position: 'absolute', right: 6, bottom: 6, height: 30, padding: '0 10px', border: `1px dashed ${INK}`, borderRadius: 6, background: '#EFF6FF', color: INK, fontFamily: 'Arial, sans-serif', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', cursor: 'pointer', overflow: 'hidden' }}>
          {busy ? 'Uploading…' : '+ Photo'}
          <input type="file" accept="image/*" capture="environment" disabled={busy} aria-label={`Add a photo to ${label}`} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
            onChange={(e) => { const file = e.target.files?.[0]; if (file) add(file); e.target.value = ''; }} />
        </label>
      )}
      {err && <span className="noprint" style={{ position: 'absolute', left: 8, bottom: 8, color: '#991B1B', fontSize: 12, fontWeight: 600, fontFamily: 'Arial, sans-serif' }}>{err}</span>}
    </div>
  );
}

function Photo({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => { let live = true; photoURL(path).then((u) => live && setUrl(u)).catch(() => {}); return () => { live = false; }; }, [path]);
  return (
    <div style={{ position: 'relative', height: '100%', maxWidth: 220 }}>
      {url ? <img src={url} crossOrigin="anonymous" alt="Site photo" style={{ height: '100%', maxWidth: 220, objectFit: 'contain', display: 'block', border: '1px solid #D1D5DB' }} />
        : <div style={{ height: '100%', width: 120, background: '#F3F4F6', fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Arial, sans-serif' }}>Photo</div>}
      {onRemove && <button type="button" className="noprint" onClick={onRemove} aria-label="Remove photo" style={{ position: 'absolute', top: 2, right: 2, width: 28, height: 28, borderRadius: 14, border: 'none', background: 'rgba(0,0,0,.6)', color: '#fff', fontSize: 14 }}>×</button>}
    </div>
  );
}

/** Ruled lines for comments: the first line can sit after a printed label. */
export function Lines({ k, lines, lineH = 26, label, style }: { k: string; lines: number; lineH?: number; label: string; style?: CSSProperties }) {
  const f = useForm();
  const v = f.get(k) ?? '';
  const bg = `repeating-linear-gradient(to bottom, transparent 0, transparent ${lineH - 1}px, #000 ${lineH - 1}px, #000 ${lineH}px)`;
  const base: CSSProperties = { display: 'block', width: '100%', height: lines * lineH, boxSizing: 'border-box', border: 'none', resize: 'none', padding: '0 3px', lineHeight: `${lineH}px`, background: bg, ...inkText, ...style };
  if (f.locked) return <div style={{ ...base, whiteSpace: 'pre-wrap', overflow: 'hidden' }}>{v}</div>;
  return <textarea aria-label={label} value={v} onChange={(e) => f.set(k, e.target.value)} style={base} />;
}

/** A signature on a line: tap to sign on screen. Shows the signature (and name) once signed. */
export function Sig({ k, w, h = 30, label, showName, style }: { k: string; w: number | string; h?: number; label: string; showName?: boolean; style?: CSSProperties }) {
  const f = useForm();
  const v: SigValue | undefined = f.get(k);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', width: w, height: h, borderBottom: '1px solid #000', position: 'relative', verticalAlign: 'bottom', ...style }}>
      {v?.image && <img src={v.image} alt={`Signature of ${v.name}`} style={{ height: h - 2, maxWidth: '70%', objectFit: 'contain' }} />}
      {v?.image && showName && <span style={{ ...inkText, fontSize: 11, marginLeft: 6, whiteSpace: 'nowrap', overflow: 'hidden' }}>{v.name}</span>}
      {!f.locked && (
        <button type="button" className="noprint" onClick={() => f.sign(k, label)} aria-label={v ? `Sign again: ${label}` : `Sign: ${label}`}
          style={{ position: 'absolute', inset: 0, border: v ? 'none' : `1px dashed ${INK}`, borderRadius: 4, background: v ? 'transparent' : '#EFF6FF', color: INK, fontFamily: 'Arial, sans-serif', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          {v ? '' : 'Tap to sign'}
        </button>
      )}
    </span>
  );
}
