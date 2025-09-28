// ---------------------------------------------
// Record models for patient inputs (text/image/voice)
// ---------------------------------------------

export type RecordKind = 'text' | 'image' | 'voice';

/** A single LLM-generated follow-up question with an optional user response */
export type FollowUpQuestion = {
  /** The LLM-generated follow-up question */
  question: string;
  /** Optional user response to the follow-up question */
  userResponse?: string;
};

/** The structure of a Firestore Timestamp object after JSON serialization */
export type FirestoreTimestamp = {
  type: "firestore/timestamp/1.0";
  seconds: number;
  nanoseconds: number;
};

export type BaseRecord = {
  /** UID of the patient this record belongs to */
  patientUid: string;
  /** Discriminant for the record union */
  kind: RecordKind;
  /** Unix epoch in milliseconds */
  createdAt: number;
  /** Optional Firestore document id if you choose to store it */
  id?: string;
  /** LLM-generated follow-up questions and their optional user responses */
  followUps?: FollowUpQuestion[] | null;
  /** Optional server timestamp from Firestore for data consistency */
  serverTime?: FirestoreTimestamp;
};

export type TextRecord = BaseRecord & {
  kind: 'text';
  /** User-entered text */
  userText: string;
};

export type ImageRecord = BaseRecord & {
  kind: 'image';
  /** Public download URL for the stored image (Firebase Storage) */
  imageUrl: string;
  /** Required user-entered text that accompanies the image */
  userText: string;
  /** LLM-derived caption/summary (optional) */
  llmText?: string;
};

export type VoiceRecord = BaseRecord & {
  kind: 'voice';
  /** Public download URL for the stored audio (Firebase Storage) */
  audioUrl: string;
  /** Optional audio duration in seconds */
  audioDurationSec?: number;
  /** LLM transcription/translation (optional) */
  llmText?: string;
};

export type AnyRecord = TextRecord | ImageRecord | VoiceRecord;

// ---- Factory helpers ----

export function createTextRecord(init: {
  patientUid: string;
  userText: string;
  createdAt?: number;
  id?: string;
  followUps?: FollowUpQuestion[] | null;
}): TextRecord {
  return {
    patientUid: init.patientUid,
    kind: 'text',
    userText: init.userText.trim(),
    createdAt: init.createdAt ?? Date.now(),
    id: init.id,
    followUps: init.followUps ?? [],
  };
}

export function createImageRecord(init: {
  patientUid: string;
  imageUrl: string;
  userText: string;
  createdAt?: number;
  id?: string;
  followUps?: FollowUpQuestion[] | null;
}): ImageRecord {
  return {
    patientUid: init.patientUid,
    kind: 'image',
    imageUrl: init.imageUrl,
    userText: init.userText.trim(),
    createdAt: init.createdAt ?? Date.now(),
    id: init.id,
    followUps: init.followUps ?? [],
  };
}

export function createVoiceRecord(init: {
  patientUid: string;
  audioUrl: string;
  createdAt?: number;
  audioDurationSec?: number;
  id?: string;
  followUps?: FollowUpQuestion[] | null;
}): VoiceRecord {
  return {
    patientUid: init.patientUid,
    kind: 'voice',
    audioUrl: init.audioUrl,
    audioDurationSec: init.audioDurationSec,
    createdAt: init.createdAt ?? Date.now(),
    id: init.id,
    followUps: init.followUps ?? [],
  };
}

// Type guards
export const isTextRecord = (r: AnyRecord): r is TextRecord => r.kind === 'text';
export const isImageRecord = (r: AnyRecord): r is ImageRecord => r.kind === 'image';
export const isVoiceRecord = (r: AnyRecord): r is VoiceRecord => r.kind === 'voice';

