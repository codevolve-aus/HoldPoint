import { useEffect, useRef, useState } from 'react';
import { dmyToIso, isoToDMY, todayDMY } from '../lib/db';

export interface SignResult { name: string; date: string; image: string; at: string }

/**
 * On-screen signature: the person signing (supervisor, client representative, asset owner) types their name,
 * checks the date and signs with a finger, stylus or mouse.
 */
export default function SignatureModal({ title, sub, criteria, defaultName = '', defaultDate, onCancel, onConfirm, askDate = true }: {
  title: string; sub?: string; criteria?: string; defaultName?: string; defaultDate?: string; askDate?: boolean;
  onCancel: () => void; onConfirm: (r: SignResult) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [name, setName] = useState(defaultName);
  const [date, setDate] = useState(defaultDate || todayDMY());
  const [ink, setInk] = useState(false);

  useEffect(() => {
    const c = canvas.current!; const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d')!; ctx.scale(ratio, ratio); ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1E3A8A';
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', esc); return () => window.removeEventListener('keydown', esc);
  }, [onCancel]);

  const pos = (e: React.PointerEvent) => { const r = canvas.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const clear = () => { const c = canvas.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setInk(false); };
  const ready = ink && name.trim() && (!askDate || date.trim());

  /** Trims the empty space around the strokes so the signature fills its box on the ITP. */
  const trimmed = (): string => {
    const c = canvas.current!; const ctx = c.getContext('2d')!;
    const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
    let x0 = width, y0 = height, x1 = 0, y1 = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) if (data[(y * width + x) * 4 + 3] > 10) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) return c.toDataURL('image/png');
    const m = 6; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(width, x1 + m); y1 = Math.min(height, y1 + m);
    const out = document.createElement('canvas'); const scale = Math.min(1, 480 / (x1 - x0));
    out.width = Math.round((x1 - x0) * scale); out.height = Math.round((y1 - y0) * scale);
    out.getContext('2d')!.drawImage(c, x0, y0, x1 - x0, y1 - y0, 0, 0, out.width, out.height);
    return out.toDataURL('image/png');
  };

  return (
    <div className="scrim" role="presentation">
      <div className="modal wide" role="dialog" aria-modal="true" aria-label={title}>
        <header><div><h2>{title}</h2>{sub && <div className="sub" style={{ marginTop: 4 }}>{sub}</div>}</div></header>
        <div className="body">
          {criteria && <div style={{ fontSize: 14, background: 'var(--bg)', borderRadius: 10, padding: '10px 12px' }}><span className="sub">Acceptance criteria: </span>{criteria}</div>}
          <div className="grid2">
            <label className="f">Full name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name of the person signing" autoComplete="name" /></label>
            {askDate && <label className="f">Date<input type="date" value={dmyToIso(date)} onChange={(e) => setDate(isoToDMY(e.target.value))} /></label>}
          </div>
          <div>
            <div className="spread" style={{ marginBottom: 4 }}><span className="sub">Sign in the box with a finger, stylus or mouse</span><button className="link" onClick={clear}>Clear</button></div>
            <canvas ref={canvas} className="sigpad" role="img" aria-label="Signature pad"
              onPointerDown={(e) => { e.preventDefault(); drawing.current = true; canvas.current!.setPointerCapture(e.pointerId); const [x, y] = pos(e); const ctx = canvas.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 0.1, y + 0.1); ctx.stroke(); setInk(true); }}
              onPointerMove={(e) => { if (!drawing.current) return; const [x, y] = pos(e); const ctx = canvas.current!.getContext('2d')!; ctx.lineTo(x, y); ctx.stroke(); }}
              onPointerUp={() => { drawing.current = false; }} onPointerCancel={() => { drawing.current = false; }} />
          </div>
          <span className="sub">Signing confirms the inspection was done and meets the acceptance criteria. The name, signature, date and time are recorded.</span>
        </div>
        <footer>
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn ok" disabled={!ready} onClick={() => onConfirm({ name: name.trim(), date: date.trim(), image: trimmed(), at: new Date().toLocaleString('en-AU', { hour12: false }) })}>Confirm signature</button>
        </footer>
      </div>
    </div>
  );
}
