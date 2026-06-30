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
  if (!snap.exists()) {
    console.log("No config document found!");
    process.exit(1);
  }
  const config = snap.data();
  console.log("Config loaded. Attempting fetch to appsScriptUrl...");
  
  try {
    const response = await fetch(config.appsScriptUrl, {
      method: 'POST',
      body: JSON.stringify({
        token: config.token,
        action: 'getQuota'
      })
    });
    
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response text:", text);
  } catch (err) {
    console.error("Fetch failed:", err);
  }
  
  process.exit(0);
}

run().catch(console.error);
