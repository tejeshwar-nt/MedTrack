import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAm-xU-ERLW_GYWVbT1NPgJPiHU5ssMKd0",
  authDomain: "medtrak-9d6c3.firebaseapp.com",
  projectId: "medtrak-9d6c3",
  storageBucket: "medtrak-9d6c3.firebasestorage.app",
  messagingSenderId: "1039832299695",
  appId: "1:1039832299695:web:9261ad97019a4bf30bfc5a",
  measurementId: "G-DZEK8P4CPL"
};

export const app = initializeApp(firebaseConfig);

// Firestore: prefer long polling to avoid restricted networks issues
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true
});
export const auth = getAuth(app);