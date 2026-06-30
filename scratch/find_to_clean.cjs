
const fs = require('fs');
const path = require('path');

const filePath = 'C:/Users/Emmanuel/.gemini/antigravity/brain/48f70081-1c4d-40a2-b0e0-052882368826/.system_generated/steps/6748/output.txt';
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

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

const toUpdate = data.documents.filter(doc => {
  const fields = doc.fields;
  const profId = fields.profesionalId?.stringValue;
  const profName = fields.profesionalNombre?.stringValue;
  
  if (profId && USER_MAPPING[profId]) {
    if (!profName || profName === "Desconocido") {
      return true;
    }
  }
  
  const authorId = fields.createdBy?.stringValue;
  const authorName = fields.createdByName?.stringValue;
  if (authorId && USER_MAPPING[authorId]) {
    if (!authorName || authorName === "Desconocido") {
      return true;
    }
  }
  
  return false;
}).map(doc => ({
  name: doc.name,
  profId: doc.fields.profesionalId?.stringValue,
  authorId: doc.fields.createdBy?.stringValue
}));

console.log(JSON.stringify(toUpdate, null, 2));
