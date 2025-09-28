import { db } from '../config/firebase';
import { addDoc, collection, serverTimestamp, getDocs, query, where, orderBy, doc, setDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '../config/firebase';
import { AnyRecord, createImageRecord, createTextRecord } from '../models/record';
import { auth } from '../config/firebase';

const storage = getStorage(app);

// Replace all undefined values with null to ensure Firestore keeps explicit fields
function replaceUndefinedWithNull(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(replaceUndefinedWithNull);
  if (typeof value === 'object') {
    const out: any = {};
    for (const k of Object.keys(value)) {
      const v = (value as any)[k];
      out[k] = replaceUndefinedWithNull(v);
    }
    return out;
  }
  return value;
}

export async function saveTextRecord(userText: string): Promise<AnyRecord> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const record = createTextRecord({ patientUid: uid, userText });
  // Firestore rejects fields with undefined. Drop optional id before write.
  const { id: _omitId, ...writeable } = record as any;
  try {
    // Pre-generate a doc id so we can store it inside the document
    const colRef = collection(db, 'records');
    const docRef = doc(colRef);
    const payload = replaceUndefinedWithNull({ ...writeable, id: docRef.id, createdAt: record.createdAt, serverTime: serverTimestamp() });
    await setDoc(docRef, payload);
    console.log('[records] Saved text record', docRef.id, 'uid:', uid);
    return { ...record, id: docRef.id };
  } catch (e) {
    console.error('[records] addDoc(text) failed', e);
    throw e;
  }
}

export async function saveImageRecord(imageUrl: string, userText: string): Promise<AnyRecord> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const record = createImageRecord({ patientUid: uid, imageUrl, userText });
  const { id: _omitId2, ...writeable } = record as any;
  try {
    const colRef = collection(db, 'records');
    const docRef = doc(colRef);
    const payload = replaceUndefinedWithNull({ ...writeable, id: docRef.id, createdAt: record.createdAt, serverTime: serverTimestamp(), llmText: (writeable as any).llmText ?? null });
    await setDoc(docRef, payload);
    console.log('[records] Saved image record', docRef.id, 'url:', imageUrl, 'uid:', uid);
    return { ...record, id: docRef.id };
  } catch (e) {
    console.error('[records] addDoc(image) failed', e);
    throw e;
  }
}

// Group all of the current user's records by UTC day (YYYY-MM-DD)
/**
 * Fetch all records for a patient and group them by UTC day.
 *
 * Output format (keyed by YYYY-MM-DD):
 * {
 *   "2025-09-27": [
 *     { kind: 'text', userText: 'Felt dizzy in the morning', patientUid: 'uid1', createdAt: 1758921000000, id: 'docA' },
 *     { kind: 'image', imageUrl: 'https://.../rash.jpg', userText: 'Rash on arm', patientUid: 'uid1', createdAt: 1758924600000, id: 'docB' }
 *   ],
 *   "2025-09-28": [
 *     { kind: 'text', userText: 'Better after lunch', patientUid: 'uid1', createdAt: 1759007400000, id: 'docC' }
 *   ]
 * }
 */

export async function uploadImage(uri: string, path: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, path+"/"+Date.now());
  const result = await uploadBytes(storageRef, blob);
  const image = await getDownloadURL(result.ref);
  return image;
}

export async function fetchRecordsGroupedByDay(patientUid?: string): Promise<Record<string, AnyRecord[]>> {
  const uid = patientUid ?? auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  const q = query(
    collection(db, 'records'),
    where('patientUid', '==', uid),
    orderBy('createdAt', 'asc')
  );
  const snap = await getDocs(q);

  const byDay: Record<string, AnyRecord[]> = {};

  snap.forEach(doc => {
    const data: any = doc.data();
    // Normalize createdAt to milliseconds
    const createdAt: number = typeof data.createdAt === 'number'
      ? data.createdAt
      : (typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : Date.now());

    const record: AnyRecord = {
      ...data,
      id: doc.id,
      createdAt,
    } as AnyRecord;

    const dayKey = new Date(createdAt).toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
    if (!byDay[dayKey]) byDay[dayKey] = [];
    byDay[dayKey].push(record);
  });

  return byDay;
}


