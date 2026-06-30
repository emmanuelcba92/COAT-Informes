
import { db } from '../src/services/firebase.js';
import { collection, getDocs } from 'firebase/firestore';

async function findUnknown() {
  const snap = await getDocs(collection(db, "reports"));
  const unknowns = new Set();
  
  snap.docs.forEach(doc => {
    const data = doc.data();
    if (!data.createdByName && data.createdBy) {
      unknowns.add(data.createdBy);
    }
  });
  
  console.log("UIDs with missing names:");
  unknowns.forEach(uid => console.log(uid));
}

findUnknown();
