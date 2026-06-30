
import { db } from '../src/services/firebase.js';
import { collection, getDocs, updateDoc, doc, query, where } from 'firebase/firestore';

const USER_MAPPING = {
  "0aEhH5wfV2heLgJiQUez2UbFb1j2": "DR. JASIN JUAN PABLO",
  "1N31YVXxu3XTUkilmsMHfbFIsb12": "LIC. BERESIARTE MARIA FERNANDA",
  "2lwRsrGFwghGXcIQCBftlcj7u2f2": "DRA. VALERIANI CARINA",
  "57HChK98wYe3ywVUwjwHOUJqbA23": "LIC. MARTINEZ CASTRO MARCELO",
  "7Eh7yeQsCJPQ1kUzbftfIrFhnjF3": "PROF. DR. CURET CARLOS",
  "8HBTJ6W6GBXOEVAQK5nOSlREpyi2": "DRA. CARRANZA MARIA SOL",
  "9I8SZ6dbJKeiEl7mTrr7fc2D4zn1": "DR. CORBALL ALBERTO GUSTAVO",
  "BbdJU8JDgtVuaLOTTpBLQDdyven1": "LIC. NAYA ARAGON CARLA",
  "HyAEtrP1kTWHGqxbejorkPo5eUG3": "DRA. ZALAZAR SERVINO MANUELA BELEN",
  "TCUWzbdafbW6G55GPbBdLFsRiSv2": "DR. PAREDES ARIEL",
  "VGGnoamqcZPsxDWBL0SUhq4QV1v1": "DRA. BAFFICO MONICA LUCRECIA",
  "WfY2UU4DshQJ5Lfx9Zb8AmEwTbt2": "DR. NAVARRO JORRAT JOSE L.",
  "WqTDqlD9vLZZSMkalFJSl5K13C52": "DR. BRUERA ESTEBAN OSVALDO",
  "nX72aRo0bJX3zOGZpzBHWxGhwmp1": "Emmanuel Gomez",
  "mkIrRUU5fwZmCmzucZm3tDaP4R02": "DRA. VENIER MELISA"
};

async function cleanupReports() {
  console.log("Starting cleanup...");
  const reportsRef = collection(db, "reports");
  const snap = await getDocs(reportsRef);
  
  let updatedCount = 0;
  
  for (const reportDoc of snap.docs) {
    const data = reportDoc.data();
    let needsUpdate = false;
    const updateData = {};
    
    // Check profesionalNombre
    const profId = data.profesionalId;
    if (profId && USER_MAPPING[profId]) {
      if (!data.profesionalNombre || data.profesionalNombre === "Desconocido") {
        updateData.profesionalNombre = USER_MAPPING[profId];
        needsUpdate = true;
      }
    }
    
    // Check createdByName
    const authorId = data.createdBy;
    if (authorId && USER_MAPPING[authorId]) {
      if (!data.createdByName || data.createdByName === "Desconocido") {
        updateData.createdByName = USER_MAPPING[authorId];
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      console.log(`Updating report ${reportDoc.id}...`);
      await updateDoc(doc(db, "reports", reportDoc.id), updateData);
      updatedCount++;
    }
  }
  
  console.log(`Cleanup finished. Updated ${updatedCount} reports.`);
}

cleanupReports();
