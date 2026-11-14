import { useAuth } from '../lib/auth';

export default function Login() {
  const { signIn, error } = useAuth();
  return (
    <div className="center">
      <div className="card" style={{ maxWidth: 400, width: '100%', alignItems: 'stretch' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src="/icon-192.png" alt="" width={44} height={44} style={{ borderRadius: 10 }} />
          <div><h1>HoldPoint</h1><div className="sub">ITP-driven QA sign-off · by CodeVolve</div></div>
        </div>
        <button className="btn big pri" onClick={signIn}>Sign in with Google</button>
        {error && <div className="err">{error}</div>}
        <p className="sub" style={{ margin: 0 }}>Only accounts the admin has added can get in. Supervisors see projects in their region; engineers review and approve.</p>
      </div>
    </div>
  );
}
