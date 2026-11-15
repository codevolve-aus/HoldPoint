import { useEffect, useMemo, useState } from 'react';
import { arrayUnion, collection, deleteField, doc, getDocs, onSnapshot, query, updateDoc, where, writeBatch } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { audit, STATUS_LABEL } from '../../lib/db';
import { isoToDMY, nowText } from '../../lib/checks';
import { templateFor } from '../../data/templates';
import type { Project, Status, Submission } from '../../types';
import { REGIONS } from './AdminUsers';

type Target = 'engineer' | 'supervisor';

/** Where a form can be sent back to from each status. The admin never edits the entries themselves. */
const ROLLBACKS: Partial<Record<Status, { target: Target; label: string; to: Status; hint: string }[]>> = {
  approved: [
    { target: 'engineer', label: 'Back to engineer', to: 'submitted', hint: 'Reopens it in the review queue as a new version. The approved PDF stays filed, marked superseded.' },
    { target: 'supervisor', label: 'Back to supervisor', to: 'returned', hint: 'Sends it to the supervisor\'s Returned forms to fix and resubmit. The approved PDF stays filed, marked superseded.' }
  ],
  submitted: [{ target: 'supervisor', label: 'Back to supervisor', to: 'returned', hint: 'Takes it out of the review queue and sends it to the supervisor\'s Returned forms.' }],
  returned: [{ target: 'engineer', label: 'Back to engineer', to: 'submitted', hint: 'Undoes the engineer\'s return: it goes back to the review queue unchanged.' }],
  not_needed: [{ target: 'supervisor', label: 'Back to supervisor', to: 'draft', hint: 'Undoes "not needed today": the supervisor can fill it in again.' }]
};

/** Admin: find any QF form and roll its status back a stage, with a reason that goes on the record. */
export default function AdminForms() {
  const { user, role } = useAuth();
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [projects, setProjects] = useState<Record<string, Project>>({});
  const [status, setStatus] = useState<Status | 'all'>('approved');
  const [region, setRegion] = useState('all');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<{ id: string; target: Target } | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showHistory, setShowHistory] = useState<string | null>(null);

  useEffect(() => onSnapshot(collection(db, 'submissions'),
    (s) => setSubs(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Submission, 'id'>) })).sort((a, b) => b.date.localeCompare(a.date) || a.formCode.localeCompare(b.formCode))),
    (e) => setMsg({ ok: false, text: e.message })), []);
  useEffect(() => onSnapshot(collection(db, 'projects'), (s) => setProjects(Object.fromEntries(s.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<Project, 'id'>) }])))), []);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (subs || []).filter((s) => {
      if (status !== 'all' && s.status !== status) return false;
      if (region !== 'all' && s.region !== region) return false;
      if (!t) return true;
      const p = projects[s.projectId];
      return [s.formCode, s.date, isoToDMY(s.date), s.supervisorEmail, p?.jobNo, p?.name, p?.location].some((x) => String(x || '').toLowerCase().includes(t));
    });
  }, [subs, projects, status, region, q]);

  const rollback = async (s: Submission, target: Target) => {
    const option = ROLLBACKS[s.status]?.find((o) => o.target === target);
    const why = reason.trim();
    if (!option || !why) return;
    setBusy(true); setMsg(null);
    try {
      const at = nowText(); const me = role?.name || user!.email!;
      const fromApproved = s.status === 'approved';
      // A reopened approved form gets a new version so its next PDF never overwrites the filed one.
      const version = fromApproved && option.to === 'submitted' ? s.version + 1 : s.version;
      const what = `Admin rolled back from ${STATUS_LABEL[s.status]} to the ${target} (${STATUS_LABEL[option.to]})`
        + `${version !== s.version ? `, reopened as v${version}` : ''}: ${why}`;
      const upd: Record<string, any> = {
        status: option.to, version, history: [...(s.history || []), { at, by: me, what }],
        rolledBackAt: at, rolledBackBy: me, rollbackReason: why
      };
      if (option.to === 'returned') upd.returnNote = `Sent back by the admin: ${why}`;
      if (option.to === 'submitted') upd.returnNote = deleteField();
      if (fromApproved) {
        upd.decidedAt = deleteField(); upd.decidedBy = deleteField(); upd.pdfPath = deleteField();
        if (s.pdfPath) upd.previousPdfPaths = arrayUnion(s.pdfPath);
      }
      const batch = writeBatch(db);
      batch.update(doc(db, 'submissions', s.id), upd);
      if (fromApproved) {
        // Keep the filed PDF (approved records are never deleted) but mark its register line superseded.
        const reg = await getDocs(query(collection(db, 'register'), where('submissionId', '==', s.id)));
        reg.docs.filter((d) => !d.data().supersededAt).forEach((d) => batch.update(d.ref, { supersededAt: at, supersededBy: me, supersededReason: why }));
      }
      await batch.commit();
      await audit(user!.email!, `${what} · ${s.formCode} ${projects[s.projectId]?.jobNo || s.projectId} ${s.date}`, s.id);
      setMsg({ ok: true, text: `${s.formCode} · ${isoToDMY(s.date)} is now "${STATUS_LABEL[option.to]}" with the ${target}.` });
      setOpen(null); setReason('');
    } catch (e: any) {
      setMsg({ ok: false, text: e?.message || 'Could not roll it back' });
    } finally { setBusy(false); }
  };

  return (
    <main className="page">
      <div><h1>QF forms</h1>
        <div className="sub">Send a form back a stage when something was captured or approved by mistake. You choose who gets it: the engineer (to review again)
          or the supervisor (to fix and resubmit). The reason goes on the form's record. Entries are never changed here, and approved PDFs stay filed, marked superseded.</div></div>
      <div className="row">
        <label className="f" style={{ flex: '0 0 180px' }}>Status
          <select value={status} onChange={(e) => setStatus(e.target.value as Status | 'all')}>
            <option value="all">All</option>
            {(['approved', 'submitted', 'returned', 'not_needed', 'draft'] as Status[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select></label>
        <label className="f" style={{ flex: '0 0 160px' }}>Region
          <select value={region} onChange={(e) => setRegion(e.target.value)}><option value="all">All regions</option>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="f" style={{ flex: '1 1 220px' }}>Search<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Form, job no., location, date, supervisor" /></label>
      </div>
      {msg && <div className={msg.ok ? 'note info' : 'err'}>{msg.text}</div>}
      {subs === null && <span className="sub">Loading…</span>}
      {subs && shown.length === 0 && <div className="note info">No forms match.</div>}
      {shown.map((s) => {
        const p = projects[s.projectId]; const tpl = templateFor(s.formCode); const opts = ROLLBACKS[s.status] || [];
        const isOpen = open?.id === s.id; const option = isOpen ? opts.find((o) => o.target === open!.target) : undefined;
        return (
          <section className="card" key={s.id}>
            <div className="spread">
              <div><strong style={{ fontSize: 16 }}>{s.formCode} · {tpl?.title || ''}</strong>
                <div className="sub">{isoToDMY(s.date)} · {p ? `${p.jobNo} ${p.name} · ${p.location}` : s.projectId} · {s.region} · supervisor {s.supervisorEmail}</div>
                {s.decidedBy && <div className="sub">Decided by {s.decidedBy} · {s.decidedAt}</div>}</div>
              <span className={'chip ' + s.status}>{STATUS_LABEL[s.status]} · v{s.version}</span>
            </div>
            <div className="row">
              {opts.map((o) => (
                <button key={o.target} className={'btn sm' + (isOpen && open!.target === o.target ? ' pri' : '')} disabled={busy}
                  onClick={() => { setOpen(isOpen && open!.target === o.target ? null : { id: s.id, target: o.target }); setReason(''); setMsg(null); }}>{o.label}</button>
              ))}
              {!opts.length && <span className="sub">{s.status === 'draft' ? 'Still with the supervisor: nothing to roll back.' : ''}</span>}
              <button className="link" style={{ fontSize: 13 }} onClick={() => setShowHistory(showHistory === s.id ? null : s.id)}>{showHistory === s.id ? 'Hide record' : 'Show record'}</button>
            </div>
            {option && (
              <div className="note warn" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span><strong>{option.label}:</strong> {STATUS_LABEL[s.status]} → {STATUS_LABEL[option.to]}. {option.hint}</span>
                <label className="f">Reason (goes on the form's record{option.to === 'returned' ? ' and is shown to the supervisor' : ''})
                  <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Dew point entered as surface temp on reading 2" /></label>
                <div className="row">
                  <button className="btn pri" disabled={busy || !reason.trim()} onClick={() => rollback(s, option.target)}>{busy ? 'Rolling back…' : `Confirm: ${option.label.toLowerCase()}`}</button>
                  <button className="btn" disabled={busy} onClick={() => { setOpen(null); setReason(''); }}>Cancel</button>
                </div>
              </div>
            )}
            {showHistory === s.id && (
              <div className="sub" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {(s.history || []).map((h, i) => <span key={i}>{h.at} · {h.by} · {h.what}</span>)}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
