import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteDoc, doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { audit, fileSafe, folderPath, headFor, isoToDMY, nowText, STATUS_LABEL, useCompany, useProject } from '../lib/db';
import { formFor, runChecks } from '../forms/registry';
import { FormProvider, type FormApi } from '../forms/kit';
import PaperViewer from '../components/PaperViewer';
import SignatureModal from '../components/SignatureModal';
import type { QfRecord } from '../types';

/** One QF record: the paper form on screen, linked to its ITP line. */
export default function RecordView() {
  const { rid } = useParams();
  const nav = useNavigate();
  const { role, user } = useAuth();
  const [rec, setRec] = useState<QfRecord | null | undefined>(undefined);
  const p = useProject(rec?.projectId);
  const company = useCompany();
  const [values, setValues] = useState<Record<string, any>>({});
  const [signing, setSigning] = useState<{ k: string; label: string } | null>(null);
  const [returning, setReturning] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [saved, setSaved] = useState<'saved' | 'saving' | ''>('');
  const pagesRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number>();
  const dirty = useRef(false);

  useEffect(() => onSnapshot(doc(db, 'records', rid!), (s) => {
    const r = s.exists() ? ({ id: s.id, ...(s.data() as object) } as QfRecord) : null;
    setRec(r);
    if (r && !dirty.current) setValues(r.values || {});
  }, () => setRec(null)), [rid]);

  const sup = role?.role === 'supervisor';
  const eng = role?.role === 'engineer';
  const editable = !!rec && sup && (rec.status === 'draft' || rec.status === 'returned');
  const form = rec ? formFor(rec.code) : undefined;

  const flush = useCallback(async (v: Record<string, any>) => {
    if (!rec) return;
    setSaved('saving');
    try { await updateDoc(doc(db, 'records', rec.id), { values: v }); dirty.current = false; setSaved('saved'); }
    catch (e: any) { setMsg(e?.message || 'Could not save'); setSaved(''); }
  }, [rec]);

  const set = useCallback((k: string, v: any) => {
    setValues((old) => {
      const next = { ...old, [k]: v };
      dirty.current = true;
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => flush(next), 700);
      return next;
    });
  }, [flush]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const issues = useMemo(() => (rec ? runChecks(rec.code, values) : []), [rec, values]);

  if (rec === undefined || p === undefined) return <div className="page wide"><span className="sub">Loading…</span></div>;
  if (!rec || !p) return <div className="page wide"><div className="note bad">This form isn't available.</div></div>;
  if (!form) return <div className="page wide"><div className="note bad">{rec.code} isn't a form HoldPoint can show.</div></div>;

  const who = { email: user!.email!, name: role?.name || user!.email! };
  const api: FormApi = { get: (k) => values[k], set, locked: !editable, head: headFor(p, rec), company, recordId: rec.id, sign: (k, label) => setSigning({ k, label }) };
  const history = (what: string) => [...(rec.history || []), { at: nowText(), by: who.email, what }];
  const itpLink = p.liveRev ? `/p/${p.id}/itp/${p.liveRev}` : `/p/${p.id}/docs`;

  const submit = async () => {
    if (issues.length && !confirm(`Submit anyway?\n\n${issues.join('\n')}`)) return;
    window.clearTimeout(timer.current);
    setBusy('Submitting…');
    const resub = rec.status === 'returned';
    try {
      await updateDoc(doc(db, 'records', rec.id), {
        values, status: 'submitted', submittedAt: nowText(), version: resub ? rec.version + 1 : rec.version, returnNote: '',
        history: history(resub ? `Fixed and resubmitted as v${rec.version + 1}` : 'Submitted to the engineer')
      });
      dirty.current = false;
      await audit(who.email, `Submitted ${rec.ref}${resub ? ` v${rec.version + 1}` : ''}`, rec.id);
      setMsg('Sent to the engineer for review.');
    } catch (e: any) { setMsg(e?.message || 'Could not submit'); } finally { setBusy(''); }
  };
  const remove = async () => {
    if (!confirm(`Delete draft ${rec.ref}? This can't be undone.`)) return;
    await deleteDoc(doc(db, 'records', rec.id));
    await audit(who.email, `Deleted draft ${rec.ref}`, rec.id);
    nav(itpLink);
  };
  const doReturn = async () => {
    if (!note.trim()) return;
    setBusy('Returning…');
    try {
      await updateDoc(doc(db, 'records', rec.id), { status: 'returned', returnNote: note.trim(), history: history(`Returned: ${note.trim()}`) });
      await audit(who.email, `Returned ${rec.ref}: ${note.trim()}`, rec.id);
      setReturning(false); setNote(''); setMsg('Returned to the supervisor.');
    } finally { setBusy(''); }
  };
  const approve = async () => {
    if (issues.length && !confirm(`Approve with these warnings?\n\n${issues.join('\n')}`)) return;
    setBusy('Making the PDF and filing it in Completed Documents…');
    try {
      const at = nowText();
      const { pagesToPdf } = await import('../lib/paperPdf');
      const blob = await pagesToPdf(pagesRef.current!, `APPROVED · ${who.name} · ${at} · ${rec.ref} v${rec.version} · ITP line ${rec.itemNo} (${rec.itpRev}) · ${p.jobNo} · HoldPoint`);
      const path = `${folderPath(p, 'Completed Documents')}/${fileSafe(rec.ref)}${rec.version > 1 ? ` v${rec.version}` : ''}.pdf`;
      await uploadBytes(ref(storage, path), blob, { contentType: 'application/pdf' });
      await updateDoc(doc(db, 'records', rec.id), { status: 'approved', approvedBy: who.name, approvedAt: at, pdfPath: path, history: history(`Approved; PDF filed in Completed Documents`) });
      await audit(who.email, `Approved ${rec.ref} v${rec.version}`, rec.id);
      setMsg('Approved. The PDF is in Completed Documents.');
    } catch (e: any) { setMsg(`Approval didn't finish: ${e?.message || e}. Check the signal and try again.`); } finally { setBusy(''); }
  };
  const openPdf = async () => { const w = window.open('', '_blank'); const url = await getDownloadURL(ref(storage, rec.pdfPath!)); if (w) w.location.href = url; };

  return (
    <div className="recpage">
      <div className="recbar">
        <Link to={itpLink} className="btn sm" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>‹ Back to ITP</Link>
        <div style={{ minWidth: 0 }}>
          <div className="mono" style={{ fontWeight: 700, color: 'var(--brand)' }}>{rec.ref}</div>
          <div className="sub">{rec.code} {form.title}</div>
        </div>
        <span className="linkchip">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6.5 9.5 9.5 6.5M7 4.5l1-1a2.5 2.5 0 0 1 3.5 3.5l-1 1M9 11.5l-1 1A2.5 2.5 0 0 1 4.5 9l1-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
          <span><b>{p.jobNo} · ITP line {rec.itemNo}</b> · {rec.itpRev}</span>
        </span>
        <span className={'chip ' + rec.status}>{STATUS_LABEL[rec.status]}{rec.version > 1 ? ` · v${rec.version}` : ''}</span>
        {editable
          ? <label className="sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Day of work
            <input type="date" value={rec.date} onChange={(e) => e.target.value && updateDoc(doc(db, 'records', rec.id), { date: e.target.value })} style={{ height: 40, width: 160 }} /></label>
          : <span className="sub">Day of work {isoToDMY(rec.date)}</span>}
        {editable && <span className="sub" aria-live="polite">{saved === 'saving' ? 'Saving…' : saved === 'saved' ? 'Saved' : ''}</span>}
        <span style={{ flex: 1 }} />
        {editable && <>
          {rec.status === 'draft' && rec.version === 1 && <button className="btn sm bad" onClick={remove}>Delete draft</button>}
          <button className="btn pri" disabled={!!busy} onClick={submit}>{rec.status === 'returned' ? 'Resubmit to engineer' : 'Submit to engineer'}</button>
        </>}
        {eng && rec.status === 'submitted' && <>
          <button className="btn bad" disabled={!!busy} onClick={() => setReturning(true)}>Return to supervisor</button>
          <button className="btn ok" disabled={!!busy} onClick={approve}>Approve &amp; file PDF</button>
        </>}
        {rec.status === 'approved' && rec.pdfPath && <button className="btn" onClick={openPdf}>Open PDF</button>}
        {rec.status === 'approved' && <span className="sub">{rec.packName ? `Sent to client in ${rec.packName}` : `Approved ${rec.approvedAt} by ${rec.approvedBy}`}</span>}
      </div>
      {rec.status === 'returned' && rec.returnNote && <div className="returned"><strong>Returned by the engineer:</strong> {rec.returnNote}</div>}
      {issues.length > 0 && rec.status !== 'approved' && (editable || eng) && (
        <div className="issues"><strong>{eng ? 'Check before approving' : 'Check before submitting'}:</strong> {issues.join(' · ')}</div>
      )}
      {(msg || busy) && <div className="toast" role="status" style={{ borderRadius: 0 }}>{busy || msg}</div>}

      <PaperViewer ref={pagesRef} pageWidth={form.pageW} maxFit={1.25} full>
        <FormProvider api={api}><form.Component /></FormProvider>
      </PaperViewer>

      {signing && (
        <SignatureModal title={`Sign · ${signing.label}`} sub={`${rec.ref} · ${form.title}`}
          defaultName={/client|owner/i.test(signing.label) ? '' : who.name} defaultDate={isoToDMY(rec.date)}
          onCancel={() => setSigning(null)}
          onConfirm={(r) => { set(signing.k, { image: r.image, name: r.name, at: r.at, date: r.date }); setSigning(null); }} />
      )}
      {returning && (
        <div className="scrim" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Return to supervisor">
            <header><h2>Return {rec.ref} to the supervisor</h2></header>
            <div className="body">
              <label className="f">What needs fixing<textarea rows={4} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. The 2 pm dew point reading is missing." autoFocus /></label>
            </div>
            <footer><button className="btn" onClick={() => setReturning(false)}>Cancel</button><button className="btn bad" disabled={!note.trim() || !!busy} onClick={doReturn}>Return</button></footer>
          </div>
        </div>
      )}
    </div>
  );
}

