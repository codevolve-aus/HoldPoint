import { useEffect, useRef, useState } from 'react';

export interface SignatureValue { image: string; name: string; at: string }

/** Finger or mouse signature. Saves a PNG data URL plus the signer's name and time. */
export default function SignaturePad({ value, onChange, readOnly, defaultName }: {
  value?: SignatureValue; onChange: (v: SignatureValue | undefined) => void; readOnly?: boolean; defaultName?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [name, setName] = useState(value?.name || defaultName || '');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const c = ref.current; if (!c) return;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d')!; ctx.scale(ratio, ratio); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1F3A93';
  }, [value]);

  if (value) {
    return (
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <img src={value.image} alt={`Signature of ${value.name}`} style={{ height: 60, border: '1px solid #D9DCD6', borderRadius: 8, background: '#fff' }} />
        <span className="sub">{value.name} · {value.at}</span>
        {!readOnly && <button type="button" className="link" onClick={() => onChange(undefined)}>Clear</button>}
      </div>
    );
  }
  if (readOnly) return <span className="sub">Not signed</span>;

  const pos = (e: React.PointerEvent) => { const r = ref.current!.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <canvas ref={ref} className="sig" aria-label="Sign here"
        onPointerDown={(e) => { drawing.current = true; const [x, y] = pos(e); const ctx = ref.current!.getContext('2d')!; ctx.beginPath(); ctx.moveTo(x, y); ref.current!.setPointerCapture(e.pointerId); }}
        onPointerMove={(e) => { if (!drawing.current) return; const [x, y] = pos(e); const ctx = ref.current!.getContext('2d')!; ctx.lineTo(x, y); ctx.stroke(); setDirty(true); }}
        onPointerUp={() => { drawing.current = false; }} />
      <div className="row">
        <input aria-label="Name of signer" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ flex: 1 }} />
        <button type="button" className="btn sm" onClick={() => { const c = ref.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); setDirty(false); }}>Clear</button>
        <button type="button" className="btn sm pri" disabled={!dirty || !name.trim()}
          onClick={() => onChange({ image: ref.current!.toDataURL('image/png'), name: name.trim(), at: new Date().toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) })}>
          Save signature
        </button>
      </div>
    </div>
  );
}
