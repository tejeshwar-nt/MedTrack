import { db } from '../config/firebase';
import { addDoc, collection, serverTimestamp, getDocs, query, where, orderBy, doc, setDoc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { app } from '../config/firebase';
import { AnyRecord, createImageRecord, createTextRecord, FollowUpQuestion } from '../models/record';
import { auth } from '../config/firebase';

const storage = getStorage(app);

// Shallowly replace undefined values with null to avoid mutating Firestore sentinel values (e.g., serverTimestamp())
function replaceUndefinedWithNullShallow(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) {
    out[k] = obj[k] === undefined ? null : obj[k];
  }
  return out;
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
    const payload = replaceUndefinedWithNullShallow({ ...writeable, id: docRef.id, createdAt: record.createdAt, serverTime: serverTimestamp() });
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
    const payload = replaceUndefinedWithNullShallow({ ...writeable, id: docRef.id, createdAt: record.createdAt, serverTime: serverTimestamp(), llmText: (writeable as any).llmText ?? null });
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

export async function uploadAudio(uri: string, path: string) {
  const response = await fetch(uri);
  const blob = await response.blob();
  const storageRef = ref(storage, `${path}/${Date.now()}.m4a`);
  const result = await uploadBytes(storageRef, blob, { contentType: (blob as any).type || 'audio/m4a' });
  return await getDownloadURL(result.ref);
}

export async function saveVoiceRecord(audioUrl: string, durationSec?: number): Promise<AnyRecord> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');
  const base = {
    patientUid: uid,
    kind: 'voice',
    audioUrl,
    audioDurationSec: durationSec ?? null,
    createdAt: Date.now(),
    followUps: [],
    llmText: null,
  } as any;
  const colRef = collection(db, 'records');
  const docRef = doc(colRef);
  const payload = replaceUndefinedWithNullShallow({ ...base, id: docRef.id, serverTime: serverTimestamp() });
  await setDoc(docRef, payload);
  return { ...(base as AnyRecord), id: docRef.id } as AnyRecord;
}

// --- LLM transcription (placeholder) ---
export async function transcribeAudioToText(audioUrl: string): Promise<string | null> {
  console.log('[llm] Transcribing audio from', audioUrl);
  
  // Define the endpoint on your FastAPI server
  const transcribeEndpoint = 'https://backend-apis-1039832299695.us-central1.run.app/transcribe_audio';

  try {
    // 1. Fetch the audio data from the provided URL
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio file: ${audioResponse.statusText}`);
    }
    const audioBlob = await audioResponse.blob();

    // 2. Create a FormData object to send the file
    const formData = new FormData();
    // The key 'file' must match what your FastAPI endpoint expects.
    // We'll give it a generic filename like 'audio.mp3'.
    formData.append('file', audioBlob, 'audio.mp3');

    // 3. Make the POST request to your backend
    const apiResponse = await fetch(transcribeEndpoint, {
      method: 'POST',
      body: formData, // No 'Content-Type' header needed; the browser sets it for FormData
    });

    if (!apiResponse.ok) {
      throw new Error(`API error! status: ${apiResponse.status}`);
    }

    // 4. Get the transcribed text from the response
    const transcribedText = await apiResponse.text(); // Your endpoint returns plain text
    
    console.log('[llm] Transcription successful.');
    return transcribedText;

  } catch (error) {
    console.error('Error during audio transcription:', error);
    return null; // Return null on failure
  }
}

export async function setRecordLlmText(recordId: string, llmText: string | null): Promise<void> {
  const ref = doc(db, 'records', recordId);
  await updateDoc(ref, replaceUndefinedWithNullShallow({ llmText }));
}

export function transcribeAndAttachLlmText(recordId: string, audioUrl: string) {
  (async () => {
    try {
      const text = await transcribeAudioToText(audioUrl);
      await setRecordLlmText(recordId, text);
      console.log('[llm] transcription stored for', recordId);
      // After transcription, also generate follow-up questions from the transcript
      if (text && text.trim().length > 0) {
        const followUps = await generateFollowUpsForText(text);
        await setRecordFollowUps(recordId, followUps);
        console.log('[llm] follow-ups stored for', recordId);
      }
    } catch (e) {
      console.warn('[llm] transcription failed', e);
    }
  })();
}

// --- Image description (placeholder) ---
export async function describeImageWithLlm(imageUrl: string): Promise<string | null> {
  console.log('[llm] Describing image from', imageUrl);

  // The endpoint on your FastAPI server
  const apiEndpoint = 'https://backend-apis-1039832299695.us-central1.run.app/transcribe_image';

  try {
    // 1. Fetch the image data from the provided URL
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image file: ${imageResponse.statusText}`);
    }
    const imageBlob = await imageResponse.blob();

    // 2. Create a FormData object to send the file
    const formData = new FormData();
    // The key 'file' must match what your FastAPI endpoint expects
    formData.append('file', imageBlob, 'image.jpg');

    // 3. Make the POST request to your backend
    const apiResponse = await fetch(apiEndpoint, {
      method: 'POST',
      body: formData, // The browser automatically sets the correct Content-Type header
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error("Server responded with an error:", errorBody);
      throw new Error(`API error! status: ${apiResponse.status}`);
    }

    // 4. Get the descriptive text from the response
    const descriptionText = await apiResponse.text(); // Your endpoint returns a string
    
    console.log('[llm] Image description successful.');
    return descriptionText;

  } catch (error) {
    console.error('Error during image description:', error);
    return null; // Return null on failure
  }
}

export function describeAndAttachLlmText(recordId: string, imageUrl: string, userProvidedDescription?: string) {
  (async () => {
    try {
      const text = await describeImageWithLlm(imageUrl);
      await setRecordLlmText(recordId, text);
      console.log('[llm] image description stored for', recordId);
      // After description, also generate follow-up questions.
      // For images, include both the user's description and the LLM description as context.
      const contextParts: string[] = [];
      if (userProvidedDescription && userProvidedDescription.trim().length > 0) contextParts.push(userProvidedDescription.trim());
      if (text && text.trim().length > 0) contextParts.push(text.trim());
      const context = contextParts.join('\n\n');
      if (context.length > 0) {
        const followUps = await generateFollowUpsForText(context);
        await setRecordFollowUps(recordId, followUps);
        console.log('[llm] follow-ups stored for', recordId);
      }
    } catch (e) {
      console.warn('[llm] image description failed', e);
    }
  })();
}

// --- Follow-up utilities: subscribe and update responses ---
export function subscribeToFollowUps(recordId: string, onUpdate: (followUps: FollowUpQuestion[] | null) => void): () => void {
  const ref = doc(db, 'records', recordId);
  const unsub = onSnapshot(ref, (snap) => {
    const data = snap.data() as any;
    const followUps: FollowUpQuestion[] | null = (data?.followUps as FollowUpQuestion[] | undefined) ?? null;
    onUpdate(followUps);
  });
  return unsub;
}

export async function setFollowUpResponse(recordId: string, index: number, userResponse: string): Promise<void> {
  const ref = doc(db, 'records', recordId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as any;
  const current: FollowUpQuestion[] = Array.isArray(data.followUps) ? [...data.followUps] : [];
  if (!current[index]) return;
  current[index] = { ...current[index], userResponse };
  await updateDoc(ref, replaceUndefinedWithNullShallow({ followUps: current }));
}

// --- Follow-up questions for text (placeholder) ---
export async function generateFollowUpsForText(userText: string): Promise<string[] | null> {
  console.log('[llm] Generating follow-ups for text length', userText?.length ?? 0);
  
  const apiEndpoint = 'https://backend-apis-1039832299695.us-central1.run.app/followup';

  try {
    // Make the POST request
    const response = await fetch(apiEndpoint, {
      method: 'POST',
      headers: {
        // Set the Content-Type to plain text
        'Content-Type': 'text/plain',
      },
      // Send the userText string directly as the body
      body: userText,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Server responded with an error:", errorBody);
      throw new Error(`API error! status: ${response.status}`);
    }
    
    // Parse the JSON response which should be a list of strings
    const followupQuestions: string[] = await response.json();
    
    console.log('[llm] Follow-up questions generated successfully.');
    return followupQuestions;

  } catch (error) {
    console.error('Error generating follow-up questions:', error);
    return null; // Return null on failure
  }
}

export async function setRecordFollowUps(recordId: string, followUps: FollowUpQuestion[] | null): Promise<void> {
  const ref = doc(db, 'records', recordId);
  await updateDoc(ref, replaceUndefinedWithNullShallow({ followUps }));
}

export function generateAndAttachFollowUpsForText(recordId: string, userText: string) {
  (async () => {
    try {
      const followUps = await generateFollowUpsForText(userText);
      await setRecordFollowUps(recordId, followUps);
      console.log('[llm] follow-ups stored for', recordId);
    } catch (e) {
      console.warn('[llm] follow-ups generation failed', e);
    }
  })();
}

export async function fetchRecordsGroupedByDay(patientUid?: string): Promise<Record<string, AnyRecord[]>> {
  const uid = patientUid ?? auth.currentUser?.uid;
  if (!uid) throw new Error('Not authenticated');

  // Attempt indexed query (patientUid == uid, ordered by createdAt asc)
  // If the index is missing, fall back to fetching without orderBy and sort in-memory.
  let snap: any;
  try {
    const q = query(
      collection(db, 'records'),
      where('patientUid', '==', uid),
      orderBy('createdAt', 'asc')
    );
    snap = await getDocs(q);
  } catch (e: any) {
    if (e?.code === 'failed-precondition') {
      console.warn('[records] Missing composite index for (patientUid, createdAt). Falling back to client-side sort.');
      const q2 = query(collection(db, 'records'), where('patientUid', '==', uid));
      snap = await getDocs(q2);
    } else {
      throw e;
    }
  }

  // Read all docs, normalize createdAt, then group by day (sorted ascending by createdAt)
  const all: AnyRecord[] = [];
  snap.forEach((doc: any) => {
    const data: any = doc.data();
    const createdAt: number = typeof data.createdAt === 'number'
      ? data.createdAt
      : (typeof data.createdAt?.toMillis === 'function' ? data.createdAt.toMillis() : Date.now());
    all.push({ ...(data as AnyRecord), id: doc.id, createdAt } as AnyRecord);
  });

  all.sort((a, b) => (a.createdAt as number) - (b.createdAt as number));

  const byDay: Record<string, AnyRecord[]> = {};
  for (const record of all) {
    const dayKey = new Date(record.createdAt as number).toISOString().slice(0, 10);
    if (!byDay[dayKey]) byDay[dayKey] = [];
    byDay[dayKey].push(record);
  }

  return byDay;
}


// Return all records for a specific patient as plain JSON-safe objects
export async function fetchRecordsForPatient(patientUid: string, order: 'asc' | 'desc' = 'asc'): Promise<AnyRecord[]> {
  if (!patientUid) throw new Error('patientUid is required');

  let snap: any;
  try {
    const q = query(
      collection(db, 'records'),
      where('patientUid', '==', patientUid),
      orderBy('createdAt', order)
    );
    snap = await getDocs(q);
  } catch (e: any) {
    // Fallback when composite index is missing – read then sort locally
    if (e?.code === 'failed-precondition') {
      const q2 = query(collection(db, 'records'), where('patientUid', '==', patientUid));
      snap = await getDocs(q2);
    } else {
      throw e;
    }
  }

  const out: AnyRecord[] = [];
  snap.forEach((d: any) => {
    const raw: any = d.data();
    const createdAt: number = typeof raw.createdAt === 'number'
      ? raw.createdAt
      : (typeof raw.createdAt?.toMillis === 'function' ? raw.createdAt.toMillis() : Date.now());

    const rec: AnyRecord = { ...(raw as AnyRecord), id: d.id, createdAt } as AnyRecord;
    // Ensure JSON-safe (remove any Firestore Timestamp/FieldValue artifacts)
    const jsonSafe: AnyRecord = JSON.parse(JSON.stringify(rec));
    out.push(jsonSafe);
  });

  // If we couldn't order via index, ensure consistent ordering client-side
  out.sort((a, b) => (a.createdAt as number) - (b.createdAt as number));
  if (order === 'desc') out.reverse();
  // Print JSON of results
  try {
    console.log('[records] fetchRecordsForPatient', patientUid, 'count=', out.length, '\n', JSON.stringify(out, null, 2));
  } catch {}
  return out;
}


/**
 * Given a patient's flat record list (from fetchRecordsForPatient) and the patient id,
 * call a backend analysis API and return a dictionary of results.
 *
 * NOTE: Skeleton only — implement the API call and shape the return as needed.
 */
export async function analyzePatientRecords(
  records: AnyRecord[],
  patientUid: string
): Promise<Record<string, any> | null> {
  try {
    // TODO: Implement API call here, e.g.:
    // const res = await fetch('https://your-api/analysis', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ patientUid, records }),
    // });
    // if (!res.ok) throw new Error('Analysis API failed');
    // const data = await res.json();
    // return data as Record<string, any>;
    return null;
  } catch (e) {
    console.warn('[records] analyzePatientRecords error', e);
    return null;
  }
}


