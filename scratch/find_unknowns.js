
import { db } from './src/services/firebase.js';
import { collection, query, getDocs, limit } from 'firebase/firestore';

async function findUnknowns() {
  const q = query(collection(db, "reports"), limit(1000));
  const snap = await getDocs(q);
  
  const unknowns = new Set();
  
  snap.docs.forEach(doc => {
    const data = doc.data();
    const authorId = data.createdBy || data.profesionalId;
    const authorName = data.createdByName || data.profesionalNombre;
    
    if (!authorName && authorId) {
      unknowns.add(authorId);
    }
  });
  
  console.log("Unknown UIDs found:", Array.from(unknowns));
}

findUnknowns();
