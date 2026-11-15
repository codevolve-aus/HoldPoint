import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { configured } from './lib/firebase';
import Layout from './components/Layout';
import Login from './pages/Login';
import Home from './pages/Home';
import ProjectDocs from './pages/ProjectDocs';
import Completed from './pages/Completed';
import Submitted from './pages/Submitted';
import ItpView from './pages/ItpView';
import RecordView from './pages/RecordView';
import Templates from './pages/Templates';
import AdminUsers from './pages/AdminUsers';
import AdminCompany from './pages/AdminCompany';

// The ITP reader (pdf.js, mammoth) is engineer-only: load it when needed.
const ItpUpload = lazy(() => import('./pages/ItpUpload'));

function ProjectRedirect() { const { pid } = useParams(); return <Navigate to={`/p/${pid}/docs`} replace />; }

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

  const eng = role.role === 'engineer';
  return (
    <Suspense fallback={<div className="center"><span className="sub">Loading…</span></div>}>
      <Routes>
        <Route element={<Layout />}>
          {role.role === 'admin' ? <>
            <Route path="/admin" element={<AdminUsers />} />
            <Route path="/admin/company" element={<AdminCompany />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </> : <>
            <Route path="/" element={<Home />} />
            {eng && <Route path="/new" element={<ItpUpload />} />}
            {eng && <Route path="/p/:pid/upload" element={<ItpUpload />} />}
            <Route path="/p/:pid" element={<ProjectRedirect />} />
            <Route path="/p/:pid/docs" element={<ProjectDocs />} />
            <Route path="/p/:pid/itp/:rid" element={<ItpView />} />
            <Route path="/p/:pid/completed" element={<Completed />} />
            <Route path="/p/:pid/submitted" element={<Submitted />} />
            <Route path="/r/:rid" element={<RecordView />} />
            <Route path="/templates" element={<Templates />} />
            <Route path="/templates/:code" element={<Templates />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>}
        </Route>
      </Routes>
    </Suspense>
  );
}
