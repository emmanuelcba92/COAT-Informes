import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc } from "firebase/firestore";
import dotenv from "dotenv";

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
    console.log("driveFolderId length:", config.driveFolderId ? config.driveFolderId.length : 0);
    console.log("ordersFolderId length:", config.ordersFolderId ? config.ordersFolderId.length : 0);
    console.log("driveFolderId starts with:", config.driveFolderId ? config.driveFolderId.substring(0, 5) : "none");
    console.log("driveFolderId ends with:", config.driveFolderId ? config.driveFolderId.substring(config.driveFolderId.length - 5) : "none");
  } else {
    console.log("No config document found!");
  }
  process.exit(0);
}

run().catch(console.error);
