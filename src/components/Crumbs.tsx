import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import type { Project } from '../types';

/** Where you are in the folders: 2026 › Client › Job Project › QA › Project Documents. */
export default function Crumbs({ p, leaf, extra }: { p?: Project | null; leaf?: [string, string?]; extra?: string }) {
  const parts: [string, string?][] = p ? [[String(p.year)], [p.client], [`${p.jobNo} ${p.name}`, `/p/${p.id}/docs`], ['QA']] : [];
  if (leaf) parts.push(leaf);
  if (extra) parts.push([extra]);
  return (
    <nav className="crumbs" aria-label="Folder path">
      {parts.map(([t, to], i) => {
        const last = i === parts.length - 1;
        return (
          <Fragment key={i}>
            {last ? <b aria-current="page">{t}</b> : to ? <Link to={to} style={{ color: 'inherit' }}>{t}</Link> : <span>{t}</span>}
            {!last && <span aria-hidden="true">›</span>}
          </Fragment>
        );
      })}
    </nav>
  );
}
