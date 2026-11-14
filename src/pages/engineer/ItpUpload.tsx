import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { audit } from '../../lib/db';
import { nowText } from '../../lib/checks';
import { TEMPLATES } from '../../data/templates';
import { REGIONS } from '../admin/AdminUsers';
import type { ItpItem, Project } from '../../types';

interface DraftItem { no: number; activity: string; spec: string; reference: string; criteria: string; inspectedBy: string; type: string; refs: string[]; mentioned: string[] }
interface Details { jobNo: string; name: string; client: string; location: string; region: string; responsible: string; itpAuthorisedBy: string; docId: string; rev: string; itemName: string; date: string }

const KNOWN = TEMPLATES.map((t) => t.code);
const known = (r: string) => KNOWN.find((k) => k.toLowerCase() === r.toLowerCase());
const TYPES = ['H', 'W', 'M', 'WM', 'HW'];
const rows = (s: string) => Math.min(10, Math.max(2, s.split('\n').length + Math.floor(s.length / 70)));

/**
 * New ITP or new revision: upload the project's ITP, the app reads it,
 * the engineer checks it against the original side by side, fixes anything, then publishes.
 */
export default function ItpUpload() {
  const [params] = useSearchParams();
  const projectId = params.get('project');
  const nav = useNavigate();
  const { user, role } = useAuth();
  const [existing, setExisting] = useState<Project | null>(null);
  const [step, setStep] = useState<'pick' | 'reading' | 'confirm' | 'publishing'>('pick');
  const [file, setFile] = useState<File | null>(null);
  const [fileUrl, setFileUrl] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [d, setD] = useState<Details>({ jobNo: '', name: '', client: '', location: '', region: 'Sydney', responsible: '', itpAuthorisedBy: '', docId: '', rev: '', itemName: '', date: '' });
  const [items, setItems] = useState<DraftItem[]>([]);
  const [notes, setNotes] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);
  const [refMap, setRefMap] = useState<Record<string, string>>({});
  const [err, setErr] = useState('');
  const [checked, setChecked] = useState(false);

  useEffect(() => { if (projectId) getDoc(doc(db, 'projects', projectId)).then((s) => s.exists() && setExisting({ id: s.id, ...(s.data() as Omit<Project, 'id'>) })); }, [projectId]);
  useEffect(() => () => { if (fileUrl) URL.revokeObjectURL(fileUrl); }, [fileUrl]);

  const read = async (f: File) => {
    setErr(''); setFile(f); setStep('reading');
    try {
      const { readItpFile } = await import('../../lib/itpRead');
      const r = await readItpFile(f);
      setFileUrl(URL.createObjectURL(f)); setPreviewHtml(r.previewHtml || '');
      const h = r.header;
      setD({
        jobNo: existing?.jobNo || h.jobNo, name: existing?.name || titleCase(h.project), client: existing?.client || titleCase(h.client),
        location: existing?.location || titleCase(h.locationRef || h.itemName.split(/[–-]/)[0] || ''), region: existing?.region || (role?.region && role.region !== 'All regions' ? role.region : 'Sydney'),
        responsible: titleCase(h.responsible) || existing?.responsible || '', itpAuthorisedBy: titleCase(h.authorisedBy) || existing?.itpAuthorisedBy || '',
        docId: h.docId || 'ITP', rev: h.rev || '', itemName: h.itemName, date: h.date
      });
      setItems(r.items.map((i) => ({ no: i.no, activity: i.activity, spec: i.spec, reference: i.reference, criteria: i.criteria, inspectedBy: i.inspectedBy.join('; '), type: i.type, refs: i.formRefs, mentioned: i.mentionedRefs })));
      setNotes(r.notes.join('\n'));
      setWarnings(r.warnings);
      setRefMap({});
      setStep('confirm');
    } catch (e: any) { setErr(e?.message || 'Could not read this file.'); setStep('pick'); }
  };

  const unknownRefs = useMemo(() => [...new Set(items.flatMap((i) => i.refs))].filter((r) => !known(r)), [items]);
  const unresolved = unknownRefs.filter((r) => refMap[r] === undefined);
  const finalForms = (i: DraftItem) => [...new Set(i.refs.map((r) => known(r) || refMap[r] || '').filter(Boolean))];
  const allForms = [...new Set(items.flatMap(finalForms))];
  const sameRev = !!existing && existing.itp.rev.trim().toLowerCase() === d.rev.trim().toLowerCase();

  const problems: string[] = [];
  if (!d.jobNo.trim()) problems.push('Job number is empty');
  if (!d.name.trim()) problems.push('Project is empty');
  if (!d.location.trim()) problems.push('Site location is empty');
  if (!d.rev.trim()) problems.push('ITP revision is empty');
  if (sameRev) problems.push(`This project is already on ${existing!.itp.rev}. Give the new revision a different number`);
  if (!items.length) problems.push('No ITP items');
  items.forEach((i) => { if (!i.activity.trim()) problems.push(`Item ${i.no}: activity is empty`); if (!i.type.trim()) problems.push(`Item ${i.no}: inspection type is empty`); });
  new Set(items.map((i) => i.no)).size !== items.length && problems.push('Two items have the same number');
  unresolved.forEach((r) => problems.push(`${r} isn't a form template yet. Choose what it should create`));
  if (!checked) problems.push('Tick that you have checked the items against the original');

  const setItem = (idx: number, patch: Partial<DraftItem>) => setItems(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const publish = async () => {
    if (problems.length || !file) return;
    setStep('publishing'); setErr('');
    try {
      const id = existing?.id || `${d.jobNo}-${d.location}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const safe = file.name.replace(/[^\w.\- ]/g, '_');
      const path = `itps/${id}/${d.rev.replace(/[^\w.-]/g, '_')}_${Date.now()}_${safe}`;
      await uploadBytes(ref(storage, path), file, { contentType: file.type || (safe.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') });
      const itpItems: ItpItem[] = items.slice().sort((a, b) => a.no - b.no).map((i) => ({
        no: i.no, activity: i.activity.trim(), spec: i.spec.trim(), reference: i.reference.trim(), criteria: i.criteria.trim(), type: i.type.trim().toUpperCase(),
        inspectedBy: i.inspectedBy.split(/;|\n/).map((x) => x.trim()).filter(Boolean), forms: finalForms(i)
      }));
      const at = nowText();
      const rev = { rev: d.rev.trim(), file: path, fileName: file.name, publishedAt: at, publishedBy: role?.name || user!.email!, items: itpItems.length };
      await setDoc(doc(db, 'projects', id), {
        jobNo: d.jobNo.trim(), name: d.name.trim(), client: d.client.trim(), location: d.location.trim(), region: d.region,
        responsible: d.responsible.trim(), itpAuthorisedBy: d.itpAuthorisedBy.trim(), status: 'active',
        itp: { docId: d.docId.trim(), rev: d.rev.trim(), itemName: d.itemName.trim(), project: d.name.trim(), date: d.date, notes: notes.split('\n').map((n) => n.trim()).filter(Boolean), items: itpItems },
        itpFile: path, itpRevs: [...(existing?.itpRevs || []), rev],
        ...(existing ? {} : { createdAt: serverTimestamp() })
      }, { merge: true });
      await audit(user!.email!, `Published ITP ${d.docId} ${d.rev} (${itpItems.length} items, forms ${allForms.join(', ') || 'none'}) for ${d.jobNo} ${d.location} to ${d.region}${existing ? `, replacing ${existing.itp.rev}` : ''}`, id);
      nav('/engineer/itps');
    } catch (e: any) { setErr(e?.message || 'Publishing failed'); setStep('confirm'); }
  };

  /* ---------- pick ---------- */
  if (step === 'pick' || step === 'reading') return (
    <main className="page narrow">
      <div><Link to="/engineer/itps" className="sub">‹ ITPs and projects</Link>
        <h1>{existing ? `New ITP revision · ${existing.jobNo} ${existing.location}` : 'New ITP'}</h1>
        <div className="sub">{existing ? `Currently ${existing.itp.docId} ${existing.itp.rev}. The new revision applies to new days; forms already filled stay on ${existing.itp.rev}.` : 'Upload the signed-off ITP for one project and site location.'}</div></div>
      <label className="card" style={{ alignItems: 'center', textAlign: 'center', border: '2px dashed #B8BDB5', cursor: 'pointer', padding: 32 }}>
        <strong style={{ fontSize: 16 }}>{step === 'reading' ? `Reading ${file?.name}…` : 'Choose the ITP file'}</strong>
        <span className="sub">PDF or Word (.docx). The app reads the header, every item and the QF forms in the reference column. You check it all before anything is published.</span>
        <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={step === 'reading'}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }} onChange={(e) => { const f = e.target.files?.[0]; if (f) read(f); e.target.value = ''; }} />
        <span className="btn pri" style={{ display: 'inline-flex', alignItems: 'center' }}>{step === 'reading' ? 'Reading…' : 'Choose file'}</span>
      </label>
      {err && <div className="note bad">{err}</div>}
      <div className="note info">Scanned PDFs (pictures of paper) can't be read. Use the PDF exported from Word, or the Word file.</div>
    </main>
  );

  /* ---------- confirm ---------- */
  const field = (k: keyof Details, label: string, full = false) => (
    <label className={'f' + (full ? ' full' : '')}>{label}<input value={d[k]} onChange={(e) => setD({ ...d, [k]: e.target.value })} /></label>
  );
  return (
    <main className="page" style={{ maxWidth: 1500 }}>
      <div className="spread">
        <div><Link to="/engineer/itps" className="sub">‹ ITPs and projects</Link><h1>Check the ITP before publishing</h1>
          <div className="sub">{file?.name} · {items.length} items read · forms {allForms.join(', ') || 'none'}</div></div>
        <button className="btn" onClick={() => setStep('pick')}>Choose a different file</button>
      </div>
      {warnings.length > 0 && <div className="note warn"><strong>Check these:</strong><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{warnings.map((w) => <li key={w}>{w}</li>)}</ul></div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16, alignItems: 'start' }}>
        {/* original */}
        <section className="card" style={{ position: 'sticky', top: 70, padding: 8 }}>
          <div className="spread" style={{ padding: '4px 8px' }}><h2>Original</h2><a href={fileUrl} target="_blank" rel="noreferrer" className="sub">Open in a new tab</a></div>
          {previewHtml
            ? <div style={{ height: '78vh', overflow: 'auto', border: '1px solid #D9DCD6', borderRadius: 8, padding: 12, fontSize: 12 }} className="docx-preview" dangerouslySetInnerHTML={{ __html: previewHtml }} />
            : <iframe title="Original ITP" src={fileUrl} style={{ width: '100%', height: '78vh', border: '1px solid #D9DCD6', borderRadius: 8 }} />}
        </section>

        {/* what was read */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <section className="card">
            <div className="spread"><h2>Project and ITP</h2><span className="sub">{existing ? 'New revision of an existing project' : 'Creates a new project'}</span></div>
            <div className="grid2">
              {field('jobNo', 'Job number')}{field('client', 'Client')}
              {field('name', 'Project', true)}
              {field('location', 'Site location this ITP covers')}
              <label className="f">Region
                <select value={d.region} onChange={(e) => setD({ ...d, region: e.target.value })} disabled={!!existing}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
              </label>
              {field('responsible', 'Responsible person')}{field('itpAuthorisedBy', 'ITP authorised by')}
              {field('docId', 'ITP document ID')}{field('rev', 'ITP revision')}
              {field('itemName', 'Item name', true)}
            </div>
            {sameRev && <div className="err">Same revision as the current one ({existing!.itp.rev}).</div>}
          </section>

          <section className="card">
            <h2>QF forms this ITP creates</h2>
            <div className="list">
              {[...new Set(items.flatMap((i) => i.refs))].map((r) => {
                const k = known(r); const used = items.filter((i) => i.refs.includes(r)).map((i) => i.no);
                return (
                  <div key={r} className="spread">
                    <div><strong>{r}</strong> <span className="sub">· items {used.join(', ')}</span></div>
                    {k ? <span className="chip approved">Template {k}</span> : (
                      <select aria-label={`What ${r} should create`} value={refMap[r] ?? '?'} onChange={(e) => setRefMap({ ...refMap, [r]: e.target.value === '?' ? (undefined as any) : e.target.value })}
                        style={{ width: 260, borderColor: refMap[r] === undefined ? '#F87171' : undefined }}>
                        <option value="?">No template · choose…</option>
                        {KNOWN.map((c) => <option key={c} value={c}>Use {c}</option>)}
                        <option value="">No form in the app (paper only)</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
            <span className="sub">Forms come from the reference column. Forms mentioned only in the activity or criteria text are shown on the item as suggestions.</span>
          </section>

          {items.map((it, idx) => (
            <section className="card" key={idx}>
              <div className="spread">
                <div className="row"><strong>Item</strong><input aria-label="Item number" value={it.no} onChange={(e) => setItem(idx, { no: parseInt(e.target.value, 10) || 0 })} style={{ width: 64 }} /></div>
                <div className="row">
                  <select aria-label={`Item ${it.no} inspection type`} value={TYPES.includes(it.type) ? it.type : ''} onChange={(e) => setItem(idx, { type: e.target.value })} style={{ width: 110, borderColor: it.type ? undefined : '#F87171' }}>
                    <option value="">Type…</option>{TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                  <button className="link" style={{ color: '#991B1B' }} onClick={() => setItems(items.filter((_, i) => i !== idx))}>Remove</button>
                </div>
              </div>
              <label className="f">Activity / operation<textarea rows={rows(it.activity)} value={it.activity} onChange={(e) => setItem(idx, { activity: e.target.value })} /></label>
              <div className="grid2">
                <label className="f">Specification<textarea rows={rows(it.spec)} value={it.spec} onChange={(e) => setItem(idx, { spec: e.target.value })} /></label>
                <label className="f">Reference document<textarea rows={rows(it.reference)} value={it.reference} onChange={(e) => setItem(idx, { reference: e.target.value })} /></label>
              </div>
              <label className="f">Acceptance criteria<textarea rows={rows(it.criteria)} value={it.criteria} onChange={(e) => setItem(idx, { criteria: e.target.value })} /></label>
              <label className="f">Inspection by (separate with ;)<input value={it.inspectedBy} onChange={(e) => setItem(idx, { inspectedBy: e.target.value })} /></label>
              <div className="row">
                <span className="sub">Forms:</span>
                {it.refs.length === 0 && <span className="sub">none</span>}
                {it.refs.map((r) => (
                  <span key={r} className={'chip ' + (known(r) || refMap[r] ? 'submitted' : 'returned')}>{r}{!known(r) && refMap[r] ? ` → ${refMap[r]}` : ''}
                    <button aria-label={`Remove ${r} from item ${it.no}`} className="link" style={{ marginLeft: 6, fontSize: 12 }} onClick={() => setItem(idx, { refs: it.refs.filter((x) => x !== r) })}>×</button></span>
                ))}
                <select aria-label={`Add a form to item ${it.no}`} value="" onChange={(e) => e.target.value && setItem(idx, { refs: [...new Set([...it.refs, e.target.value])] })} style={{ width: 130, height: 34, fontSize: 13 }}>
                  <option value="">+ Add form</option>{KNOWN.filter((k) => !it.refs.includes(k)).map((k) => <option key={k}>{k}</option>)}
                </select>
              </div>
              {it.mentioned.filter((m) => !it.refs.includes(m)).map((m) => (
                <div key={m} className="note warn" style={{ padding: '8px 10px' }}>
                  The text mentions <strong>{m}</strong> but the reference column doesn't list it.{' '}
                  <button className="link" onClick={() => setItem(idx, { refs: [...it.refs, m] })}>Link {m} to this item</button>{' · '}
                  <button className="link" onClick={() => setItem(idx, { mentioned: it.mentioned.filter((x) => x !== m) })}>Ignore</button>
                </div>
              ))}
            </section>
          ))}
          <button className="btn" style={{ borderStyle: 'dashed' }} onClick={() => setItems([...items, { no: Math.max(0, ...items.map((i) => i.no)) + 1, activity: '', spec: '', reference: '', criteria: '', inspectedBy: '', type: 'H', refs: [], mentioned: [] }])}>+ Add item</button>

          <section className="card">
            <h2>Notes</h2>
            <label className="f">One note per line<textarea rows={rows(notes)} value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
          </section>

          <section className="card" style={{ position: 'sticky', bottom: 0, boxShadow: '0 -4px 12px rgba(0,0,0,0.08)' }}>
            <label className="chk"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />I've checked the items, specs and forms against the original ITP</label>
            {problems.length > 0 && <div className="note bad"><strong>Before publishing:</strong><ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{problems.slice(0, 6).map((p) => <li key={p}>{p}</li>)}{problems.length > 6 && <li>…and {problems.length - 6} more</li>}</ul></div>}
            {err && <div className="err">{err}</div>}
            <button className="btn big pri" disabled={problems.length > 0 || step === 'publishing'} onClick={publish}>
              {step === 'publishing' ? 'Publishing…' : `Publish ${d.docId} ${d.rev} to ${d.region} supervisors`}
            </button>
          </section>
        </div>
      </div>
    </main>
  );
}

function titleCase(s: string) {
  if (!s) return '';
  if (s !== s.toUpperCase()) return s.trim();
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(And|Of|The|To|For|In)\b/g, (m) => m.toLowerCase()).trim();
}
