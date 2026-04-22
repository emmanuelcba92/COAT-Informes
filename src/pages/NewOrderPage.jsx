import React, { useState, useEffect } from 'react';
import { 
  Printer, 
  User, 
  Clipboard, 
  CheckSquare, 
  Search,
  Plus,
  Trash2,
  Calendar,
  CreditCard,
  Hash,
  Stethoscope,
  Loader2,
  Eye,
  Minus,
  Mail,
  Activity,
  Heart,
  ClipboardList,
  Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../services/firebase';
import { doc, getDoc, setDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { generateOrderPDF } from '../utils/orderPdfGenerator';

const ICON_MAP = {
  Clipboard,
  Stethoscope,
  Activity,
  Search,
  Eye,
  Heart,
  ClipboardList
};

const NewOrderPage = ({ userProfile: propProfile }) => {
  const [orderTypes, setOrderTypes] = useState([]);
  const [practicesByType, setPracticesByType] = useState({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [selectedType, setSelectedType] = useState('coat');
  const [patientEmailRequired, setPatientEmailRequired] = useState(false);

  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

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

  const [selectedPractices, setSelectedPractices] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [indications, setIndications] = useState({});
  const [customPractices, setCustomPractices] = useState([]);
  const [newCustomPractice, setNewCustomPractice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [profile, setProfile] = useState(propProfile || null);
  const [config, setConfig] = useState({ adminEmail: '', appsScriptUrl: '', token: '' });

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  useEffect(() => {
    const searchPatient = async () => {
      const cleanDni = patientData.dni.trim();
      if (cleanDni.length >= 7 && cleanDni.length <= 9) {
        try {
          const docSnap = await getDoc(doc(db, 'patients', cleanDni));
          if (docSnap.exists()) {
            const data = docSnap.data();
            setPatientData(prev => ({
              ...prev,
              name: data.name || prev.name,
              insurance: data.insurance || prev.insurance,
              affiliateNumber: data.affiliateNumber || prev.affiliateNumber,
              patientEmail: data.email || data.patientEmail || prev.patientEmail
            }));
            showToast('Paciente encontrado en historial');
          }
        } catch (err) {}
      }
    };
    const timer = setTimeout(searchPatient, 600);
    return () => clearTimeout(timer);
  }, [patientData.dni]);

  const savePatientToHistory = async () => {
    const cleanDni = patientData.dni.trim();
    if (!cleanDni || cleanDni.length < 7) return;
    try {
      await setDoc(doc(db, 'patients', cleanDni), {
        name: patientData.name.trim(),
        dni: cleanDni,
        insurance: patientData.insurance.trim(),
        affiliateNumber: patientData.affiliateNumber.trim(),
        email: patientData.patientEmail.trim(),
        lastUpdated: new Date().toISOString()
      }, { merge: true });
    } catch (err) {}
  };

  const saveOrderToDB = async () => {
    try {
      await addDoc(collection(db, 'orders'), {
        ...patientData,
        practices: selectedPractices,
        quantities,
        indications,
        customPractices,
        profesionalId: auth.currentUser?.uid,
        profesionalName: profile?.nombre || profile?.n || auth.currentUser?.email,
        createdAt: serverTimestamp(),
        timestamp: new Date().toISOString()
      });
    } catch (err) {}
  };

  useEffect(() => {
    if (!profile && auth.currentUser) {
      getDoc(doc(db, 'users', auth.currentUser.uid)).then(snap => {
        if (snap.exists()) setProfile(snap.data());
      });
    }
  }, [auth.currentUser, profile]);

  useEffect(() => {
    getDoc(doc(db, 'config', 'settings')).then(snap => {
      if (snap.exists()) setConfig(snap.data());
    });
  }, []);

  useEffect(() => {
    const fetchOrderSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'order_settings'));
        if (snap.exists()) {
          const data = snap.data();
          setOrderTypes(data.categories || []);
          setPracticesByType(data.practicesByType || {});
          setPatientEmailRequired(data.patientEmailRequired || false);
          if (data.categories?.length > 0) {
            setSelectedType(data.categories[0].id);
          }
        }
      } catch (err) {
        console.error("Error fetching order settings:", err);
      } finally {
        setIsLoadingSettings(false);
      }
    };
    fetchOrderSettings();
  }, []);

  const isEmailValid = (email) => !email || !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isFormValid = () => {
    const { name, insurance, diagnosis, patientEmail, dni, affiliateNumber } = patientData;
    const basicValid = name.trim() && insurance.trim() && diagnosis.trim() && dni.trim() && affiliateNumber.trim() && selectedPractices.length > 0;
    const emailProvided = patientEmail.trim();
    const emailValid = isEmailValid(patientEmail);
    
    if (patientEmailRequired && !emailProvided) return false;
    return basicValid && emailValid;
  };

  const togglePractice = (name) => {
    setSelectedPractices(prev => {
      if (prev.includes(name)) return prev.filter(p => p !== name);
      setQuantities(q => ({ ...q, [name]: q[name] || 1 }));
      return [...prev, name];
    });
  };

  const handleAction = async (mode = 'save') => {
    if (!isFormValid()) {
      showToast('Complete los campos obligatorios', 'error');
      return;
    }
    await savePatientToHistory();
    await saveOrderToDB();
    
    setIsGenerating(true);
    try {
      const orderData = { 
        ...patientData, 
        orderType: selectedType,
        practices: selectedPractices, 
        quantities, 
        indications, 
        customPractices,
        allPracticesInCategory: practicesByType[selectedType] || []
      };
      const currentProfile = profile || propProfile || {};
      const result = await generateOrderPDF(orderData, currentProfile, mode);
      if (mode === 'instance') return result;
    } catch (err) {
      showToast('Error al procesar pedido', 'error');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSendEmail = async () => {
    if (!patientData.patientEmail) { showToast('Email requerido', 'error'); return; }
    if (!config.appsScriptUrl) { showToast('Apps Script no configurado', 'error'); return; }
    
    setIsSending(true);
    try {
      const pdfDoc = await handleAction('instance');
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];
      await fetch(config.appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          token: config.token,
          pdfBase64,
          recipientEmails: [patientData.patientEmail],
          subject: `COAT - Pedido: ${patientData.name}`,
          message: `<p>Hola <strong>${patientData.name}</strong>, adjuntamos tu pedido médico.</p>`,
          fileName: `Pedido_${patientData.name.replace(/\s/g, '_')}.pdf`
        })
      });
      showToast('¡Pedido enviado con éxito!');
    } catch (err) { showToast('Error al enviar email.', 'error'); }
    finally { setIsSending(false); }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-3 flex-wrap ml-auto">
          <button onClick={handleSendEmail} disabled={isSending || isGenerating || !isFormValid()} className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 font-bold">
            {isSending ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />} <span>Enviar por Email</span>
          </button>
          <button onClick={() => handleAction('print')} disabled={isGenerating || !isFormValid()} className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-main rounded-xl hover:bg-main hover:text-white transition-all disabled:opacity-30 font-bold">
            <Eye size={18} /> <span>Vista Previa</span>
          </button>
          <button onClick={() => handleAction('save')} disabled={isGenerating || !isFormValid()} className="btn-primary flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-30">
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
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-main)]">
                <User className="text-blue-500" size={20} /> Datos del Paciente
              </h3>
              <div className="flex items-center gap-2 bg-blue-600/10 text-blue-600 px-4 py-2 rounded-xl">
                <Calendar size={16} />
                <input 
                  type="date" 
                  className="bg-transparent border-none text-xs font-bold outline-none cursor-pointer" 
                  value={patientData.date} 
                  onChange={e => setPatientData({...patientData, date: e.target.value})} 
                />
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'DNI / Pasaporte', icon: Hash, key: 'dni', ph: 'Solo números - buscar paciente', required: true },
                { label: 'Nombre Completo', icon: User, key: 'name', ph: '', required: true },
                { label: 'Obra Social', icon: CreditCard, key: 'insurance', ph: '', required: true },
                { label: 'Nro. Afiliado', icon: Hash, key: 'affiliateNumber', ph: 'Solo números', required: true },
                { label: 'Diagnóstico', icon: Stethoscope, key: 'diagnosis', ph: '', required: true },
                { label: 'Email del Paciente', icon: Mail, key: 'patientEmail', ph: patientEmailRequired ? '' : 'Opcional', required: patientEmailRequired }
              ].map(f => (
                <div key={f.key} className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 ml-1">{f.label} {f.required && '*'}</label>
                  <div className="relative">
                    <f.icon className="absolute left-3 top-3.5 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-main rounded-2xl text-xs focus:border-blue-500 outline-none transition-all text-[var(--text-main)]" 
                      placeholder={f.ph} 
                      value={patientData[f.key]} 
                      onChange={e => {
                        let val = e.target.value;
                        if (['dni', 'affiliateNumber'].includes(f.key)) {
                          val = val.replace(/\D/g, '');
                        } else if (['name', 'insurance', 'diagnosis'].includes(f.key)) {
                          val = toTitleCase(val);
                        }
                        setPatientData({...patientData, [f.key]: val});
                      }} 
                    />
                  </div>
                </div>
              ))}
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Observaciones</label>
                <div className="relative">
                  <Clipboard className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <textarea className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-main rounded-2xl text-xs focus:border-blue-500 outline-none transition-all text-[var(--text-main)] min-h-[80px] resize-none" placeholder="" value={patientData.observations} onChange={e => setPatientData({...patientData, observations: e.target.value})} />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-[var(--bg-card)] border border-main rounded-3xl p-4 shadow-sm">
            <div className="flex bg-[var(--bg-card)] p-1 rounded-2xl border border-main mb-6 overflow-x-auto no-scrollbar">
              {orderTypes.map((type) => {
                const Icon = ICON_MAP[type.icon] || ClipboardList;
                return (
                  <button
                    key={type.id}
                    onClick={() => { setSelectedType(type.id); setSelectedPractices([]); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                      selectedType === type.id
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'text-gray-400 hover:bg-[var(--bg-secondary)]'
                    }`}
                  >
                    <Icon size={14} />
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="bg-[var(--bg-card)] border border-main rounded-3xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-main bg-[var(--bg-secondary)]/50 flex items-center justify-between">
              <h3 className="text-lg font-bold flex items-center gap-2 text-[var(--text-main)]"><CheckSquare className="text-blue-500" size={20} /> Selección de Prácticas</h3>
              <div className="text-[10px] font-black bg-blue-100 text-blue-600 px-3 py-1 rounded-full">{selectedPractices.length} SELECCIONADAS</div>
            </div>
            <div className="p-4 bg-[var(--bg-secondary)]/30 border-b border-main">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Buscar práctica..." 
                  className="w-full pl-10 pr-4 py-2 bg-[var(--bg-card)] border border-main rounded-xl text-xs focus:border-blue-500 outline-none transition-all text-[var(--text-main)]" 
                  value={searchQuery} 
                  onChange={e => setSearchQuery(e.target.value)} 
                />
              </div>
            </div>

            <div className="p-6 space-y-0.5 max-h-[450px] overflow-y-auto custom-scrollbar border-b border-main">
              {selectedType === 'preop' ? (() => {
                const labItems = ["Citológico completo", "Glucemia", "Uremia", "Creatinina", "Recuento de plaquetas", "APP", "KPTT"];
                const cardioItems = ["E.C.G.", "Valoración Cardiovascular", "Informe de riesgo quirúrgico (ASA)"];
                const rxItems = ["RX Tórax (Frente)"];
                const practices = practicesByType[selectedType] || [];
                
                const groups = [
                  { 
                    id: 'lab', 
                    label: 'LABORATORIO', 
                    items: [
                      ...practices.filter(p => labItems.includes(p.n)),
                      ...customPractices.map(p => ({ n: p, c: '' }))
                    ], 
                    canAdd: true 
                  },
                  { id: 'cardio', label: 'CARDIOVASCULAR', items: practices.filter(p => cardioItems.includes(p.n)), canAdd: false },
                  { id: 'rx', label: 'RADIOLOGÍA', items: practices.filter(p => rxItems.includes(p.n)), canAdd: false }
                ];

                return groups.map(group => (
                  <div key={group.id} className="mb-8 last:mb-0">
                    <div className="flex items-center gap-4 mb-4 px-2">
                      <div className="h-0.5 flex-1 bg-slate-300 dark:bg-slate-700"></div>
                      <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-[0.2em]">{group.label}</span>
                      <div className="h-0.5 flex-1 bg-slate-300 dark:bg-slate-700"></div>
                    </div>
                    
                    {group.items.filter(p => p.n.toLowerCase().includes(searchQuery.toLowerCase())).map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors group">
                        <div onClick={() => togglePractice(p.n)} className="flex items-center gap-4 flex-1 cursor-pointer">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedPractices.includes(p.n) ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-300'}`}>
                            {selectedPractices.includes(p.n) && <Check className="text-white" size={14} strokeWidth={4} />}
                          </div>
                          <div className="flex flex-col flex-1">
                            <span className={`text-[13px] font-medium ${selectedPractices.includes(p.n) ? 'text-blue-600 font-bold' : 'text-[var(--text-main)]'}`}>{p.n}</span>
                            {selectedPractices.includes(p.n) && (
                              <input 
                                type="text" 
                                placeholder="Indicación particular..." 
                                className="mt-1.5 text-[11px] bg-transparent border-b border-blue-200 focus:border-blue-500 outline-none text-blue-600 pb-0.5" 
                                value={indications[p.n] || ''} 
                                onChange={e => setIndications({...indications, [p.n]: e.target.value})} 
                                onClick={e => e.stopPropagation()} 
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {group.canAdd && (
                      <div className="mt-2 px-2">
                        <div className="flex gap-2">
                          <input 
                            type="text" 
                            placeholder="+ Agregar laboratorio..." 
                            className="flex-1 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs focus:ring-1 focus:ring-blue-500 outline-none" 
                            onKeyDown={e => {
                              if (e.key === 'Enter' && e.target.value.trim()) {
                                const p = e.target.value.trim();
                                setCustomPractices([...customPractices, p]);
                                setSelectedPractices([...selectedPractices, p]);
                                setQuantities({...quantities, [p]: 1});
                                e.target.value = '';
                              }
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ));
              })() : (
                practicesByType[selectedType]?.filter(p => p.n.toLowerCase().includes(searchQuery.toLowerCase())).map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/40 transition-colors group">
                    <div onClick={() => togglePractice(p.n)} className="flex items-center gap-4 flex-1 cursor-pointer">
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${selectedPractices.includes(p.n) ? 'bg-blue-600 border-blue-600' : 'bg-transparent border-slate-300'}`}>
                        {selectedPractices.includes(p.n) && <Check className="text-white" size={14} strokeWidth={4} />}
                      </div>
                      <div className="flex flex-col flex-1">
                        <span className={`text-[13px] font-medium ${selectedPractices.includes(p.n) ? 'text-blue-600 font-bold' : 'text-[var(--text-main)]'}`}>{p.n}</span>
                        {selectedPractices.includes(p.n) && (
                          <input 
                            type="text" 
                            placeholder="Indicación particular..." 
                            className="mt-1.5 text-[11px] bg-transparent border-b border-blue-200 focus:border-blue-500 outline-none text-blue-600 pb-0.5" 
                            value={indications[p.n] || ''} 
                            onChange={e => setIndications({...indications, [p.n]: e.target.value})} 
                            onClick={e => e.stopPropagation()} 
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <button onClick={() => setQuantities(q => ({...q, [p.n]: Math.max(1, (q[p.n] || 1) - 1)}))} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><Minus size={14} /></button>
                      <span className="w-4 text-center text-xs font-bold text-blue-600">{quantities[p.n] || 1}</span>
                      <button onClick={() => setQuantities(q => ({...q, [p.n]: (q[p.n] || 1) + 1}))} className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"><Plus size={14} /></button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {selectedType !== 'preop' && (
              <div className="p-6 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Otras prácticas personalizadas</h4>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="Agregar práctica..." 
                    className="flex-1 bg-[var(--bg-card)] border border-main rounded-2xl px-5 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none shadow-inner" 
                    value={newCustomPractice} 
                    onChange={e => setNewCustomPractice(e.target.value)} 
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newCustomPractice.trim()) {
                        const p = newCustomPractice.trim();
                        setCustomPractices([...customPractices, p]);
                        setSelectedPractices([...selectedPractices, p]);
                        setQuantities({...quantities, [p]: 1});
                        setNewCustomPractice('');
                      }
                    }}
                  />
                  <button 
                    onClick={() => {
                      if (newCustomPractice.trim()) {
                        const p = newCustomPractice.trim();
                        setCustomPractices([...customPractices, p]);
                        setSelectedPractices([...selectedPractices, p]);
                        setQuantities({...quantities, [p]: 1});
                        setNewCustomPractice('');
                      }
                    }} 
                    className="w-12 h-12 flex items-center justify-center bg-blue-600 text-white rounded-2xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 active:scale-95"
                  >
                    <Plus size={24} />
                  </button>
                </div>

                <div className="space-y-2">
                  {customPractices.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-[var(--bg-card)] border border-main rounded-2xl group animate-in slide-in-from-left-2 duration-300">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50" />
                        <span className="text-sm font-bold text-[var(--text-main)] uppercase">{p}</span>
                      </div>
                      <button 
                        onClick={() => {
                          setCustomPractices(customPractices.filter((_, i) => i !== idx));
                          setSelectedPractices(selectedPractices.filter(name => name !== p));
                        }} 
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewOrderPage;
