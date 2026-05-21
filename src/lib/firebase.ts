import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const firebaseConfig = {
  apiKey: 'AIzaSyACxBfinlpdu3f4M3JEFX_IRHGpCKSAZdg',
  authDomain: 'company-standard-w07pf.firebaseapp.com',
  projectId: 'company-standard-w07pf',
  storageBucket: 'company-standard-w07pf.firebasestorage.app',
  messagingSenderId: '265593599302',
  appId: '1:265593599302:web:8436419e9c97cf41132147',
  firestoreDatabaseId: 'ai-studio-0c6f329e-4fac-417a-acbc-2bb5810ffd30',
};

const app = initializeApp(firebaseConfig);

console.info(
  `[INVSG02] Firebase aktif: project=${firebaseConfig.projectId}, database=${firebaseConfig.firestoreDatabaseId}`
);

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);
