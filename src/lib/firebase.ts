import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAzNFMx0l3x-1qSB7zYEHJwasBnkPOfpg0",
  authDomain: "ms-mv-71de8.firebaseapp.com",
  projectId: "ms-mv-71de8",
  storageBucket: "ms-mv-71de8.firebasestorage.app",
  messagingSenderId: "11803494011",
  appId: "1:11803494011:web:313992c0215928cb3b44de",
  measurementId: "G-XKKEK82ZPD"
};

// Initialize Firebase only once
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error: any) {
  if (!/already exists/.test(error.message)) {
    console.error('Firebase initialization error', error.stack);
  }
}

// Export Firebase services
export const db = getFirestore(app);
export const auth = getAuth(app);