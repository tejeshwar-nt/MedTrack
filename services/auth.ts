import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    updateProfile,
    type User,
  } from "firebase/auth";
  import { auth } from "../config/firebase";
  
  export function listenToAuth(cb: (u: User | null) => void) {
    return onAuthStateChanged(auth, cb);
  }
  
  export async function signIn(email: string, password: string) {
    await signInWithEmailAndPassword(auth, email, password);
  }
  
  export async function signUp(email: string, password: string, displayName?: string) {
    const { user } = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) await updateProfile(user, { displayName });
    return user;
  }
  
  export function signOutUser() {
    return signOut(auth);
  }