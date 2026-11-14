import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { isoToDMY } from '../../lib/checks';
import { templateFor } from '../../data/templates';
import type { Submission } from '../../types';

export default function SupReturned() {
  const { role } = useAuth();
  const [subs, setSubs] = useState<Submission[] | null>(null);
  useEffect(() => onSnapshot(query(collection(db, 'submissions'), where('region', '==', role!.region), where('status', '==', 'returned')),
    (s) => setSubs(s.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Submission, 'id'>) })))), [role]);
  return (
    <main className="page narrow">
      <div><h1>Returned forms</h1><div className="sub">Forms the engineer sent back with comments. Fix them, then submit from the project's day.</div></div>
      {subs === null && <span className="sub">Loading…</span>}
      {subs?.length === 0 && <div className="note ok">Nothing returned. All good.</div>}
      {subs?.map((s) => (
        <Link key={s.id} to={`/supervisor/p/${s.projectId}/${s.date}/${s.formCode}`} className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="spread"><strong>{s.formCode} · {templateFor(s.formCode)?.title}</strong><span className="chip returned">Returned · v{s.version}</span></div>
          <span className="sub">{s.header['Location ref.']} · {s.header['Job number']} · {isoToDMY(s.date)}</span>
          {s.returnNote && <div className="cmt">{s.returnNote}</div>}
          <span className="sub">{Object.keys(s.comments || {}).length} field comments</span>
        </Link>
      ))}
    </main>
  );
}
