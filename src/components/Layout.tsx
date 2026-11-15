import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import FolderTree from './FolderTree';

const MENUS: Record<string, [string, string][]> = {
  admin: [['/admin', 'Users'], ['/admin/company', 'Company']],
  engineer: [['/', 'Home'], ['/templates', 'QF Form Templates']],
  supervisor: [['/', 'Home'], ['/templates', 'QF Form Templates']]
};

/**
 * Laptops (engineers): the folder tree stays on the left.
 * Tablets (supervisors): a Folders button opens the tree as a drawer, so forms and the ITP get the full width.
 */
export default function Layout() {
  const { role, user, signOutNow } = useAuth();
  const loc = useLocation();
  const [online, setOnline] = useState(navigator.onLine);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  useEffect(() => setOpen(false), [loc.pathname]);
  const menu = role ? MENUS[role.role] : [];
  const tree = role?.role !== 'admin';
  return (
    <>
      <header className="top">
        {tree && (
          <button className="folders-btn" aria-expanded={open} onClick={() => setOpen(!open)}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2 6a1.5 1.5 0 0 1 1.5-1.5h4.2l1.8 2h7a1.5 1.5 0 0 1 1.5 1.5v6.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 2 14.5z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /></svg>
            Folders
          </button>
        )}
        <NavLink to="/" className="brand">
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><rect x="1" y="1" width="24" height="24" rx="6" stroke="#F97316" strokeWidth="2" /><path d="M8 7v12M18 7v12M8 13h10" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" /></svg>
          HoldPoint <small>by CodeVolve</small>
        </NavLink>
        <nav aria-label="Main menu">
          {menu.map(([to, label]) => <NavLink key={to} to={to} end>{label}</NavLink>)}
        </nav>
        <span style={{ flex: 1 }} className="spacer" />
        <span className="who"><b>{role?.name || user?.email}</b><br />{role?.role === 'supervisor' ? `Supervisor · ${role.region}` : role?.role === 'engineer' ? 'Engineer · All regions' : 'Admin'}</span>
        <button className="out" onClick={signOutNow}>Sign out</button>
      </header>
      {!online && <div className="offline" role="status">Offline · your entries are saved on this device and sync when you're back online. Photos and PDFs need a signal.</div>}
      <div className="shell">
        {tree && <>
          <button className={'tree-scrim' + (open ? ' open' : '')} aria-label="Close folders" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1} />
          <aside className={'tree-aside' + (open ? ' open' : '')} aria-label="Project folders">
            <FolderTree onClose={() => setOpen(false)} />
          </aside>
        </>}
        <main><Outlet /></main>
      </div>
    </>
  );
}
