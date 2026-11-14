import { useState } from 'react';
import { useAuth } from '../lib/auth';

export default function Login() {
  const { signIn, signInWithPassword, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setBusy(true);
    await signInWithPassword(email, password);
    setBusy(false);
  };

  return (
    <div className="center">
      <div className="card" style={{ maxWidth: 400, width: '100%', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 10 }} />
          <div><h1>HoldPoint</h1><div className="sub">ITP-driven QA sign-off · by CodeVolve</div></div>
        </div>
        <button className="btn big pri" onClick={signIn}>Sign in with Google</button>

        {/* Temporary test sign-in for engineers and supervisors. Admins must use Google. */}
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="sub" style={{ textAlign: 'center' }}>or, with a test password from your admin</div>
          <label className="f">Email<input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="f">Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
          <button className="btn big" type="submit" disabled={busy || !email.trim() || !password}>{busy ? 'Signing in…' : 'Sign in with password'}</button>
        </form>

        {error && <div className="err">{error}</div>}
        <p className="sub" style={{ margin: 0 }}>Only accounts the admin has added can get in. Supervisors see projects in their region; engineers review and approve. Admins sign in with Google.</p>
      </div>
    </div>
  );
}
