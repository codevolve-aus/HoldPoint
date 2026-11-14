import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { isoToDMY } from '../../lib/checks';

interface Reg { id: string; approvedAtText: string; approvedBy: string; region: string; jobNo: string; project: string; location: string; date: string; form: string; version: number; submittedBy: string; path: string }

/** Approved forms register. Files are in Storage under Approved/Region/Job Project/Site location/Date. */
export default function Records() {
  const [rows, setRows] = useState<Reg[] | null>(null);
  useEffect(() => onSnapshot(query(collection(db, 'register'), orderBy('approvedAt', 'desc')),
    (s) => setRows(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Reg, 'id'>) })))), []);

  const openPdf = async (path: string) => { const w = window.open('', '_blank'); const url = await getDownloadURL(ref(storage, path)); if (w) w.location.href = url; else window.location.href = url; };
  const csv = () => {
    const head = ['Approved', 'Approved by', 'Region', 'Job no.', 'Project', 'Site location', 'Work date', 'Form', 'Version', 'Submitted by', 'File'];
    const body = (rows || []).map((r) => [r.approvedAtText, r.approvedBy, r.region, r.jobNo, r.project, r.location, r.date, r.form, r.version, r.submittedBy, r.path]);
    const text = [head, ...body].map((l) => l.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv' })); a.download = 'Approved register.csv'; a.click();
  };

  return (
    <main className="page">
      <div className="spread">
        <div><h1>QA records</h1><div className="sub">Only approved forms appear here. Folder: Approved / Region / Job no. Project / Site location / Date</div></div>
        <button className="btn" onClick={csv} disabled={!rows?.length}>Download register (CSV)</button>
      </div>
      <section className="card" style={{ overflowX: 'auto' }}>
        {rows === null && <span className="sub">Loading…</span>}
        {rows?.length === 0 && <span className="sub">Nothing approved yet.</span>}
        {!!rows?.length && (
          <table className="reg">
            <thead><tr><th>Work date</th><th>Form</th><th>Project · location</th><th>Region</th><th>Approved</th><th>File</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{isoToDMY(r.date)}</td><td><strong>{r.form}</strong> v{r.version}</td>
                  <td>{r.jobNo} {r.project}<div className="sub">{r.location}</div></td><td>{r.region}</td>
                  <td>{r.approvedAtText}<div className="sub">{r.approvedBy}</div></td>
                  <td><button className="link" onClick={() => openPdf(r.path)}>Open PDF</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
