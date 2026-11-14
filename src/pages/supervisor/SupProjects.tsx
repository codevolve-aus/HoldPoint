import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { formsFromItp } from '../../lib/db';
import type { Project } from '../../types';

export default function SupProjects() {
  const { role } = useAuth();
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => onSnapshot(query(collection(db, 'projects'), where('region', '==', role!.region)),
    (s) => setProjects(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Project, 'id'>) }))), (e) => setErr(e.message)), [role]);

  return (
    <main className="page narrow">
      <div className="card" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <div><div className="sub">Your region</div><strong style={{ fontSize: 17 }}>{role!.region}</strong></div>
        <span className="sub" style={{ maxWidth: 200, textAlign: 'right' }}>Set by the admin. You only see projects in your region.</span>
      </div>
      {err && <div className="note bad">{err}</div>}
      {projects === null && <span className="sub">Loading…</span>}
      {projects?.length === 0 && <div className="note info">No projects yet. The engineer publishes an ITP to your region first.</div>}
      {projects?.map((p) => (
        <Link key={p.id} to={`/supervisor/p/${p.id}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="spread"><strong style={{ fontSize: 16 }}>{p.name}</strong><span className="chip approved">Active</span></div>
          <span className="sub">{p.jobNo} · {p.client}</span>
          <div className="rep">
            <div className="spread"><strong>{p.location}</strong><span style={{ color: '#C2410C', fontWeight: 600 }}>Open ›</span></div>
            <span className="sub">ITP {p.itp.docId} {p.itp.rev} · {p.itp.items.length} items · {formsFromItp(p).length} QF forms</span>
          </div>
        </Link>
      ))}
    </main>
  );
}
