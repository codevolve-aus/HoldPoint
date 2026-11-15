import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useProjects } from '../lib/db';
import type { Project } from '../types';

const Folder = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1.5 4.5a1 1 0 0 1 1-1h3.6l1.4 1.6h6a1 1 0 0 1 1 1v6.4a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>;
const Doc = () => <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2.5" y="1.5" width="11" height="13" rx="1.5" stroke="currentColor" strokeWidth="1.4" /><path d="M5 5h6M5 8h6M5 11h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>;
const Chev = ({ open }: { open: boolean }) => <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d={open ? 'M3 4.5 6 7.5 9 4.5' : 'M4.5 3 7.5 6 4.5 9'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export const QA_FOLDERS: [string, string][] = [['docs', 'Project Documents'], ['completed', 'Completed Documents'], ['submitted', 'Submitted Documents']];

/** Year › Client › Project › QA › Project Documents / Completed Documents / Submitted Documents, plus the QF Form Templates library. */
export default function FolderTree({ onClose }: { onClose: () => void }) {
  const { role } = useAuth();
  const projects = useProjects();
  const loc = useLocation();
  const m = /^\/p\/([^/]+)(?:\/([^/]+))?/.exec(loc.pathname);
  const pid = m?.[1]; const sub = m?.[2] || 'docs';
  const current = projects?.find((p) => p.id === pid);
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set());

  const years = useMemo(() => {
    const out = new Map<number, Map<string, Project[]>>();
    for (const p of projects || []) {
      const y = out.get(p.year) || new Map<string, Project[]>(); out.set(p.year, y);
      y.set(p.client, [...(y.get(p.client) || []), p]);
    }
    return [...out.entries()].sort((a, b) => b[0] - a[0]);
  }, [projects]);

  // Open the path to the project on screen, and the latest year by default.
  useEffect(() => {
    const s = new Set(openKeys);
    if (years[0]) s.add(`y${years[0][0]}`);
    if (current) { s.add(`y${current.year}`); s.add(`c${current.year}/${current.client}`); s.add(`p${current.id}`); }
    setOpenKeys(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, years.length]);
  const toggle = (k: string) => { const s = new Set(openKeys); s.has(k) ? s.delete(k) : s.add(k); setOpenKeys(s); };
  const pad = (depth: number) => ({ paddingLeft: 10 + depth * 16 });

  return (
    <nav aria-label="Project folders" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div className="tree-head"><span>Projects</span>
        <button className="iconbtn tree-close" aria-label="Close folders" onClick={onClose}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M2 2l10 10M12 2 2 12" stroke="#15181C" strokeWidth="1.8" strokeLinecap="round" /></svg></button>
      </div>
      {role?.role === 'engineer' && <Link to="/new" className="tree-row" style={{ color: 'var(--brand)', fontWeight: 600 }}>+ New project</Link>}
      {projects === null && <span className="sub" style={{ padding: 10 }}>Loading…</span>}
      {projects?.length === 0 && <span className="sub" style={{ padding: 10 }}>{role?.role === 'engineer' ? 'No projects yet. Start with + New project.' : 'No projects in your region yet.'}</span>}
      {years.map(([year, clients]) => {
        const yk = `y${year}`, yo = openKeys.has(yk);
        return (
          <div key={year} style={{ display: 'contents' }}>
            <button className="tree-row headrow" style={pad(0)} aria-expanded={yo} onClick={() => toggle(yk)}><Chev open={yo} />{year}<span className="count">{[...clients.values()].reduce((n, l) => n + l.length, 0)}</span></button>
            {yo && [...clients.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([client, list]) => {
              const ck = `c${year}/${client}`, co = openKeys.has(ck);
              return (
                <div key={client} style={{ display: 'contents' }}>
                  <button className="tree-row headrow" style={pad(1)} aria-expanded={co} onClick={() => toggle(ck)}><Chev open={co} />{client}</button>
                  {co && list.map((p) => {
                    const pk = `p${p.id}`, po = openKeys.has(pk);
                    return (
                      <div key={p.id} style={{ display: 'contents' }}>
                        <button className="tree-row" style={{ ...pad(2), fontWeight: p.id === pid ? 600 : 400 }} aria-expanded={po} onClick={() => toggle(pk)}>
                          <Chev open={po} /><span style={{ minWidth: 0 }}>{p.jobNo} · {p.name}{p.status === 'closed' ? ' (closed)' : ''}</span>
                        </button>
                        {po && <>
                          <div className="tree-row headrow" style={pad(3)}><Folder />QA</div>
                          {QA_FOLDERS.map(([key, label]) => {
                            const on = p.id === pid && (sub === key || (key === 'docs' && sub === 'itp'));
                            return <Link key={key} to={`/p/${p.id}/${key}`} className={'tree-row' + (on ? ' on' : '')} style={pad(4)} aria-current={on ? 'page' : undefined}><Folder />{label}</Link>;
                          })}
                        </>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="tree-gap" />
      <Link to="/templates" className={'tree-row' + (loc.pathname.startsWith('/templates') ? ' on' : '')}><Doc />QF Form Templates</Link>
    </nav>
  );
}
