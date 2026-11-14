import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { openSubmission, STATUS_LABEL } from '../../lib/db';
import { isoToDMY, validate } from '../../lib/checks';
import { templateFor } from '../../data/templates';
import FormRenderer from '../../components/FormRenderer';
import type { Project, Submission, Values } from '../../types';

/** Fill one QF form. Every change is saved straight away (on the phone first if there's no signal). */
export default function SupForm() {
  const { pid, date, code } = useParams();
  const { user, role } = useAuth();
  const tpl = templateFor(code!)!;
  const [sub, setSub] = useState<Submission | null>(null);
  const [values, setValues] = useState<Values>({});
  const [saved, setSaved] = useState('');
  const [showMissing, setShowMissing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const timer = useRef<number>();

  useEffect(() => {
    let unsub = () => {};
    setLoadError('');
    (async () => {
      if (!tpl) throw new Error(`There is no form template for ${code}.`);
      const p = await getDoc(doc(db, 'projects', pid!));
      if (!p.exists()) throw new Error('This project no longer exists.');
      const project = { id: p.id, ...(p.data() as Omit<Project, 'id'>) };
      const s = await openSubmission(project, date!, code!, user!.email!);
      setSub(s); setValues(s.values);
      unsub = onSnapshot(doc(db, 'submissions', s.id), (d) => { const x = { id: d.id, ...(d.data() as Omit<Submission, 'id'>) }; setSub(x); },
        (e) => setLoadError(e.message));
    })().catch((e: any) => {
      console.error(`Could not open ${code}`, e);
      setLoadError(`${e?.code ? e.code + ': ' : ''}${e?.message || String(e)}`);
    });
    return () => unsub();
  }, [pid, date, code, user]);

  if (loadError && !sub) return (
    <main className="page narrow">
      <Link to={`/supervisor/p/${pid}`} className="sub">‹ Today's forms</Link>
      <div className="err">Could not open {code}: {loadError}</div>
    </main>
  );
  if (!sub) return <main className="page narrow"><span className="sub">Opening form…</span></main>;
  const editable = sub.status === 'draft' || sub.status === 'returned';

  const change = (v: Values) => {
    setValues(v); setSaved('Saving…');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      await updateDoc(doc(db, 'submissions', sub.id), { values: v });
      setSaved(navigator.onLine ? 'Saved' : 'Saved on this phone · will sync');
    }, 600);
  };

  const issues = validate(tpl, values);
  const missing = issues.filter((i) => i.kind === 'missing');
  const spec = issues.filter((i) => i.kind === 'spec');

  return (
    <main className="page narrow">
      <div>
        <Link to={`/supervisor/p/${pid}`} className="sub">‹ Today's forms</Link>
        <div className="spread"><h1>{tpl.code} · {tpl.title}</h1><span className={'chip ' + sub.status}>{STATUS_LABEL[sub.status]} · v{sub.version}</span></div>
        <div className="sub">{role!.region} · {isoToDMY(sub.date)} · template rev {sub.templateRev} {saved && `· ${saved}`}</div>
      </div>
      {sub.status === 'returned' && (
        <div className="note warn"><strong>Returned by the engineer.</strong> {sub.returnNote} Fix the fields with comments below, then submit again from Today's forms.</div>
      )}
      {!editable && <div className="note info">This form is {STATUS_LABEL[sub.status].toLowerCase()} and can't be changed.</div>}
      <div className="note info">Blank form created from the ITP. Photos are saved under the field where you took them.</div>

      <FormRenderer tpl={tpl} values={values} submissionId={sub.id} header={sub.header} dateText={isoToDMY(sub.date)}
        onChange={editable ? change : undefined} missing={showMissing ? new Set(missing.map((m) => m.path)) : undefined}
        comments={sub.comments} signerName={role!.name} />

      {editable && (
        <section className="card">
          <div className="spread"><h2>Ready to submit?</h2><span className="sub">{missing.length} required empty · {spec.length} out of spec</span></div>
          {spec.length > 0 && <div className="note warn">{spec.length} {spec.length === 1 ? 'value is' : 'values are'} out of spec. You can still submit; the engineer will see them flagged.</div>}
          {missing.length > 0 && <button className="btn" onClick={() => { setShowMissing(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>Show the {missing.length} empty required {missing.length === 1 ? 'field' : 'fields'}</button>}
          <Link to={`/supervisor/p/${pid}`} className="btn pri" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>Done · back to today's forms</Link>
          <span className="sub">All forms are submitted together at the end of the day.</span>
        </section>
      )}
    </main>
  );
}
