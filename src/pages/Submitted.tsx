import { useParams } from 'react-router-dom';
import { getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { isoToDMY, usePacks, useProject } from '../lib/db';
import Crumbs from '../components/Crumbs';

/** Submitted Documents: QA packs the engineer has sent to the client, each kept exactly as it was sent. */
export default function Submitted() {
  const { pid } = useParams();
  const p = useProject(pid);
  const packs = usePacks(p);
  if (p === undefined) return <div className="page wide"><span className="sub">Loading…</span></div>;
  if (!p) return <div className="page wide"><div className="note bad">This project isn't available.</div></div>;
  const open = async (path: string) => { const w = window.open('', '_blank'); const url = await getDownloadURL(ref(storage, path)); if (w) w.location.href = url; };
  return (
    <div className="page wide" style={{ maxWidth: 1200 }}>
      <Crumbs p={p} leaf={['Submitted Documents']} />
      <div><h1>Submitted Documents</h1><div className="sub">QA packs sent to the client. Each pack keeps the exact PDF that was sent.</div></div>
      {packs === null && <span className="sub">Loading…</span>}
      {packs?.length === 0 && <div className="note info">Nothing sent yet. The engineer sends approved forms from Completed Documents.</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
        {(packs || []).map((k) => (
          <article key={k.id} className="card">
            <div className="spread"><h2>{k.name}</h2><span className="chip sent">Sent {k.createdAt.split(',')[0]}</span></div>
            <div className="sub">To {k.sentTo} · {k.refs.length} {k.refs.length === 1 ? 'form' : 'forms'} · by {k.createdBy}</div>
            {k.note && <div style={{ fontSize: 14 }}>{k.note}</div>}
            <div className="list">{k.refs.map((r) => <div key={r.ref} className="spread" style={{ padding: '6px 0' }}><span className="mono">{r.ref}</span><span className="sub">Line {r.itemNo} · {isoToDMY(r.date)}</span></div>)}</div>
            <button className="btn" onClick={() => open(k.pdfPath)}>Open pack PDF</button>
          </article>
        ))}
      </div>
    </div>
  );
}
