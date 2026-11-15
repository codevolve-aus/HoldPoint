import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { addDoc, collection, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getBytes, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { audit, STATUS_LABEL } from '../../lib/db';
import { isoToDMY, nowText, validate } from '../../lib/checks';
import { templateFor } from '../../data/templates';
import FormRenderer from '../../components/FormRenderer';
import type { PdfTemplateDoc, Project, Submission } from '../../types';

/** Engineer reviews one form: values against spec, comments per field, approve (PDF + register) or return. */
export default function Review() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user, role } = useAuth();
  const [sub, setSub] = useState<Submission | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => onSnapshot(doc(db, 'submissions', id!), (d) => setSub({ id: d.id, ...(d.data() as Omit<Submission, 'id'>) })), [id]);
  useEffect(() => { if (sub && !project) getDoc(doc(db, 'projects', sub.projectId)).then((p) => setProject({ id: p.id, ...(p.data() as Omit<Project, 'id'>) })); }, [sub, project]);

  if (!sub || !project) return <main className="page"><span className="sub">Loading…</span></main>;
  const tpl = templateFor(sub.formCode)!;
  const issues = validate(tpl, sub.values);
  const spec = issues.filter((i) => i.kind === 'spec');
  const comments = sub.comments || {};
  const nComments = Object.values(comments).filter(Boolean).length;
  const open = sub.status === 'submitted';
  const me = role!.name || user!.email!;

  const setComment = async (path: string, text: string) => {
    const next = { ...comments }; if (text) next[path] = text; else delete next[path];
    await updateDoc(doc(db, 'submissions', sub.id), { comments: next });
  };

  const ret = async () => {
    if (!note.trim() && nComments === 0) { setErr('Add a comment on a field or a note before returning.'); return; }
    setBusy('Returning…'); setErr('');
    try {
      await updateDoc(doc(db, 'submissions', sub.id), {
        status: 'returned', returnNote: note.trim(), decidedAt: nowText(), decidedBy: me,
        history: [...sub.history, { at: nowText(), by: me, what: `Returned v${sub.version}: ${note.trim() || nComments + ' field comments'}` }]
      });
      await audit(user!.email!, `Returned ${sub.formCode} v${sub.version} · ${sub.header['Job number']} ${sub.date}`, sub.id);
      nav('/engineer');
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  const approve = async () => {
    setBusy('Building the PDF…'); setErr('');
    try {
      const at = nowText();
      const final: Submission = { ...sub, history: [...sub.history, { at, by: me, what: `Approved v${sub.version}` }] };
      // The company's own fillable PDF for this form if the engineer uploaded one, else the standard layout.
      const t = await getDoc(doc(db, 'pdfTemplates', sub.formCode));
      const company = t.exists() ? (t.data() as PdfTemplateDoc) : null;
      let blob: Blob;
      if (company) {
        const { fillPdfTemplate } = await import('../../lib/pdfForm');
        blob = await fillPdfTemplate(await getBytes(ref(storage, company.file)), company.mapping, { tpl, sub: final, project, approvedBy: me, approvedAt: at });
      } else {
        const { buildPdf } = await import('../../lib/pdf');
        blob = await buildPdf(tpl, final, project, me, at);
      }
      const clean = (s: string) => s.replace(/[\\/:*?"<>|]/g, '-').trim();
      const folder = `Approved/${clean(project.region)}/${clean(project.jobNo + ' ' + project.name)}/${clean(project.location)}/${sub.date}/`;
      const base = `${sub.formCode}_${project.jobNo}_${sub.date}_v${sub.version}`;
      // Filed PDFs are never overwritten: after an admin rollback, a re-approval of the same version gets its own name.
      const earlier = sub.previousPdfPaths || [];
      let path = `${folder}${base}.pdf`;
      for (let n = 2; earlier.includes(path); n++) path = `${folder}${base}_${n}.pdf`;
      setBusy('Filing…');
      await uploadBytes(ref(storage, path), blob, { contentType: 'application/pdf' });
      await addDoc(collection(db, 'register'), {
        approvedAt: new Date().toISOString(), approvedAtText: at, approvedBy: me, region: project.region, jobNo: project.jobNo, project: project.name,
        location: project.location, date: sub.date, form: sub.formCode, version: sub.version, submittedBy: sub.supervisorEmail, path, submissionId: sub.id,
        pdfTemplate: company ? company.file : 'standard'
      });
      await updateDoc(doc(db, 'submissions', sub.id), { status: 'approved', decidedAt: at, decidedBy: me, pdfPath: path, history: final.history });
      await audit(user!.email!, `Approved ${sub.formCode} v${sub.version} · ${project.jobNo} ${sub.date} · filed ${path}`, sub.id);
      nav('/engineer/records');
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  };

  return (
    <main className="page">
      <div>
        <Link to="/engineer" className="sub">‹ Review queue</Link>
        <div className="spread"><h1>{sub.formCode} · {tpl.title}</h1><span className={'chip ' + sub.status}>{STATUS_LABEL[sub.status]} · v{sub.version}</span></div>
        <div className="sub">{project.region} · {project.jobNo} {project.location} · {isoToDMY(sub.date)} · submitted {sub.submittedAt} by {sub.supervisorEmail}</div>
      </div>

      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ flex: '3 1 520px', minWidth: 0 }}>
          <FormRenderer tpl={tpl} values={sub.values} submissionId={sub.id} header={sub.header} dateText={isoToDMY(sub.date)}
            comments={comments} onComment={open ? setComment : undefined} />
        </div>
        <aside style={{ flex: '1 1 300px', position: 'sticky', top: 70, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <section className="card">
            <h2>Checks against the ITP</h2>
            {spec.length === 0 ? <div className="note ok">All values in spec.</div> : (
              <div className="note bad"><strong>{spec.length} out of spec</strong>
                <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{spec.map((s) => <li key={s.path + s.message}>{s.label}: {s.message}</li>)}</ul></div>
            )}
            <span className="sub">{nComments} field {nComments === 1 ? 'comment' : 'comments'}</span>
          </section>
          {open && (
            <section className="card">
              <h2>Decision</h2>
              <label className="f">Note to supervisor (needed to return, unless you commented on fields)
                <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Add the Part B batch number on coating entry 2" /></label>
              {err && <div className="err">{err}</div>}
              <div className="row">
                <button className="btn bad" disabled={!!busy} onClick={ret}>Return to supervisor</button>
                <button className="btn ok" disabled={!!busy} onClick={approve} style={{ flex: 1 }}>{busy || 'Approve and file'}</button>
              </div>
              <span className="sub">Approving builds the PDF, files it to Approved / {project.region} / {project.jobNo} {project.name} / {project.location} / {sub.date}, and adds it to the register.</span>
            </section>
          )}
          <section className="card">
            <h2>History</h2>
            <div className="list">{sub.history.map((h, i) => <div key={i} style={{ fontSize: 13 }}><strong>{h.at}</strong> · {h.what}<div className="sub">{h.by}</div></div>)}</div>
          </section>
        </aside>
      </div>
    </main>
  );
}
