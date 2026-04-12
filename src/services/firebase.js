import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  projectId: "informes-coat-a6688",
  appId: "1:466646692549:web:a2207a55e7230835aef6ac",
  storageBucket: "informes-coat-a6688.firebasestorage.app",
  apiKey: "AIzaSyAMC5Fjaop2AVwck9c3aiYFuZj_IfSgnLc",
  authDomain: "informes-coat-a6688.firebaseapp.com",
  messagingSenderId: "466646692549",
  projectNumber: "466646692549"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
