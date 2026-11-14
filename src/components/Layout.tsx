import { NavLink, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';

const MENUS: Record<string, [string, string][]> = {
  admin: [['/admin', 'Users']],
  engineer: [['/engineer', 'Review queue'], ['/engineer/itps', 'ITPs and projects'], ['/engineer/records', 'QA records']],
  supervisor: [['/supervisor', 'My projects'], ['/supervisor/returned', 'Returned forms']]
};

export default function Layout() {
  const { role, user, signOutNow } = useAuth();
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener('online', on); window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  const menu = role ? MENUS[role.role] : [];
  return (
    <>
      <header className="top">
        <span className="brand">HoldPoint</span>
        <nav aria-label="Main menu">
          {menu.map(([to, label]) => <NavLink key={to} to={to} end>{label}</NavLink>)}
        </nav>
        <span className="who">{role?.name || user?.email} · {role?.role}{role?.role === 'supervisor' ? ' · ' + role.region : ''}</span>
        <button className="out" onClick={signOutNow}>Sign out</button>
      </header>
      {!online && <div className="offline" role="status">Offline · your entries are saved on this device and sync when you're back online. Photos upload when online.</div>}
      <Outlet />
    </>
  );
}
