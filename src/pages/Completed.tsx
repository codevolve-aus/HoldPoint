import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, setDoc, writeBatch } from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { useAuth } from '../lib/auth';
import { audit, fileSafe, folderPath, isoToDMY, nowText, useCompany, usePacks, useProject, useRecords } from '../lib/db';
import { formFor } from '../forms/registry';
import Crumbs from '../components/Crumbs';
import type { Pack } from '../types';

/** Completed Documents: QF forms the engineer approved, filed as PDFs, by ITP line. The engineer sends them to the client as packs. */
export default function Completed() {
  const { pid } = useParams();
  const { role, user } = useAuth();
  const eng = role?.role === 'engineer';
  const p = useProject(pid);
  const records = useRecords(p?.id);
  const packs = usePacks(p);
  const company = useCompany();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');

  const done = useMemo(() => (records || []).filter((r) => r.status === 'approved').sort((a, b) => a.itemNo - b.itemNo || a.code.localeCompare(b.code) || a.seq - b.seq), [records]);
  if (p === undefined) return <div className="page wide"><span className="sub">Loading…</span></div>;
  if (!p) return <div className="page wide"><div className="note bad">This project isn't available.</div></div>;

  const unsent = done.filter((r) => !r.packId);
  const toggle = (id: string) => { const s = new Set(sel); s.has(id) ? s.delete(id) : s.add(id); setSel(s); };
  const open = async (path: string) => { const w = window.open('', '_blank'); const url = await getDownloadURL(ref(storage, path)); if (w) w.location.href = url; };

  const send = async () => {
    const chosen = done.filter((r) => sel.has(r.id));
    if (!chosen.length || !to.trim()) return;
    setBusy('Building the pack…'); setMsg('');
    try {
      const no = Math.max(0, ...(packs || []).map((x) => x.no)) + 1;
      const name = `Pack ${String(no).padStart(2, '0')}`;
      const at = nowText();
      const by = role?.name || user!.email!;
      const [{ buildPack }, { download }] = await Promise.all([import('../lib/pack'), import('../lib/paperPdf')]);
      const blob = await buildPack(p, chosen, name, to.trim(), note.trim(), company, by, at);
      const path = `${folderPath(p, 'Submitted Documents')}/${fileSafe(`${p.jobNo} QA ${name} - ${at.split(',')[0]}`)}.pdf`;
      await uploadBytes(ref(storage, path), blob, { contentType: 'application/pdf' });
      const packRef = doc(db, 'packs', `${p.id}_${no}`);
      const pack: Omit<Pack, 'id'> = { projectId: p.id, region: p.region, no, name, recordIds: chosen.map((r) => r.id), refs: chosen.map((r) => ({ ref: r.ref, code: r.code, itemNo: r.itemNo, date: r.date })), sentTo: to.trim(), note: note.trim(), pdfPath: path, createdBy: by, createdAt: at };
      await setDoc(packRef, pack);
      const b = writeBatch(db);
      for (const r of chosen) b.update(doc(db, 'records', r.id), { packId: packRef.id, packName: name, history: [...(r.history || []), { at, by: user!.email!, what: `Sent to the client in ${name}` }] });
      await b.commit();
      await audit(user!.email!, `Sent ${name} (${chosen.length} forms) for ${p.jobNo} to ${to.trim()}`, p.id);
      download(blob, `${p.jobNo} QA ${name}.pdf`);
      setSel(new Set()); setSending(false); setNote('');
      setMsg(`${name} downloaded and filed in Submitted Documents. Email it to ${to.trim()}.`);
    } catch (e: any) { setMsg(`The pack wasn't made: ${e?.message || e}`); } finally { setBusy(''); }
  };

  return (
    <div className="page wide" style={{ maxWidth: 1200 }}>
      <Crumbs p={p} leaf={['Completed Documents']} />
      <div className="spread" style={{ alignItems: 'flex-end' }}>
        <div><h1>Completed Documents</h1><div className="sub">QF forms the engineer has approved, filed as PDFs by ITP line.</div></div>
        {eng && <button className="btn pri" disabled={!sel.size} onClick={() => setSending(true)}>Send {sel.size ? `${sel.size} ${sel.size === 1 ? 'form' : 'forms'}` : 'forms'} to client</button>}
      </div>
      {eng && unsent.length > 0 && <div className="row"><button className="link" onClick={() => setSel(new Set(unsent.map((r) => r.id)))}>Select all {unsent.length} not sent yet</button>{sel.size > 0 && <button className="link" onClick={() => setSel(new Set())}>Clear</button>}</div>}
      {msg && <div className="toast" role="status">{msg}</div>}
      {records === null && <span className="sub">Loading…</span>}
      {records && done.length === 0 && <div className="note info">No approved forms yet.</div>}
      {done.length > 0 && (
        <div className="tablebox"><table>
          <thead><tr>{eng && <th style={{ width: 44 }}><span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden' }}>Select</span></th>}<th>Record</th><th>ITP line</th><th>Day of work</th><th>Approved</th><th>Sent to client</th></tr></thead>
          <tbody>{done.map((r) => (
            <tr key={r.id}>
              {eng && <td>{!r.packId && <input type="checkbox" aria-label={`Select ${r.ref}`} checked={sel.has(r.id)} onChange={() => toggle(r.id)} style={{ width: 22, height: 22, accentColor: 'var(--brand)' }} />}</td>}
              <td><button className="link mono" onClick={() => r.pdfPath && open(r.pdfPath)}>{r.ref}{r.version > 1 ? ` v${r.version}` : ''}.pdf</button><div className="sub">{r.code} {formFor(r.code)?.title} · <Link to={`/r/${r.id}`}>open form</Link></div></td>
              <td>Line {r.itemNo}</td>
              <td>{isoToDMY(r.date)}</td>
              <td>{r.approvedAt?.split(',')[0]}<div className="sub">{r.approvedBy}</div></td>
              <td><span className={'chip ' + (r.packName ? 'sent' : 'draft')}>{r.packName || 'Not sent'}</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}

      {sending && (
        <div className="scrim" role="presentation">
          <div className="modal" role="dialog" aria-modal="true" aria-label="Send to client">
            <header><div><h2>Send {sel.size} {sel.size === 1 ? 'form' : 'forms'} to the client</h2><div className="sub" style={{ marginTop: 4 }}>HoldPoint makes one PDF pack with a cover sheet, files it in Submitted Documents and downloads it for you to email.</div></div></header>
            <div className="body">
              <label className="f">Sent to<input value={to} onChange={(e) => setTo(e.target.value)} placeholder={`e.g. ${p.client} client representative`} /></label>
              <label className="f">Note on the cover sheet (optional)<textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} /></label>
              {busy && <div className="note info">{busy}</div>}
            </div>
            <footer><button className="btn" onClick={() => setSending(false)} disabled={!!busy}>Cancel</button><button className="btn pri" disabled={!to.trim() || !!busy} onClick={send}>Make pack and download</button></footer>
          </div>
        </div>
      )}
    </div>
  );
}
