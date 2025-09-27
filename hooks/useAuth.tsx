import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { listenToAuth, signIn, signUp, signOutUser } from "../services/auth";
import type { AnyProfile } from "../models/userProfiles";
import { createPatientProfile, createProviderProfile } from "../models/userProfiles";
import { getProfile, upsertPatientProfile, upsertProviderProfile } from "../services/profile";
import { auth } from "../config/firebase";

type AuthCtx = {
  user: User | null;
  initializing: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name?: string) => Promise<User | void>;
  signOut: () => Promise<void>;
  profile: AnyProfile | null;
  createPatientProfile: (displayName: string) => Promise<void>;
  createProviderProfile: (displayName: string, license?: string) => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [profile, setProfile] = useState<AnyProfile | null>(null);

  useEffect(() => {
    return listenToAuth(async u => {
      setUser(u);
      if (u) {
        try {
          const p = await getProfile(u.uid);
          console.log('Profile loaded:', p);
          setProfile(p);
        } catch (error) {
          console.log('Failed to load profile:', error);
          setProfile(null);
        }
      } else {
        setProfile(null);
      }
      setInitializing(false);
    });
  }, []);

  const value = useMemo(() => ({
    user,
    initializing,
    signIn,
    signUp,
    signOut: signOutUser,
    profile,
    createPatientProfile: async (displayName: string) => {
      const current = user ?? auth.currentUser;
      if (!current) throw new Error("Not authenticated");
      const p = createPatientProfile({ uid: current.uid, displayName, email: current.email ?? "" });
      await upsertPatientProfile(p);
      setProfile(p);
    },
    createProviderProfile: async (displayName: string, license?: string) => {
      const current = user ?? auth.currentUser;
      if (!current) throw new Error("Not authenticated");
      const p = createProviderProfile({ uid: current.uid, displayName, email: current.email ?? "", license });
      console.log('Creating provider profile:', p);
      await upsertProviderProfile(p);
      console.log('Provider profile created successfully');
      setProfile(p);
    },
  }), [user, initializing, profile]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}