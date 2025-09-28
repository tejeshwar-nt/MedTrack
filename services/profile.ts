import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../config/firebase';
import type { AnyProfile, PatientProfile, ProviderProfile } from '../models/userProfiles';

const COLLECTION = 'profiles';

export async function getProfile(uid: string): Promise<AnyProfile | null> {
  const ref = doc(db, COLLECTION, uid);
  try {
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return snap.data() as AnyProfile;
  } catch (error) {
    console.log('getProfile error:', error);
    throw error;
  }
}

export async function upsertPatientProfile(profile: PatientProfile): Promise<void> {
  const ref = doc(db, COLLECTION, profile.uid);
  await setDoc(ref, profile, { merge: true });
}

export async function upsertProviderProfile(profile: ProviderProfile): Promise<void> {
  const ref = doc(db, COLLECTION, profile.uid);
  try {
    console.log('Attempting to save provider profile:', profile);
    await setDoc(ref, profile, { merge: true });
    console.log('Provider profile saved successfully');
  } catch (error) {
    console.log('upsertProviderProfile error:', error);
    throw error;
  }
}

export async function listPatients(): Promise<PatientProfile[]> {
  try {
    const q = query(collection(db, COLLECTION), where('role', '==', 'patient'));
    const snap = await getDocs(q);
    const out: PatientProfile[] = [];
    snap.forEach((d) => {
      const data = d.data() as any;
      // Only keep expected fields
      out.push({ uid: data.uid ?? d.id, role: 'patient', displayName: data.displayName ?? 'Patient', email: data.email ?? '' });
    });
    return out;
  } catch (error) {
    console.log('listPatients error:', error);
    throw error;
  }
}

