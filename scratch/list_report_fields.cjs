
const fs = require('fs');
const filePath = 'C:/Users/Emmanuel/.gemini/antigravity/brain/48f70081-1c4d-40a2-b0e0-052882368826/.system_generated/steps/6918/output.txt';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const results = data.documents.map(doc => ({
  id: doc.name.split('/').pop(),
  profName: doc.fields.profesionalNombre?.stringValue || null,
  createdByName: doc.fields.createdByName?.stringValue || null,
  createdBy: doc.fields.createdBy?.stringValue || null
}));

console.log(JSON.stringify(results, null, 2));
