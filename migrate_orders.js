import { db } from './src/services/firebase.js';
import { doc, setDoc } from 'firebase/firestore';

const ORDER_TYPES = [
  { id: 'coat', label: 'Pedido COAT', icon: 'Clipboard' },
  { id: 'preop', label: 'Pre-quirúrgico', icon: 'Stethoscope' },
  { id: 'rx', label: 'Rayos X (RX)', icon: 'Activity' },
  { id: 'ct', label: 'Tomografías (TC)', icon: 'Activity' },
  { id: 'rmn', label: 'Resonancias (RMN)', icon: 'Search' }
];

const practicesByType = {
  coat: [
    { n: "Audiometría Tonal", c: "31-01-02" },
    { n: "Audiometría en campo libre", c: "" },
    { n: "Audiometría Infantil", c: "" },
    { n: "Logoaudiometría", c: "31-01-03" },
    { n: "Pruebas supraliminares c/u", c: "31-01-04" },
    { n: "Impedanciometría", c: "31-01-09" },
    { n: "Potencial Evocado Auditivo", c: "29-01-11" },
    { n: "Otoemisiones Acústicas", c: "29-01-13" },
    { n: "Selección Integral de Audífonos", c: "31-02-01" },
    { n: "Selección de otoamplífono computada", c: "31-01-77" },
    { n: "Logoaudiometría con audífonos", c: "" },
    { n: "Calibración de audífonos", c: "" },
    { n: "Ganancia funcional de audífonos", c: "" },
    { n: "Rinodebitomanometría", c: "31-01-10" },
    { n: "Rinofaringolaringofibroscopia", c: "31-01-24" },
    { n: "Estroboscopia", c: "" },
    { n: "Reeducación fonoaudiológica", c: "25-01-04" },
    { n: "Videonistagmografía", c: "" },
    { n: "Estudio de laberinto", c: "31-01-01" },
    { n: "Drenaje de conducto auditivo externo", c: "03-01-09" },
    { n: "Drenaje de pabellón auricular", c: "03-01-05" },
    { n: "Drenaje de septum nasal", c: "03-04-06" },
    { n: "Extracción de cuerpo extraño", c: "31-01-11" },
    { n: "Otomicroscopia", c: "31-01-22" }
  ],
  preop: [
    { n: "Laboratorio (Citológico completo, Glucemia, Uremia, Creatinina, Recuento de plaquetas, APP, KPTT)", c: "" },
    { n: "Riesgo Quirúrgico / Electrocardiograma", c: "" },
    { n: "RX Tórax (Frente)", c: "" }
  ],
  rx: [
    { n: "RX Senos Paranasales (Caldwell y Waters)", c: "" },
    { n: "RX Perfil de Cavum", c: "" },
    { n: "RX de Tórax (Frente)", c: "" },
    { n: "RX de Macizo Facial", c: "" },
    { n: "RX de Huesos Propios de Nariz", c: "" }
  ],
  ct: [
    { n: "TC de Oídos (Cortes Coronales y Axiales)", c: "" },
    { n: "TC de Macizo Craneofacial", c: "" },
    { n: "TC de Senos Paranasales", c: "" },
    { n: "TC de Cuello", c: "" },
    { n: "TC de Tórax", c: "" }
  ],
  rmn: [
    { n: "RM de Cerebro", c: "" },
    { n: "RM de Conductos Auditivos Internos (CAI)", c: "" },
    { n: "RM de Macizo Facial", c: "" },
    { n: "RM de Senos Paranasales", c: "" },
    { n: "RM de Articulación Temporomandibular (ATM)", c: "" },
    { n: "RM de Cuello", c: "" },
    { n: "RM de Base de Cráneo", c: "" }
  ]
};

async function migrate() {
  try {
    await setDoc(doc(db, 'config', 'order_settings'), {
      categories: ORDER_TYPES,
      practicesByType: practicesByType
    });
    console.log("Migration successful!");
  } catch (err) {
    console.error("Migration failed:", err);
  }
}

migrate();
