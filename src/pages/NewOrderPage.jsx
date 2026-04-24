import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

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
  Check,
  X,
  Download,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../services/firebase';
import { doc, getDoc, setDoc, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('edit');

  const [orderTypes, setOrderTypes] = useState([]);
  const [practicesByType, setPracticesByType] = useState({});
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);
  const [selectedType, setSelectedType] = useState('coat');
  const [patientEmailRequired, setPatientEmailRequired] = useState(false);
  const [requiredFields, setRequiredFields] = useState({
    requiredDni: true,
    requiredName: true,
    requiredInsurance: true,
    requiredAffiliateNumber: true,
    requiredDiagnosis: true,
  });


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
  const [isCleaning, setIsCleaning] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(''); // New state for descriptive messages
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [profile, setProfile] = useState(propProfile || null);
  const [config, setConfig] = useState({ adminEmail: '', appsScriptUrl: '', token: '' });
  const [previewUrl, setPreviewUrl] = useState(null);
  const [orderMetadata, setOrderMetadata] = useState({ sentToAdmin: false });
  const isSavingRef = React.useRef(false);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  const [emailAutoFilledToast, setEmailAutoFilledToast] = useState(false);
  const [emailMissingWarning, setEmailMissingWarning] = useState(false);

  useEffect(() => {
    const searchPatient = async () => {
      const cleanDni = patientData.dni.trim();
      if (cleanDni.length >= 7 && cleanDni.length <= 9) {
        try {
          const docSnap = await getDoc(doc(db, 'patients', cleanDni));
          if (docSnap.exists()) {
            const data = docSnap.data();
            const autoEmail = data.email || data.patientEmail || '';
            setPatientData(prev => ({
              ...prev,
              name: data.name || prev.name,
              insurance: data.insurance || prev.insurance,
              affiliateNumber: data.affiliateNumber || prev.affiliateNumber,
              patientEmail: autoEmail || prev.patientEmail
            }));
            showToast('✓ Paciente encontrado en historial');
            if (autoEmail) {
              setEmailAutoFilledToast(true);
              setEmailMissingWarning(false);
              setTimeout(() => setEmailAutoFilledToast(false), 10000);
            } else {
              // Patient found but no email on file — prompt to verify for 10s
              setEmailMissingWarning(true);
              setTimeout(() => setEmailMissingWarning(false), 10000);
            }
          }
        } catch (err) {}
      } else {
        setEmailMissingWarning(false);
      }
    };
    const timer = setTimeout(searchPatient, 600);
    return () => clearTimeout(timer);
  }, [patientData.dni]);

  const savePatientToHistory = async () => {
    const cleanDni = patientData.dni.trim();
    if (!cleanDni || cleanDni.length < 7) return;
    try {
      const payload = {
        name: patientData.name.trim(),
        dni: cleanDni,
        insurance: patientData.insurance.trim(),
        affiliateNumber: patientData.affiliateNumber.trim(),
        lastUpdated: new Date().toISOString()
      };
      // Only update email if user has entered one — never overwrite with empty
      if (patientData.patientEmail.trim()) {
        payload.email = patientData.patientEmail.trim();
      }
      await setDoc(doc(db, 'patients', cleanDni), payload, { merge: true });
    } catch (err) {}
  };

  const [currentOrderId, setCurrentOrderId] = useState(null);

  const saveOrderToDB = async () => {
    try {
      const orderData = {
        ...patientData,
        orderType: selectedType,
        practices: selectedPractices,
        quantities,
        indications,
        customPractices,
        allPracticesInCategory: practicesByType[selectedType] || [],
        profesionalId: auth.currentUser?.uid,
        profesionalName: profile?.nombre || profile?.n || auth.currentUser?.email,
        updatedAt: serverTimestamp(),
        timestamp: new Date().toISOString()
      };

      if (currentOrderId) {
        console.log("Updating existing order:", currentOrderId);
        await updateDoc(doc(db, 'orders', currentOrderId), orderData);
        showToast("Pedido actualizado en historial");
        return currentOrderId;
      } else {
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        try {
          console.log("Creating new order document...");
          const docRef = await addDoc(collection(db, 'orders'), {
            ...orderData,
            createdAt: serverTimestamp(),
            sentToAdmin: false
          });
          setCurrentOrderId(docRef.id);
          console.log("New order created with ID:", docRef.id);
          showToast("Pedido guardado en historial");
          return docRef.id;
        } finally {
          isSavingRef.current = false;
        }
      }
    } catch (err) {
      console.error("Error saving order:", err);
      showToast('Error al persistir en base de datos', 'error');
      return null;
    }
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
          setRequiredFields({
            requiredDni:             data.requiredDni             !== false,
            requiredName:            data.requiredName            !== false,
            requiredInsurance:       data.requiredInsurance       !== false,
            requiredAffiliateNumber: data.requiredAffiliateNumber !== false,
            requiredDiagnosis:       data.requiredDiagnosis       !== false,
          });
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

  // Effect to load order data for EDIT mode
  useEffect(() => {
    const loadOrderForEdit = async () => {
      if (!editId) return;
      
      setIsLoadingSettings(true);
      try {
        const orderSnap = await getDoc(doc(db, 'orders', editId));
        if (orderSnap.exists()) {
          const data = orderSnap.data();
          setCurrentOrderId(editId);
          
          setPatientData({
            name: data.name || '',
            dni: data.dni || '',
            insurance: data.insurance || '',
            affiliateNumber: data.affiliateNumber || '',
            diagnosis: data.diagnosis || '',
            date: data.date || new Date().toISOString().split('T')[0],
            patientEmail: data.patientEmail || '',
            observations: data.observations || ''
          });
          
          if (data.orderType) setSelectedType(data.orderType);
          setSelectedPractices(data.practices || []);
          setQuantities(data.quantities || {});
          setIndications(data.indications || {});
          setCustomPractices(data.customPractices || []);
          setOrderMetadata({ sentToAdmin: data.sentToAdmin || false });
          
          showToast('Pedido cargado para edición');
        } else {
          showToast('No se encontró el pedido a editar', 'error');
        }
      } catch (err) {
        console.error("Error loading order for edit:", err);
        showToast('Error al cargar pedido', 'error');
      } finally {
        setIsLoadingSettings(false);
      }
    };
    loadOrderForEdit();
  }, [editId]);


  const isEmailValid = (email) => !email || !email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isFormValid = () => {
    const { name, insurance, diagnosis, patientEmail, dni, affiliateNumber } = patientData;
    if (requiredFields.requiredDni             && !dni.trim())             return false;
    if (requiredFields.requiredName            && !name.trim())            return false;
    if (requiredFields.requiredInsurance       && !insurance.trim())       return false;
    if (requiredFields.requiredAffiliateNumber && !affiliateNumber.trim()) return false;
    if (requiredFields.requiredDiagnosis       && !diagnosis.trim())       return false;
    if (patientEmailRequired                   && !patientEmail.trim())    return false;
    if (!isEmailValid(patientEmail))                                       return false;
    if (selectedPractices.length === 0)                                    return false;
    return true;
  };

  const togglePractice = (name) => {
    setCurrentOrderId(null); // Reset save flag if form changes
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
    
    setLoadingStatus(mode === 'print' ? 'Preparando descarga...' : mode === 'preview' ? 'Generando vista previa...' : 'Guardando datos...');
    setIsGenerating(true);
    
    try {
      await savePatientToHistory();
      const orderId = await saveOrderToDB();
      
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
      const result = await generateOrderPDF(orderData, currentProfile, mode === 'preview' ? 'instance' : mode);
      
      if (mode === 'preview') {
        const url = result.output('bloburl');
        setPreviewUrl(url);
      }
      
      if (mode === 'instance') return result;
    } catch (err) {
      console.error("Error in handleAction:", err);
      showToast('Error al procesar pedido', 'error');
    } finally {
      setIsGenerating(false);
      setLoadingStatus('');
    }
  };

  const handleSendEmail = async () => {
    if (!config.appsScriptUrl) { showToast('Apps Script no configurado', 'error'); return; }
    
    setIsSending(true);
    setLoadingStatus('Procesando envío de pedido...');
    try {
      const pdfDoc = await handleAction('instance');
      if (!pdfDoc) {
        setIsSending(false);
        return;
      }
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

      const formatDateForEmail = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}-${m}-${y}`;
      };

      const emailFooter = `
        <div style="margin-top: 30px; border-top: 2px solid #2563eb; padding-top: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-family: sans-serif;">
            <tr>
              <td style="vertical-align: top; width: 100px;">
                <img src="https://informescoat.web.app/coat_logo.png" alt="COAT" width="80" style="display: block;">
              </td>
              <td style="vertical-align: top; padding-left: 15px;">
                <h3 style="margin: 0; color: #1e3a8a; font-size: 16px;">COAT</h3>
                <p style="margin: 3px 0; color: #555; font-size: 12px;">📍 Urquiza 401 - Alberdi</p>
                <p style="margin: 3px 0; color: #555; font-size: 12px;">📞 Tel: (0351) 423-0530 / 423-9428</p>
                <p style="margin: 3px 0; color: #555; font-size: 12px;">📱 WhatsApp: <a href="https://wa.me/5493543579794" style="color: #25d366; text-decoration: none; font-weight: bold;">3543579794</a></p>
                <p style="margin: 3px 0; color: #555; font-size: 12px;">📧 Email: <a href="mailto:info@coat.com.ar" style="color: #2563eb; text-decoration: none;">info@coat.com.ar</a></p>
                <div style="margin-top: 10px;">
                  <a href="https://www.facebook.com/coatcordoba" style="text-decoration: none; display: inline-block; margin-right: 15px;">
                    <img src="https://img.icons8.com/color/24/facebook-new.png" width="24" height="24" alt="Facebook" style="vertical-align: middle; border: 0;">
                  </a>
                  <a href="https://www.instagram.com/coatcordoba/" style="text-decoration: none; display: inline-block;">
                    <img src="https://img.icons8.com/color/24/instagram-new.png" width="24" height="24" alt="Instagram" style="vertical-align: middle; border: 0;">
                  </a>
                </div>
              </td>
            </tr>
          </table>
        </div>
      `;

      const displayTitle = selectedPractices.join(', ');
      const emailBody = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
          <p>Estimado/a <strong>${patientData.name}</strong>,</p>
          <p>Esperamos que se encuentre bien.</p>
          <p>Le informamos que ya está disponible su <strong>pedido médico</strong> generado en COAT. Adjunto a este correo encontrará el documento en formato PDF.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Detalles del pedido:</strong></p>
            <ul style="list-style: none; padding-left: 0; margin: 10px 0 0 0;">
              <li><strong>Paciente:</strong> ${patientData.name}</li>
              <li><strong>Estudio/Prácticas:</strong> ${displayTitle}</li>
              <li><strong>Fecha:</strong> ${formatDateForEmail(patientData.date)}</li>
              <li><strong>Profesional Responsable:</strong> ${profile?.nombre || 'Dr/a.'}</li>
            </ul>
          </div>

          <p>Si tiene alguna duda respecto al contenido del pedido, por favor no dude en contactarse con nosotros.</p>
          
          <p>Atentamente,<br/><strong>Equipo de COAT.</strong></p>
          
          ${emailFooter}
          
          <p style="font-size: 11px; color: #999; margin-top: 30px;">
            Este es un mensaje automático, por favor no responda a esta dirección de correo.
          </p>
        </div>
      `;

      // Envío a Administración
      if (config.adminEmail && !orderMetadata.sentToAdmin) {
        setLoadingStatus('Enviando copia a administración...');
        try {
          await fetch(config.appsScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
              token: config.token,
              pdfBase64,
              recipientEmails: [config.adminEmail],
              subject: `Pedido Médico: ${patientData.name}`,
              message: emailBody,
              fileName: `Pedido_${patientData.name.replace(/\s/g, '_')}.pdf`
            })
          });
          
          // Marcamos como enviado inmediatamente si el fetch no lanzó error (aunque sea no-cors)
          if (currentOrderId) {
            await updateDoc(doc(db, 'orders', currentOrderId), { sentToAdmin: true });
            setOrderMetadata(prev => ({ ...prev, sentToAdmin: true }));
          }
        } catch (e) {
          console.warn("Error enviando copia admin:", e);
        }
      }

      // Envío al Paciente
      if (patientData.patientEmail) {
        setLoadingStatus('Enviando pedido al paciente...');
        await fetch(config.appsScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            token: config.token,
            pdfBase64,
            recipientEmails: [patientData.patientEmail],
            subject: `COAT - Pedido Médico: ${patientData.name}`,
            message: emailBody,
            fileName: `Pedido_${patientData.name.replace(/\s/g, '_')}.pdf`
          })
        });
      }

      showToast('¡Email enviado con éxito!');
    } catch (err) { 
      console.error("Error en handleSendEmail:", err);
      showToast('Error al enviar el email.', 'error'); 
    }
    finally { 
      setIsSending(false);
      setIsGenerating(false);
      setLoadingStatus('');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex gap-3 flex-wrap ml-auto">
          <button onClick={handleSendEmail} disabled={isSending || isGenerating || !isFormValid()} className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all disabled:opacity-30 font-bold">
            {isSending ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />} <span>Enviar por Email</span>
          </button>
          <button onClick={() => handleAction('preview')} disabled={isGenerating || !isFormValid()} className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border border-main rounded-xl hover:bg-main hover:text-white transition-all disabled:opacity-30 font-bold">
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
                { label: 'DNI / Pasaporte',    icon: Hash,        key: 'dni',             ph: 'Solo números - buscar paciente', required: requiredFields.requiredDni },
                { label: 'Nombre Completo',    icon: User,        key: 'name',            ph: '',                               required: requiredFields.requiredName },
                { label: 'Obra Social',        icon: CreditCard,  key: 'insurance',       ph: '',                               required: requiredFields.requiredInsurance },
                { label: 'Nro. Afiliado',      icon: Hash,        key: 'affiliateNumber', ph: 'Solo números',                   required: requiredFields.requiredAffiliateNumber },
                { label: 'Diagnóstico',        icon: Stethoscope, key: 'diagnosis',       ph: '',                               required: requiredFields.requiredDiagnosis },
                { label: 'Email del Paciente', icon: Mail,        key: 'patientEmail',    ph: patientEmailRequired ? '' : 'Opcional', required: patientEmailRequired }
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
                  {/* Email auto-filled / missing badges */}
                  {f.key === 'patientEmail' && (
                    <AnimatePresence>
                      {emailAutoFilledToast && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-1.5 ml-1 mt-1"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                          <span className="text-[10px] font-bold text-green-500">
                            Email autocargado del historial del paciente
                          </span>
                        </motion.div>
                      )}
                      {emailMissingWarning && !emailAutoFilledToast && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.25 }}
                          className="flex items-center gap-1.5 ml-1 mt-1"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span className="text-[10px] font-bold text-amber-500">
                            Verificar email con el paciente
                          </span>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  )}
                </div>
              ))}
              <div className="space-y-1.5 pt-2">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Observaciones</label>
                <div className="relative">
                  <Clipboard className="absolute left-3 top-3.5 text-slate-400" size={16} />
                  <textarea 
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-secondary)] border border-main rounded-2xl text-xs focus:border-blue-500 outline-none transition-all text-[var(--text-main)] min-h-[80px] resize-none" 
                    placeholder="" 
                    value={patientData.observations} 
                    onChange={e => {
                      setPatientData({...patientData, observations: e.target.value});
                    }} 
                  />
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
                    onClick={() => { 
                      setSelectedType(type.id); 
                      setSelectedPractices([]); 
                    }}
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
                            onChange={e => {
                              setIndications({...indications, [p.n]: e.target.value});
                            }} 
                            onClick={e => e.stopPropagation()} 
                          />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <button 
                        onClick={() => {
                          setCurrentOrderId(null);
                          setQuantities(q => ({...q, [p.n]: Math.max(1, (q[p.n] || 1) - 1)}));
                        }} 
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-4 text-center text-xs font-bold text-blue-600">{quantities[p.n] || 1}</span>
                      <button 
                        onClick={() => {
                          setQuantities(q => ({...q, [p.n]: (q[p.n] || 1) + 1}));
                        }} 
                        className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400"
                      >
                        <Plus size={14} />
                      </button>
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
                        setCurrentOrderId(null);
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
                        setCurrentOrderId(null);
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
      {/* Loading Overlay */}
      <AnimatePresence>
        {(isGenerating || isSending) && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[var(--bg-card)] border border-white/20 rounded-[40px] p-10 shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
                <div className="relative w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-500/40">
                  <Loader2 className="text-white animate-spin" size={40} strokeWidth={2.5} />
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-[var(--text-main)]">Procesando...</h3>
                <p className="text-blue-500 font-bold uppercase tracking-widest text-[10px] bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full inline-block">
                  {loadingStatus || 'Espere un momento'}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Preview Overlay */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[var(--bg-page)] flex flex-col"
          >
            {/* Overlay Header */}
            <div className="h-16 bg-[var(--bg-secondary)] border-b border-main flex items-center justify-between px-6 shadow-sm shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-black tracking-tight text-[var(--text-main)]">Vista Previa Pedido</h2>
                <div className="h-6 w-[1px] bg-[var(--border-main)]"></div>
                <p className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-widest">{patientData.name}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={async () => await handleAction('save')}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  <Download size={16} />
                  Descargar
                </button>
                {patientData.patientEmail && (
                  <button 
                    disabled={isSending}
                    onClick={handleSendEmail}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {isSending ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                    Reenviar al Paciente
                  </button>
                )}
                <button 
                  onClick={async () => await handleAction('print')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                >
                  <Printer size={16} />
                  Imprimir
                </button>
                <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
                <button 
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95"
                >
                  <X size={16} />
                  Cerrar
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-[var(--bg-secondary)]">
              <div className="w-full max-w-5xl h-full bg-white rounded-2xl shadow-2xl overflow-hidden">
                <iframe 
                  src={previewUrl}
                  className="w-full h-full border-none"
                  title="PDF Preview"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NewOrderPage;

