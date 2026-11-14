import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, google } from './firebase';
import type { RoleDoc } from '../types';

interface AuthState {
  user: User | null;
  role: RoleDoc | null;
  loading: boolean;
  error: string;
  signIn: () => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOutNow: () => Promise<void>;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<RoleDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u); setRole(null); if (u) setError(''); // keep the 'admins must use Google' message after the forced sign-out
    if (u?.email) {
      try {
        const snap = await getDoc(doc(db, 'roles', u.email.toLowerCase()));
        const r = snap.exists() ? (snap.data() as RoleDoc) : null;
        // Admins must use Google; test passwords are only for engineers and supervisors.
        if (r?.role === 'admin' && (await u.getIdTokenResult()).signInProvider !== 'google.com') {
          await signOut(auth);
          setError('Admins must sign in with Google.');
          setLoading(false);
          return;
        }
        setRole(r);
      } catch (e: any) {
        setError(e?.message || 'Could not read your access');
      }
    }
    setLoading(false);
  }), []);

  const signIn = async () => {
    setError('');
    try {
      await signInWithPopup(auth, google);
    } catch (e: any) {
      // Installed PWAs on some phones block popups: fall back to a full-page redirect.
      if (e?.code === 'auth/popup-blocked' || e?.code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, google);
      else if (e?.code !== 'auth/popup-closed-by-user') setError(e?.message || 'Sign-in failed');
    }
  };

  const signInWithPassword = async (email: string, password: string) => {
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
    } catch (e: any) {
      const bad = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found', 'auth/invalid-email'];
      setError(bad.includes(e?.code) ? 'Wrong email or password.' : e?.code === 'auth/too-many-requests' ? 'Too many attempts. Try again in a few minutes.' : e?.message || 'Sign-in failed');
    }
  };

  return (
    <Ctx.Provider value={{ user, role, loading, error, signIn, signInWithPassword, signOutNow: () => signOut(auth) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
