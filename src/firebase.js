import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyC9kRfH-TOFv74Y0rd-HZnsgOQW1JMLLDg",
  authDomain: "benga-drinks.firebaseapp.com",
  projectId: "benga-drinks",
  storageBucket: "benga-drinks.firebasestorage.app",
  messagingSenderId: "128426396058",
  appId: "1:128426396058:web:58ea48cf409310ed6b9223"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);