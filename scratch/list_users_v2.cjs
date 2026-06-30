
const fs = require('fs');
const filePath = 'C:/Users/Emmanuel/.gemini/antigravity/brain/48f70081-1c4d-40a2-b0e0-052882368826/.system_generated/steps/6983/output.txt';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

const results = data.documents.map(doc => ({
  id: doc.name.split('/').pop(),
  nombre: doc.fields.nombre?.stringValue || doc.fields.u?.stringValue || null,
  mp: doc.fields.mp?.stringValue || doc.fields.m?.stringValue || null,
  role: doc.fields.role?.stringValue || null
}));

console.log(JSON.stringify(results, null, 2));
