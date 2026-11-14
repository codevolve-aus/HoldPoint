import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { configured } from './lib/firebase';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminUsers from './pages/admin/AdminUsers';
import Itps from './pages/engineer/Itps';
import ItpUpload from './pages/engineer/ItpUpload';
import SupProjects from './pages/supervisor/SupProjects';
import SupDay from './pages/supervisor/SupDay';
import SupForm from './pages/supervisor/SupForm';
import SupReturned from './pages/supervisor/SupReturned';
import Queue from './pages/engineer/Queue';
import Review from './pages/engineer/Review';
import Records from './pages/engineer/Records';

export default function App() {
  const { user, role, loading, error, signOutNow } = useAuth();

  if (!configured) return (
    <div className="center"><div className="card" style={{ maxWidth: 520 }}>
      <h1>Connect Firebase</h1>
      <p className="sub">Copy <code>.env.example</code> to <code>.env.local</code>, paste your Firebase web app settings, then restart <code>npm run dev</code>. See README.md.</p>
    </div></div>
  );
  if (loading) return <div className="center"><span className="sub">Loading…</span></div>;
  if (!user) return <Login />;
  if (!role) return (
    <div className="center"><div className="card" style={{ maxWidth: 480 }}>
      <h1>No access yet</h1>
      <p className="sub">You're signed in as <strong>{user.email}</strong>, but this account hasn't been given a role. Ask the admin to add this email on the Users page.</p>
      {error && <p className="err">{error}</p>}
      <button className="btn" onClick={signOutNow}>Sign out</button>
    </div></div>
  );

  const home = role.role === 'admin' ? '/admin' : role.role === 'engineer' ? '/engineer' : '/supervisor';
  return (
    <Routes>
      <Route element={<Layout />}>
        {role.role === 'admin' && <>
          <Route path="/admin" element={<AdminUsers />} />
        </>}
        {role.role === 'engineer' && <>
          <Route path="/engineer" element={<Queue />} />
          <Route path="/engineer/review/:id" element={<Review />} />
          <Route path="/engineer/records" element={<Records />} />
          <Route path="/engineer/itps" element={<Itps />} />
          <Route path="/engineer/itp/new" element={<ItpUpload />} />
        </>}
        {role.role === 'supervisor' && <>
          <Route path="/supervisor" element={<SupProjects />} />
          <Route path="/supervisor/returned" element={<SupReturned />} />
          <Route path="/supervisor/p/:pid" element={<SupDay />} />
          <Route path="/supervisor/p/:pid/:date/:code" element={<SupForm />} />
        </>}
        <Route path="*" element={<Navigate to={home} replace />} />
      </Route>
    </Routes>
  );
}
