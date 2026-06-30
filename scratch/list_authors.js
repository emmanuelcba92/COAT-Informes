
import { db } from './src/services/firebase.js';
import { collection, query, getDocs, limit, orderBy } from 'firebase/firestore';

async function listAuthors() {
  const q = query(collection(db, "reports"), orderBy("fechaCreatedAt", "desc"), limit(1000));
  const snap = await getDocs(q);
  
  const authors = {};
  
  snap.docs.forEach(doc => {
    const data = doc.data();
    const authorId = data.createdBy || data.profesionalId;
    const authorName = data.createdByName || data.profesionalNombre || "DESCONOCIDO";
    
    if (!authors[authorId]) {
      authors[authorId] = { name: authorName, count: 0 };
    }
    authors[authorId].count++;
  });
  
  console.log("Unique Authors found:");
  Object.entries(authors).forEach(([id, info]) => {
    console.log(`- ${info.name} (ID: ${id}) - Reports: ${info.count}`);
  });
}

listAuthors();
