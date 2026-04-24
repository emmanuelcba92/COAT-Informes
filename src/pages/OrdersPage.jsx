import React, { useState, useEffect } from 'react';
import { 
  FilePlus, 
  Search, 
  Printer, 
  User, 
  Clipboard, 
  CheckSquare, 
  Square,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  Hash,
  Stethoscope,
  ChevronRight,
  Loader2,
  Eye,
  Minus,
  Check,
  Mail,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import jsPDF from 'jspdf';

const defaultRPPractices = [
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
];

const OrdersPage = ({ userProfile: propProfile }) => {
  const [patientData, setPatientData] = useState({
    name: '',
    dni: '',
    insurance: '',
    affiliateNumber: '',
    diagnosis: '',
    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
    patientEmail: '',
    observations: ''
  });

  // Patient autocomplete logic
  useEffect(() => {
    const searchPatient = async () => {
      const cleanDni = patientData.dni.trim();
      if (cleanDni.length >= 7 && cleanDni.length <= 9) {
        try {
          const docRef = doc(db, 'patients', cleanDni);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPatientData(prev => ({
              ...prev,
              name: data.name || prev.name,
              insurance: data.insurance || prev.insurance,
              affiliateNumber: data.affiliateNumber || prev.affiliateNumber
              // Email is intentionally NOT autocompleted as requested
            }));
            showToast('Datos de paciente cargados automáticamente');
          }
        } catch (err) {
          console.error("Error searching patient:", err);
        }
      }
    };

    const timer = setTimeout(searchPatient, 600);
    return () => clearTimeout(timer);
  }, [patientData.dni]);

  const savePatientToHistory = async () => {
    const cleanDni = patientData.dni.trim();
    if (!cleanDni || cleanDni.length < 7) return;
    
    try {
      const patientRef = doc(db, 'patients', cleanDni);
      await setDoc(patientRef, {
        name: patientData.name.trim(),
        dni: cleanDni,
        insurance: patientData.insurance.trim(),
        affiliateNumber: patientData.affiliateNumber.trim(),
        email: patientData.patientEmail.trim(),
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.error("Error saving patient to history:", err);
    }
  };
  
  const [selectedPractices, setSelectedPractices] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [indications, setIndications] = useState({});
  const [customPractices, setCustomPractices] = useState([]);
  const [newCustomPractice, setNewCustomPractice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Helper validation
  const isEmailValid = (email) => {
    if (!email || !email.trim()) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const isFormValid = () => {
    const { name, insurance, affiliateNumber, diagnosis, patientEmail } = patientData;
    const isParticular = (insurance || '').toLowerCase().trim() === 'particular';
    
    const basicFields = name.trim() && insurance.trim() && diagnosis.trim();
    const affiliateOk = isParticular || (affiliateNumber.trim() && /^\d+$/.test(affiliateNumber));
    const emailOk = isEmailValid(patientEmail);
    const practicesOk = selectedPractices.length > 0;

    return basicFields && affiliateOk && emailOk && practicesOk;
  };
  
  const [profile, setProfile] = useState(propProfile || null);

  useEffect(() => {
    if (!profile && auth.currentUser) {
      const fetchFullProfile = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (docSnap.exists()) {
            setProfile(docSnap.data());
          }
        } catch (err) {
          console.error("Error fetching full profile:", err);
        }
      };
      fetchFullProfile();
    }
  }, [auth.currentUser, profile]);

  const [isSending, setIsSending] = useState(false);
  const [config, setConfig] = useState({ adminEmail: '', appsScriptUrl: '', token: '' });
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const [orderSettings, setOrderSettings] = useState({ categories: [], practicesByType: {} });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const configRef = doc(db, 'config', 'settings');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          setConfig(configSnap.data());
        }

        const ordersRef = doc(db, 'config', 'order_settings');
        const ordersSnap = await getDoc(ordersRef);
        if (ordersSnap.exists()) {
          setOrderSettings(ordersSnap.data());
        }
      } catch (err) {
        console.error("Error fetching config:", err);
      }
    };
    fetchConfig();
  }, []);

  const filteredPractices = React.useMemo(() => {
    const userRole = profile?.role;
    const isAdmin = userRole === 'admin' || userRole === 'directora_medica';

    // If we have data in Firestore, use it
    if (orderSettings.categories.length > 0) {
      const allPractices = [];
      orderSettings.categories.forEach(cat => {
        const practices = orderSettings.practicesByType[cat.id] || [];
        practices.forEach(p => {
          const allowedRoles = p.allowedRoles || [];
          if (isAdmin || allowedRoles.length === 0 || allowedRoles.includes(userRole)) {
            allPractices.push({ ...p, category: cat.label });
          }
        });
      });
      return allPractices;
    }

    // Fallback to defaultRPPractices if Firestore is empty
    return defaultRPPractices;
  }, [orderSettings, profile]);

  const togglePractice = (name) => {
    setSelectedPractices(prev => {
      if (prev.includes(name)) return prev.filter(p => p !== name);
      setQuantities(q => ({ ...q, [name]: q[name] || 1 }));
      return [...prev, name];
    });
  };

  const updateQuantity = (name, delta) => {
    setQuantities(prev => {
      const current = prev[name] || 1;
      const newValue = Math.max(1, current + delta);
      return { ...prev, [name]: newValue };
    });
    if (!selectedPractices.includes(name)) {
      setSelectedPractices(prev => [...prev, name]);
    }
  };

  const handleAddCustom = () => {
    if (newCustomPractice.trim() && !customPractices.includes(newCustomPractice.trim())) {
      const name = newCustomPractice.trim();
      setCustomPractices([...customPractices, name]);
      setSelectedPractices(prev => [...prev, name]);
      setQuantities(q => ({ ...q, [name]: 1 }));
      setNewCustomPractice('');
    }
  };

  const generatePDF = async (mode = 'save') => {
    if (!isFormValid()) {
      showToast('Por favor, complete todos los campos obligatorios correctamente.', 'error');
      return;
    }
    await savePatientToHistory();
    setIsGenerating(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const centerX = pageWidth / 2;
      const coatBlue = [0, 102, 128];

      // Header: Logo & Title
      try {
        const logoData = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            resolve({ 
              data: canvas.toDataURL('image/png'), 
              ratio: img.width / img.height 
            });
          };
          img.onerror = () => reject(new Error("Logo load error"));
          img.src = '/coat_logo.png';
        });
        const logoWidth = 35;
        const logoHeight = logoWidth / logoData.ratio;
        doc.addImage(logoData.data, 'PNG', 15, 8, logoWidth, logoHeight);
      } catch (e) {
        console.error("Logo error:", e);
      }

      doc.setFontSize(10);
      doc.setTextColor(0, 121, 153);
      doc.text("CENTRO OTOAUDIOLÓGICO DE ALTA TECNOLOGÍA", centerX, 20, { align: 'center' });
      doc.setFontSize(8);
      doc.text("NARIZ - GARGANTA - OÍDO", centerX, 25, { align: 'center' });
      
      doc.setDrawColor(0, 121, 153);
      doc.setLineWidth(0.5);
      doc.line(15, 38, pageWidth - 15, 38);

      // Date below header line
      const dateStr = `Córdoba, ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(dateStr, pageWidth - 15, 43, { align: 'right' });

      // Patient Information (COMPACTED & CENTERED)
      doc.setFontSize(10);
      const patientName = (patientData.name || '').toUpperCase();
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 30, 30);
      doc.text(`PACIENTE: ${patientName}`, centerX, 48, { align: 'center' });

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(60, 60, 60);
      
      const infoLine = `OBRA SOCIAL: ${patientData.insurance || '-'} | NRO. AFILIADO: ${patientData.affiliateNumber || '-'}${patientData.diagnosis ? ` | DIAG: ${patientData.diagnosis}` : ''}`;
      doc.text(infoLine, centerX, 53, { align: 'center' });

      let currentY = 58;
      if (patientData.observations) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(100, 100, 100);
        const splitObs = doc.splitTextToSize(`Observaciones: ${patientData.observations}`, pageWidth - 30);
        doc.text(splitObs, centerX, currentY, { align: 'center' });
        currentY += (splitObs.length * 4) + 2;
      }

      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 121, 153);
      doc.text("Se solicita:", 20, currentY);

      // Practices List
      let y = currentY + 7;
      const rowHeight = 5.2; // Reduced line spacing
      
      filteredPractices.forEach((p) => {
        const isSelected = selectedPractices.includes(p.n);
        doc.setDrawColor(200);
        doc.rect(25, y - 3, 3.5, 3.5);
        if (isSelected) {
          doc.setDrawColor(...coatBlue);
          doc.line(25.5, y - 1.5, 26.5, y - 0.5);
          doc.line(26.5, y - 0.5, 28, y - 2.5);
        }
        
        doc.setFontSize(9); // Consistent size
        doc.setTextColor(isSelected ? 0 : 180);
        doc.setFont('helvetica', isSelected ? 'bold' : 'normal');
        doc.text(p.n, 33, y);
        
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        doc.setTextColor(200);
        if (p.c) doc.text(p.c, 98, y);

        const qty = quantities[p.n] || 1;
        if (isSelected && qty > 1) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(...coatBlue);
          doc.text(`x${qty}`, 118, y);
        }
        doc.setDrawColor(230);
        doc.setLineWidth(0.1);
        doc.line(128, y + 0.5, pageWidth - 15, y + 0.5);

        if (isSelected && indications[p.n]) {
          doc.setFontSize(8);
          doc.setTextColor(50, 50, 50);
          doc.setFont('helvetica', 'italic');
          doc.text(indications[p.n], 130, y);
        }
        y += rowHeight;
      });

      // Custom Practices
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      customPractices.forEach((p) => {
        if (!selectedPractices.includes(p)) return;
        const qty = quantities[p] || 1;
        doc.setTextColor(...coatBlue);
        doc.text(`• ${p}${qty > 1 ? ` (x${qty})` : ''}`, 25, y);
        y += 5.2;
      });

      // Signature Block (ENLARGED & REFINED)
      const signatureY = pageHeight - 42;
      const signatureX = pageWidth - 80;
      const prof = profile || propProfile || {};
      
      if (prof.signatureBase64) {
        try {
          const sigData = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              canvas.width = img.width; canvas.height = img.height;
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = () => reject();
            img.src = prof.signatureBase64;
          });
          doc.addImage(sigData, 'PNG', signatureX + 5, signatureY - 28, 55, 22);
        } catch (e) {}
      }

      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text((prof.nombre || prof.n || '').toUpperCase(), signatureX + 32, signatureY, { align: 'center' });
      doc.setFontSize(8);
      doc.text(prof.especialidad || prof.esp || '', signatureX + 32, signatureY + 4, { align: 'center' });
      if (prof.mp || prof.m) {
        doc.text(`MP: ${prof.mp || prof.m}`, signatureX + 32, signatureY + 8, { align: 'center' });
      }

      // Institutional Footer
      doc.setDrawColor(...coatBlue);
      doc.setLineWidth(0.3);
      doc.line(15, pageHeight - 20, pageWidth - 15, pageHeight - 20);
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.text("Urquiza 401 - X5000KPI Córdoba - Tel. (0351) 423-0530 - WhatsApp +54 3543 579794 - www.coat.com.ar", centerX, pageHeight - 12, { align: 'center' });

      if (mode === 'save') {
        doc.save(`Pedido_${patientData.name || 'Paciente'}.pdf`);
      } else if (mode === 'print') {
        window.open(doc.output('bloburl'), '_blank');
      } else {
        return doc;
      }
    } catch (err) {
      console.error(err);
      if (mode !== 'instance') alert('Error al generar PDF');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!isFormValid()) {
      showToast('Revise los datos del paciente y las prácticas seleccionadas.', 'error');
      return;
    }
    if (!config.appsScriptUrl) {
      showToast('Error: No se ha configurado la URL de envío de correos en el panel de Administración.', 'error');
      alert('Error: La URL de Apps Script no está configurada. Vaya a Administración -> Configuración para establecerla.');
      return;
    }
    if (!patientData.patientEmail) {
      showToast('Por favor, ingrese el email del paciente.', 'error');
      return;
    }
    await savePatientToHistory();
    setIsSending(true);
    try {
      const pdfDoc = await generatePDF('instance');
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
      await fetch(config.appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          token: config.token,
          pdfBase64,
          recipientEmails: [patientData.patientEmail],
          subject: `COAT - Pedido Médico Digital: ${patientData.name}`,
          message: `<p>Estimado/a <strong>${patientData.name}</strong>, le adjuntamos su pedido médico.</p>`,
          fileName: `Pedido_${patientData.name.replace(/\s/g, '_')}.pdf`
        })
      });
      showToast('¡Pedido enviado con éxito!');
    } catch (err) {
      showToast('Error al enviar email.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Nuevo Pedido Online</h1>
          <p className="text-slate-500 dark:text-slate-400">Complete los datos y seleccione los estudios para el RP.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button 
            onClick={handleSendEmail} 
            disabled={isSending || isGenerating || !isFormValid()} 
            className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold"
          >
            {isSending ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />} <span>Enviar por Email</span>
          </button>
          <button 
            onClick={() => generatePDF('print')} 
            disabled={isGenerating || !isFormValid()} 
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-main text-[var(--text-main)] rounded-xl hover:bg-main hover:text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold"
          >
            <Eye size={18} /> <span>Vista Previa</span>
          </button>
          <button onClick={() => generatePDF('save')} disabled={isGenerating || !isFormValid()} className="btn-primary flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed">
            {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <Printer size={18} />} <span>Descargar PDF</span>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {toast.show && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl ${toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'} text-white`}>
            <span className="font-bold">{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[var(--bg-card)] border border-main rounded-3xl p-8 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-[var(--text-main)]">
              <User className="text-blue-500" size={20} /> Datos del Paciente
            </h3>
            <div className="space-y-4">
              {[
                { label: 'DNI / Pasaporte', icon: Hash, key: 'dni', ph: 'Solo números', required: true },
                { label: 'Nombre Completo', icon: User, key: 'name', ph: 'Ej: Juan Pérez', required: true },
                { label: 'Obra Social', icon: CreditCard, key: 'insurance', ph: 'Ej: OSDE', required: true },
                { label: 'Nro. Afiliado', icon: Hash, key: 'affiliateNumber', ph: 'Solo números', required: true },
                { label: 'Diagnóstico', icon: Stethoscope, key: 'diagnosis', ph: 'Ej: Hipoacusia', required: true },
                { label: 'Email del Paciente', icon: Mail, key: 'patientEmail', ph: 'Opcional', required: false }
              ].map(f => {
                const val = patientData[f.key];
                const isParticular = patientData.insurance.toLowerCase().trim() === 'particular';
                const isEmpty = f.required && !val.trim() && !(f.key === 'affiliateNumber' && isParticular);
                const isInvalidNum = f.key === 'affiliateNumber' && val.trim() && !/^\d+$/.test(val);
                const isInvalidEmail = f.key === 'patientEmail' && val.trim() && !isEmailValid(val);
                const hasError = isEmpty || isInvalidNum || isInvalidEmail;

                return (
                  <div key={f.key} className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-slate-400 ml-1">
                      {f.label} {f.required && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <f.icon className={`absolute left-3 top-3.5 ${hasError ? 'text-red-400' : 'text-slate-400'}`} size={16} />
                      <input 
                        type="text" 
                        className={`w-full pl-10 pr-4 py-3 bg-[var(--bg-secondary)] border ${hasError ? 'border-red-400 ring-1 ring-red-100' : 'border-main'} rounded-2xl text-sm focus:border-blue-500 outline-none transition-all text-[var(--text-main)]`} 
                        placeholder={f.ph} 
                        value={val} 
                        onChange={e => setPatientData({...patientData, [f.key]: e.target.value})} 
                      />
                    </div>
                  </div>
                );
              })}
              
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Observaciones Generales</label>
                <div className="relative">
                  <Clipboard className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <textarea 
                    className="w-full pl-10 pr-4 py-3 bg-[var(--bg-secondary)] border border-main rounded-2xl text-sm focus:border-blue-500 outline-none transition-all text-[var(--text-main)] min-h-[100px] resize-none" 
                    placeholder="" 
                    value={patientData.observations} 
                    onChange={e => setPatientData({...patientData, observations: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="bg-blue-600 p-6 rounded-3xl text-white shadow-lg shadow-blue-500/20">
             <div className="flex items-center gap-3 mb-2">
                <Calendar size={20} /> <span className="font-bold">Fecha del Pedido</span>
             </div>
             <input type="date" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-white outline-none focus:bg-white/20 transition-all" value={patientData.date} onChange={e => setPatientData({...patientData, date: e.target.value})} />
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--bg-card)] border border-main rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-main bg-[var(--bg-secondary)]/50 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-main)]">
                <CheckSquare className="text-blue-500" size={20} /> Selección de Estudios
              </h3>
              <div className="text-[10px] font-black bg-blue-100 text-blue-600 px-3 py-1 rounded-full">{selectedPractices.length} SELECCIONADAS</div>
            </div>
            <div className="p-4 bg-[var(--bg-secondary)]/30 border-b border-main flex items-center justify-between">
               <div className="relative flex-1 max-w-md">
                 <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
                 <input type="text" placeholder="Buscar estudio..." className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] border border-main rounded-xl text-sm focus:border-blue-500 outline-none transition-all text-[var(--text-main)] placeholder:text-slate-400" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
               </div>
            </div>
            <div className="p-6 space-y-1 max-h-[600px] overflow-y-auto custom-scrollbar">
              {filteredPractices.filter(p => p.n.toLowerCase().includes(searchQuery.toLowerCase())).map((p, idx) => (
                <div key={idx} className={`flex items-center justify-between p-2 rounded-xl transition-all border ${selectedPractices.includes(p.n) ? 'bg-blue-600/5 border-blue-600/20' : 'bg-transparent border-transparent hover:bg-[var(--bg-secondary)]'}`}>
                  <div onClick={() => togglePractice(p.n)} className="flex items-center gap-3 flex-1 cursor-pointer py-1">
                    <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${selectedPractices.includes(p.n) ? 'bg-blue-600 border-blue-600' : 'bg-[var(--bg-card)] border-main'}`}>
                      {selectedPractices.includes(p.n) && <Check className="text-white" size={14} />}
                    </div>
                    <div className="flex flex-col flex-1">
                      <span className={`text-sm font-semibold transition-colors ${selectedPractices.includes(p.n) ? 'text-blue-600' : 'text-[var(--text-main)]'}`}>{p.n}</span>
                      {p.c && <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">{p.c}</span>}
                      {selectedPractices.includes(p.n) && (
                        <input type="text" placeholder="Indicación particular..." className="mt-1 text-[11px] bg-transparent border-b border-blue-200 outline-none text-blue-600 placeholder:text-slate-300" value={indications[p.n] || ''} onChange={e => setIndications({...indications, [p.n]: e.target.value})} onClick={e => e.stopPropagation()} />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-[var(--bg-card)] rounded-xl border border-main p-1 shadow-sm ml-4">
                    <button onClick={() => updateQuantity(p.n, -1)} className="p-1 hover:bg-[var(--bg-secondary)] rounded text-slate-500 transition-colors"><Minus size={14} /></button>
                    <span className="w-6 text-center text-xs font-bold text-blue-600">{quantities[p.n] || 1}</span>
                    <button onClick={() => updateQuantity(p.n, 1)} className="p-1 hover:bg-[var(--bg-secondary)] rounded text-slate-500 transition-colors"><Plus size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-8 bg-[var(--bg-secondary)]/50 border-t border-main">
              <h4 className="text-[10px] font-black uppercase text-slate-400 ml-1 mb-4 block">Otros Estudios Personalizados</h4>
              <div className="flex gap-3 mb-6">
                <input type="text" value={newCustomPractice} onChange={e => setNewCustomPractice(e.target.value)} className="w-full px-4 py-3 bg-[var(--bg-card)] border border-main rounded-2xl text-sm outline-none focus:border-blue-500 transition-all text-[var(--text-main)]" placeholder="Estudio..." onKeyDown={e => e.key === 'Enter' && handleAddCustom()} />
                <button onClick={handleAddCustom} className="p-3 bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"><Plus size={24} /></button>
              </div>
              <div className="space-y-3">
                {customPractices.map(cp => (
                  <div key={cp} className="flex items-center justify-between p-4 bg-[var(--bg-card)] rounded-2xl border border-main shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500" /><span className="text-sm font-bold text-[var(--text-main)]">{cp}</span>
                      {quantities[cp] > 1 && <span className="text-xs font-black text-blue-600 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-lg">x{quantities[cp]}</span>}
                    </div>
                    <button onClick={() => setCustomPractices(prev => prev.filter(p => p !== cp))} className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all"><Trash2 size={18} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrdersPage;
