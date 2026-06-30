import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const snap = await getDoc(doc(db, 'config', 'settings'));
  if (snap.exists()) {
    const config = snap.data();
    fs.writeFileSync("scratch/raw_token.txt", "TOKEN: " + config.token);
    console.log("Token written to scratch/raw_token.txt");
    console.log("Token length:", config.token ? config.token.length : 0);
  } else {
    console.log("No config document found!");
  }
  process.exit(0);
}

run().catch(console.error);
