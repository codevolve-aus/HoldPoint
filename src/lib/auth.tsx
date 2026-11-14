import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db, google } from './firebase';
import type { RoleDoc } from '../types';

interface AuthState {
  user: User | null;
  role: RoleDoc | null;
  loading: boolean;
  error: string;
  signIn: () => Promise<void>;
  signOutNow: () => Promise<void>;
}

const Ctx = createContext<AuthState>(null as unknown as AuthState);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<RoleDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => onAuthStateChanged(auth, async (u) => {
    setUser(u); setRole(null); setError('');
    if (u?.email) {
      try {
        const snap = await getDoc(doc(db, 'roles', u.email.toLowerCase()));
        setRole(snap.exists() ? (snap.data() as RoleDoc) : null);
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

  return (
    <Ctx.Provider value={{ user, role, loading, error, signIn, signOutNow: () => signOut(auth) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
