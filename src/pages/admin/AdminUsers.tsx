import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAuth } from '../../lib/auth';
import { audit } from '../../lib/db';
import type { Role, RoleDoc } from '../../types';

export const REGIONS = ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'];

export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<RoleDoc[]>([]);
  const [form, setForm] = useState({ email: '', name: '', role: 'supervisor' as Role, region: 'Sydney' });
  const [msg, setMsg] = useState('');

  useEffect(() => onSnapshot(collection(db, 'roles'), (s) => setUsers(s.docs.map((d) => d.data() as RoleDoc).sort((a, b) => a.role.localeCompare(b.role)))), []);

  const office = form.role !== 'supervisor';
  const save = async () => {
    const email = form.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || !form.name.trim()) { setMsg('Enter a Google email and a name.'); return; }
    const r: RoleDoc = { email, name: form.name.trim(), role: form.role, region: office ? 'All regions' : form.region };
    await setDoc(doc(db, 'roles', email), r);
    await audit(user!.email!, `Gave ${email} the ${r.role} role (${r.region})`);
    setMsg(`${r.name} can now sign in with Google as ${r.role}.`); setForm({ ...form, email: '', name: '' });
  };

  return (
    <main className="page">
      <div><h1>Users</h1><div className="sub">Add the Google account of each person and give them a role. They sign in with "Sign in with Google".</div></div>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <section className="card" style={{ flex: '2 1 480px' }}>
          <h2>People with access</h2>
          <table className="reg">
            <thead><tr><th>Name</th><th>Google email</th><th>Role</th><th>Region</th><th></th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.email}>
                  <td>{u.name}</td><td>{u.email}</td><td style={{ textTransform: 'capitalize' }}>{u.role}</td><td>{u.region}</td>
                  <td>{u.email !== user?.email?.toLowerCase() && (
                    <button className="btn sm bad" onClick={async () => { if (confirm(`Remove access for ${u.email}?`)) { await deleteDoc(doc(db, 'roles', u.email)); await audit(user!.email!, `Removed access for ${u.email}`); } }}>Remove</button>
                  )}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card" style={{ flex: '1 1 300px' }}>
          <h2>Add a person</h2>
          <label className="f">Google email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="name@gmail.com" /></label>
          <label className="f">Name<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. A. Supervisor" /></label>
          <div className="f">Role
            <div className="pills">
              {(['supervisor', 'engineer', 'admin'] as Role[]).map((r) => (
                <button key={r} type="button" className={'pill' + (form.role === r ? ' on' : '')} onClick={() => setForm({ ...form, role: r })} style={{ textTransform: 'capitalize' }}>{r}</button>
              ))}
            </div>
          </div>
          {!office && <label className="f">Region (one per supervisor)
            <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}>{REGIONS.map((r) => <option key={r}>{r}</option>)}</select>
          </label>}
          <span className="sub">{form.role === 'supervisor' ? 'Sees only projects in this region. Fills and submits QF forms.' : form.role === 'engineer' ? 'All regions. Sets up projects, reviews, approves or returns forms.' : 'Manages users only.'}</span>
          <button className="btn pri" onClick={save}>Give access</button>
          {msg && <div className="note info">{msg}</div>}
        </section>
      </div>
    </main>
  );
}
