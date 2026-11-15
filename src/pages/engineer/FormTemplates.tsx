import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, deleteDoc, doc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { audit } from '../../lib/db';
import { nowText } from '../../lib/checks';
import { TEMPLATES, templateFor } from '../../data/templates';
import type { BoxMap, PdfTemplateDoc } from '../../types';

const lib = () => import('../../lib/pdfForm');

const openBlob = (blob: Blob, w: Window | null) => {
  const url = URL.createObjectURL(blob);
  if (w) w.location.href = url; else window.open(url, '_blank');
};

/** Every QF form, and whether approved PDFs use the company's own fillable PDF or the standard layout. */
export function FormTemplateList() {
  const { user, role } = useAuth();
  const nav = useNavigate();
  const [docs, setDocs] = useState<Record<string, PdfTemplateDoc>>({});
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');
  useEffect(() => onSnapshot(collection(db, 'pdfTemplates'), (s) => setDocs(Object.fromEntries(s.docs.map((d) => [d.id, d.data() as PdfTemplateDoc])))), []);

  const upload = async (code: string, file: File) => {
    setErr(''); setBusy(code);
    try {
      if (!/\.pdf$/i.test(file.name)) throw new Error('Choose a PDF file.');
      if (file.size > 25 * 1024 * 1024) throw new Error('The PDF is over 25 MB.');
      const bytes = await file.arrayBuffer();
      const { readBoxes, autoMap } = await lib();
      const { boxes, warnings } = await readBoxes(bytes);
      if (!boxes.length) throw new Error(`${file.name} has no fillable boxes. Open it in Adobe Acrobat → Prepare Form to add them, save, and upload it again.`);
      const tpl = templateFor(code)!;
      const old = docs[code];
      // Keep the engineer's earlier choices for boxes with the same name; propose the rest.
      const mapping: Record<string, BoxMap> = { ...autoMap(boxes, tpl) };
      if (old) for (const b of boxes) if (old.mapping[b.name]) mapping[b.name] = old.mapping[b.name];
      const safe = file.name.replace(/[^\w.-]+/g, '_');
      const path = `pdfTemplates/${code}/${Date.now()}_${safe}`;
      await uploadBytes(ref(storage, path), file, { contentType: 'application/pdf' });
      const at = nowText();
      const d: PdfTemplateDoc = { code, file: path, fileName: file.name, boxes, mapping, uploadedBy: role?.name || user!.email!, uploadedAt: at, updatedAt: at };
      await setDoc(doc(db, 'pdfTemplates', code), d);
      await audit(user!.email!, `${old ? 'Replaced' : 'Uploaded'} the company PDF for ${code}: ${file.name} (${boxes.length} boxes, ${Object.keys(mapping).length} matched automatically)`, code);
      if (warnings.length) alert(warnings.join('\n'));
      nav(`/engineer/templates/${code}`);
    } catch (e: any) { setErr(e?.message || 'Upload failed'); } finally { setBusy(''); }
  };

  const remove = async (code: string) => {
    if (!confirm(`Stop using the company PDF for ${code}? Approved PDFs go back to the standard layout. Forms already approved keep their PDFs.`)) return;
    await deleteDoc(doc(db, 'pdfTemplates', code));
    await audit(user!.email!, `Removed the company PDF for ${code}; back to the standard layout`, code);
  };

  return (
    <main className="page">
      <div><h1>Form templates</h1>
        <div className="sub">Upload each QF form as the company's fillable PDF. Approved forms are then filed as that paper form, filled in.
          Anything the paper form has no box for, and the approval record, go on pages added at the end. Forms without a company PDF use the standard layout.</div></div>
      {err && <div className="err">{err}</div>}
      {TEMPLATES.map((t) => {
        const d = docs[t.code];
        const mapped = d ? d.boxes.filter((b) => d.mapping[b.name]?.source).length : 0;
        return (
          <section className="card" key={t.code}>
            <div className="spread">
              <div><strong style={{ fontSize: 16 }}>{t.code} · {t.title}</strong>
                <div className="sub">{d ? `Company PDF: ${d.fileName} · ${mapped} of ${d.boxes.length} boxes mapped · updated ${d.updatedAt || d.uploadedAt} by ${d.uploadedBy}` : 'Standard layout (no company PDF yet)'}</div></div>
              <span className={'chip ' + (d ? 'approved' : 'draft')}>{d ? 'Company PDF' : 'Standard'}</span>
            </div>
            <div className="row">
              <label className="btn sm" style={{ cursor: 'pointer' }}>
                {busy === t.code ? 'Reading…' : d ? 'Upload new version' : 'Upload company PDF'}
                <input type="file" accept="application/pdf,.pdf" hidden disabled={!!busy}
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(t.code, f); }} />
              </label>
              {d && <Link className="btn sm" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }} to={`/engineer/templates/${t.code}`}>Map boxes</Link>}
              {d && <button className="btn sm bad" onClick={() => remove(t.code)}>Use standard layout</button>}
            </div>
          </section>
        );
      })}
    </main>
  );
}

/** Map each box in the company PDF to a field of the form, check it with test fills, save. */
export function FormTemplateMap() {
  const { code } = useParams();
  const { user, role } = useAuth();
  const tpl = templateFor(code!);
  const [d, setD] = useState<PdfTemplateDoc | null | undefined>(undefined);
  const [mapping, setMapping] = useState<Record<string, BoxMap>>({});
  const [dirty, setDirty] = useState(false);
  const [onlyEmpty, setOnlyEmpty] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');
  const [sources, setSources] = useState<{ id: string; label: string; group: string; kind: 'text' | 'image'; options?: string[] }[]>([]);

  useEffect(() => onSnapshot(doc(db, 'pdfTemplates', code!), (s) => {
    const x = s.exists() ? (s.data() as PdfTemplateDoc) : null;
    setD(x); if (x && !dirty) setMapping(x.mapping || {});
  }), [code]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (tpl) lib().then((l) => setSources(l.sourcesFor(tpl))); }, [tpl]);

  const groups = useMemo(() => {
    const g = new Map<string, typeof sources>();
    for (const s of sources) g.set(s.group, [...(g.get(s.group) || []), s]);
    return [...g.entries()];
  }, [sources]);
  const byId = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  if (!tpl) return <main className="page"><div className="err">Unknown form {code}.</div></main>;
  if (d === undefined) return <main className="page"><span className="sub">Loading…</span></main>;
  if (d === null) return <main className="page"><Link to="/engineer/templates" className="sub">‹ Form templates</Link><div className="note info">No company PDF for {code} yet. Upload one on the Form templates page.</div></main>;

  const set = (box: string, m: BoxMap | null) => {
    setDirty(true); setMsg('');
    setMapping((cur) => { const n = { ...cur }; if (m?.source) n[box] = m; else delete n[box]; return n; });
  };
  const save = async () => {
    setBusy('save');
    try {
      await updateDoc(doc(db, 'pdfTemplates', code!), { mapping, updatedAt: nowText() });
      await audit(user!.email!, `Saved the box mapping for ${code} (${Object.keys(mapping).length} of ${d.boxes.length} boxes)`, code);
      setDirty(false); setMsg('Saved. New approvals of this form use it.');
    } catch (e: any) { setMsg(e?.message || 'Could not save'); } finally { setBusy(''); }
  };
  const bytes = async () => getBytes(ref(storage, d.file));
  const preview = async (kind: 'names' | 'sample') => {
    const w = window.open('', '_blank'); setBusy(kind); setMsg('');
    try {
      const l = await lib(); const b = await bytes();
      const blob = kind === 'names' ? await l.previewBoxNames(b)
        : await l.fillPdfTemplate(b, mapping, { tpl, sub: l.sampleSubmission(tpl), project: l.sampleProject, approvedBy: role?.name || user!.email!, approvedAt: nowText() });
      openBlob(blob, w);
    } catch (e: any) { w?.close(); setMsg(e?.message || 'Could not build the preview'); } finally { setBusy(''); }
  };

  const mappedCount = d.boxes.filter((b) => mapping[b.name]?.source).length;
  const shown = d.boxes.filter((b) => !onlyEmpty || !mapping[b.name]?.source);
  const usedBy = new Map<string, string[]>();
  for (const [box, m] of Object.entries(mapping)) if (!m.option) usedBy.set(m.source, [...(usedBy.get(m.source) || []), box]);

  return (
    <main className="page">
      <div>
        <Link to="/engineer/templates" className="sub">‹ Form templates</Link>
        <h1>{tpl.code} · map the company PDF</h1>
        <div className="sub">{d.fileName} · {mappedCount} of {d.boxes.length} boxes mapped. Choose what fills each box. Leave a box empty to keep it blank.
          Entries with no box still go on the added pages, so nothing is lost.</div>
      </div>
      <div className="row">
        <button className="btn" disabled={!!busy} onClick={() => preview('names')}>{busy === 'names' ? 'Building…' : 'Show box names on the PDF'}</button>
        <button className="btn" disabled={!!busy} onClick={() => preview('sample')}>{busy === 'sample' ? 'Building…' : 'Test fill with sample data'}</button>
        <label className="chk"><input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} />Only boxes not mapped yet</label>
        <span style={{ flex: 1 }} />
        <button className="btn pri" disabled={!dirty || !!busy} onClick={save}>{busy === 'save' ? 'Saving…' : dirty ? 'Save mapping' : 'Saved'}</button>
      </div>
      {msg && <div className="note info">{msg}</div>}
      <section className="card">
        <table className="reg">
          <thead><tr><th>Box in the PDF</th><th>Page</th><th>Filled with</th></tr></thead>
          <tbody>
            {shown.map((b) => {
              const m = mapping[b.name]; const src = m ? byId.get(m.source) : undefined;
              const picture = b.kind === 'button' || b.kind === 'signature';
              const dup = m && !m.option && (usedBy.get(m.source)?.length || 0) > 1 && !m.source.startsWith('h:') && !m.source.startsWith('x:');
              return (
                <tr key={b.name}>
                  <td><strong>{b.name}</strong><div className="sub">{b.kind === 'checkbox' ? 'tick box' : b.kind === 'radio' ? `choice: ${b.options?.join(' / ')}` : b.kind === 'dropdown' || b.kind === 'list' ? 'drop-down' : picture ? 'picture box' : b.multiline ? 'text, several lines' : 'text'}</div></td>
                  <td>{b.page}</td>
                  <td>
                    <select value={m?.source || ''} onChange={(e) => set(b.name, e.target.value ? { source: e.target.value } : null)} style={{ maxWidth: 420 }}>
                      <option value="">Leave blank</option>
                      {groups.map(([g, list]) => (
                        <optgroup key={g} label={g}>
                          {list.filter((s) => (picture ? s.kind === 'image' : true)).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                        </optgroup>
                      ))}
                    </select>
                    {b.kind === 'checkbox' && src?.options?.length ? (
                      <select value={m?.option || ''} onChange={(e) => set(b.name, { source: m!.source, option: e.target.value || undefined })} style={{ marginLeft: 6 }}>
                        <option value="">Ticked when filled in</option>
                        {src.options.map((o) => <option key={o} value={o}>Ticked when "{o}"</option>)}
                      </select>
                    ) : null}
                    {src?.kind === 'image' && !picture && <div className="sub">The picture is placed over this box.</div>}
                    {dup && <div className="sub" style={{ color: 'var(--bad, #b91c1c)' }}>Also used by: {usedBy.get(m!.source)!.filter((x) => x !== b.name).join(', ')}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <div className="row"><span style={{ flex: 1 }} /><button className="btn pri" disabled={!dirty || !!busy} onClick={save}>{busy === 'save' ? 'Saving…' : dirty ? 'Save mapping' : 'Saved'}</button></div>
    </main>
  );
}
