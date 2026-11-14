import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { STATUS_LABEL, audit, formsFromItp, openSubmission } from '../../lib/db';
import { isoToDMY, nowText, todayISO, validate } from '../../lib/checks';
import { templateFor } from '../../data/templates';
import type { Project, Submission } from '../../types';

/** One project, one day: the ITP and the QF forms it asks for. Submit everything at the end of the day. */
export default function SupDay() {
  const { pid } = useParams();
  const nav = useNavigate();
  const { role, user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [date, setDate] = useState(todayISO());
  const [subs, setSubs] = useState<Record<string, Submission>>({});
  const [tab, setTab] = useState<'forms' | 'itp'>('forms');
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [done, setDone] = useState('');

  useEffect(() => { getDoc(doc(db, 'projects', pid!)).then((s) => s.exists() && setProject({ id: s.id, ...(s.data() as Omit<Project, 'id'>) })); }, [pid]);
  useEffect(() => onSnapshot(query(collection(db, 'submissions'), where('region', '==', role!.region), where('projectId', '==', pid), where('date', '==', date)),
    (s) => setSubs(Object.fromEntries(s.docs.map((d) => { const x = { id: d.id, ...(d.data() as Omit<Submission, 'id'>) }; return [x.formCode, x]; })))), [pid, date, role]);

  const forms = useMemo(() => (project ? formsFromItp(project) : []), [project]);
  if (!project) return <main className="page narrow"><span className="sub">Loading…</span></main>;

  const open = async (code: string) => { nav(`/supervisor/p/${pid}/${date}/${code}`); };
  const setNotNeeded = async (code: string, on: boolean) => {
    const s = subs[code] || await openSubmission(project, date, code, user!.email!);
    await updateDoc(doc(db, 'submissions', s.id), { status: on ? 'not_needed' : 'draft', history: [...(s.history || []), { at: nowText(), by: user!.email!, what: on ? 'Marked not needed today' : 'Marked needed again' }] });
  };

  const editable = (s?: Submission) => !s || ['draft', 'returned', 'not_needed'].includes(s.status);
  const toSend = forms.filter((f) => { const s = subs[f.code]; return s && (s.status === 'draft' || s.status === 'returned'); });
  const untouched = forms.filter((f) => !subs[f.code]);

  const submitAll = async () => {
    setProblems([]); setDone('');
    const issues: string[] = [];
    untouched.forEach((f) => issues.push(`${f.code}: not started. Fill it in or mark it "not needed today".`));
    for (const f of toSend) {
      const s = subs[f.code]; const missing = validate(templateFor(f.code)!, s.values).filter((i) => i.kind === 'missing');
      if (missing.length) issues.push(`${f.code}: ${missing.length} required ${missing.length === 1 ? 'field' : 'fields'} empty (${missing.slice(0, 3).map((m) => m.label).join('; ')}${missing.length > 3 ? '…' : ''})`);
    }
    if (issues.length) { setProblems(issues); return; }
    setBusy(true);
    try {
      for (const f of toSend) {
        const s = subs[f.code]; const resub = s.status === 'returned';
        await updateDoc(doc(db, 'submissions', s.id), {
          status: 'submitted', submittedAt: nowText(), version: resub ? s.version + 1 : s.version,
          history: [...(s.history || []), { at: nowText(), by: user!.email!, what: resub ? `Fixed and resubmitted as v${s.version + 1}` : 'Submitted with the end-of-day pack' }]
        });
      }
      await audit(user!.email!, `Submitted ${toSend.length} forms for ${project.jobNo} ${project.location} ${date}`, project.id);
      setDone(`${toSend.length} ${toSend.length === 1 ? 'form' : 'forms'} sent to the engineer for review.`);
    } finally { setBusy(false); }
  };

  return (
    <main className="page narrow">
      <div>
        <Link to="/supervisor" className="sub">‹ My projects</Link>
        <h1>{project.location}</h1>
        <div className="sub">{project.jobNo} · {project.name} · ITP {project.itp.docId} {project.itp.rev}</div>
      </div>
      <div className="row">
        <label className="f" style={{ flex: '0 0 180px' }}>Day<input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} /></label>
        <div className="pills" role="tablist" style={{ marginTop: 18 }}>
          <button role="tab" aria-selected={tab === 'forms'} className={'pill' + (tab === 'forms' ? ' on' : '')} onClick={() => setTab('forms')}>Today's QA forms</button>
          <button role="tab" aria-selected={tab === 'itp'} className={'pill' + (tab === 'itp' ? ' on' : '')} onClick={() => setTab('itp')}>ITP ({project.itp.items.length})</button>
        </div>
      </div>

      {tab === 'forms' && <>
        <section className="card">
          <div className="spread"><h2>Forms from the ITP · {isoToDMY(date)}</h2><span className="sub">One of each per day</span></div>
          <div className="list">
            {forms.map((f) => {
              const s = subs[f.code]; const tpl = templateFor(f.code)!;
              return (
                <div key={f.code} className="spread">
                  <button className="link" style={{ textAlign: 'left', color: 'inherit', fontWeight: 400 }} onClick={() => open(f.code)} disabled={s?.status === 'not_needed'}>
                    <strong>{f.code} · {tpl.title}</strong>
                    <div className="sub">ITP items {f.items.join(', ')}{s ? ` · v${s.version}` : ''}</div>
                  </button>
                  <div className="row">
                    <span className={'chip ' + (s?.status || 'draft')}>{s ? STATUS_LABEL[s.status] : 'Not started'}</span>
                    {editable(s) && s?.status !== 'returned' && (
                      <button className="link" style={{ fontSize: 13 }} onClick={() => setNotNeeded(f.code, s?.status !== 'not_needed')}>{s?.status === 'not_needed' ? 'Needed' : 'Not needed'}</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        {problems.length > 0 && <div className="note bad"><strong>Can't submit yet</strong><ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>{problems.map((p) => <li key={p}>{p}</li>)}</ul></div>}
        {done && <div className="note ok" role="status">{done}</div>}
        <button className="btn big pri" disabled={busy || toSend.length === 0} onClick={submitAll}>
          {busy ? 'Submitting…' : toSend.length ? `Submit ${toSend.length} ${toSend.length === 1 ? 'form' : 'forms'} for review` : 'Nothing to submit'}
        </button>
        <span className="sub" style={{ textAlign: 'center' }}>Out-of-spec values don't block submitting; they're flagged for the engineer.</span>
      </>}

      {tab === 'itp' && <>
        <div className="note info">The ITP is locked. Its reference column decides which QF forms are created each day.</div>
        {project.itp.items.map((it) => (
          <section className="card" key={it.no}>
            <div className="spread"><strong style={{ fontSize: 12, color: '#4B5259' }}>ITEM {it.no}</strong><span className={'chip ' + it.type}>{it.type}</span></div>
            <div style={{ whiteSpace: 'pre-line', fontSize: 14.5, lineHeight: 1.45 }}>{it.activity}</div>
            <div className="sub" style={{ whiteSpace: 'pre-line' }}><strong style={{ color: '#15181C' }}>Specification:</strong> {it.spec}</div>
            <div className="sub" style={{ whiteSpace: 'pre-line' }}><strong style={{ color: '#15181C' }}>Acceptance criteria:</strong> {it.criteria}</div>
            <div className="sub"><strong style={{ color: '#15181C' }}>Inspection by:</strong> {it.inspectedBy.join(', ')}</div>
            {it.forms.length > 0 && <div className="row">{it.forms.map((c) => <button key={c} className="btn sm" onClick={() => open(c)}>{c} ›</button>)}</div>}
          </section>
        ))}
        <section className="card"><h2>Comments</h2>{project.itp.notes.map((n) => <p key={n} className="sub" style={{ margin: 0 }}>{n}</p>)}<strong style={{ fontSize: 13 }}>H = Hold Point. W = Witness Point. M = Monitor Regularly</strong></section>
      </>}
    </main>
  );
}
