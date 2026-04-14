import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { 
  FilePlus, 
  Printer, 
  Send, 
  User as UserIcon,
  Calendar,
  CreditCard,
  UserPlus,
  Settings2,
  Loader2,
  CheckCircle,
  ClipboardList,
  ArrowRight,
  Settings
} from 'lucide-react';
import { db, auth } from '../services/firebase';
import { doc, getDoc, collection, getDocs, addDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

const ReportsPage = () => {
  const [reportData, setReportData] = useState({
    patient: '',
    socialWork: '',
    dni: '',
    date: new Date().toISOString().split('T')[0],
    requester: '',
    reason: '',
    patientEmail: '',
    includeTitle: true
  });
  
  const [selectedPractice, setSelectedPractice] = useState('');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [config, setConfig] = useState({ adminEmail: '', appsScriptUrl: '', token: '' });
  const [professional, setProfessional] = useState(null);
  const [dbPractices, setDbPractices] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const editId = new URLSearchParams(location.search).get('edit');
  const [isEditing, setIsEditing] = useState(false);
  
  // Sistema de Notificaciones Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  // Guardar en el historial corregido para manejar EDICIÓN
  const saveToHistory = async (pdfUrl = null) => {
    if (!auth.currentUser || !reportData.patient) return;
    try {
      const data = {
        profesionalId: auth.currentUser.uid,
        profesionalNombre: professional?.nombre || 'Desconocido',
        pacienteNombre: reportData.patient.toUpperCase(),
        pacienteDni: reportData.dni || '',
        obraSocial: reportData.socialWork.toUpperCase(),
        fecha: reportData.date,
        practicaNombre: selectedPractice,
        tipoReporte: selectedPractice.toLowerCase().includes('fibro') ? 'fibro' : 'clinico',
        contenidoTexto: content,
        requester: reportData.requester || '',
        reason: reportData.reason || '',
        patientEmail: reportData.patientEmail || '',
        includeTitle: reportData.includeTitle,
        pdfUrl: pdfUrl,
        fechaUpdatedAt: new Date().toISOString()
      };

      if (!editId) {
        data.fechaCreatedAt = new Date().toISOString();
        await addDoc(collection(db, 'reports'), data);
      } else {
        const { setDoc, doc } = await import('firebase/firestore');
        await setDoc(doc(db, 'reports', editId), data, { merge: true });
        showToast("¡Informe actualizado correctamente!");
        setTimeout(() => navigate('/history'), 1500);
      }
    } catch (err) {
      console.error("Error saving history:", err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        const email = auth.currentUser.email || '';
        
        const docRef = doc(db, 'users', uid);
        let docSnap = await getDoc(docRef);
        let profData = null;

        if (docSnap.exists()) {
          profData = docSnap.data();
        } else if (email) {
          const legacyId = email.replace(/[@.]/g, '_');
          const legacyRef = doc(db, 'users', legacyId);
          const legacySnap = await getDoc(legacyRef);
          if (legacySnap.exists()) {
            profData = legacySnap.data();
          }
        }

        if (profData) {
          setProfessional({
            ...profData,
            nombre: profData.nombre || profData.n || 'Médico',
            especialidad: profData.especialidad || profData.esp || '',
            mp: profData.mp || profData.m || '',
            headerGeneral: profData.headerGeneral || Array(8).fill(''),
            headerFibro: profData.headerFibro || Array(8).fill(''),
          });
        }

        const practicesRef = collection(db, 'practices');
        const practicesSnap = await getDocs(practicesRef);
        const list = practicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDbPractices(list);

        const configRef = doc(db, 'config', 'settings');
        const configSnap = await getDoc(configRef);
        if (configSnap.exists()) {
          setConfig(configSnap.data());
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };
    fetchData();
  }, []);

  // Lógica para CARGAR el informe si estamos editando
  useEffect(() => {
    const loadReportToEdit = async () => {
      if (editId) {
        setIsEditing(true);
        try {
          const docRef = doc(db, 'reports', editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setReportData({
              patient: data.pacienteNombre || '',
              socialWork: data.obraSocial || '',
              dni: data.pacienteDni || '',
              date: data.fecha || new Date().toISOString().split('T')[0],
              requester: data.requester || '',
              reason: data.reason || '',
              patientEmail: data.patientEmail || '',
              includeTitle: data.includeTitle !== undefined ? data.includeTitle : true
            });
            setSelectedPractice(data.practicaNombre || '');
            setContent(data.contenidoTexto || ''); // Cargamos el texto enriquecido guardado
          }
        } catch (err) {
          console.error("Error cargando informe para editar:", err);
        }
      }
    };
    loadReportToEdit();
  }, [editId]);

  const handlePracticeChange = (practiceName) => {
    setSelectedPractice(practiceName);
    const p = dbPractices.find(item => item.n === practiceName);
    if (p) {
      const personal = (professional?.personalPractices || {})[p.id];
      let bodyText = "";
      
      if (personal) {
        bodyText = typeof personal === 'string' ? personal : (personal.b || '');
      } else {
        bodyText = p.b || '';
      }

      if (bodyText && !bodyText.includes('<p>')) {
        bodyText = bodyText.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '<p><br></p>').join('');
      }
      
      setContent(bodyText);
    }
  };

  const generatePDF = (mode = 'print') => {
    if (!reportData.patient || !reportData.socialWork || !reportData.date) {
      showToast('Complete los campos obligatorios: Paciente, Obra Social y Fecha.', 'error');
      return null;
    }

    setIsGenerating(true);
    const doc = new jsPDF();
    const prof = professional || {};
    const pageWidth = doc.internal.pageSize.width;
    
    // Select Header
    const isFibro = (selectedPractice || '').toLowerCase().includes('rinofaringolaringofibroscopia');
    const activeHeader = isFibro ? (prof.headerFibro || []) : (prof.headerGeneral || []);

    // 1. Logo
    const logoUrl = "/coat_logo.png";
    try {
      doc.addImage(logoUrl, 'PNG', 10, 8, 30, 20);
    } catch (e) {
      console.error("Logo error:", e);
    }

    // 2. Header Text
    doc.setTextColor(60, 60, 60);
    let headerY = 16; 
    activeHeader.forEach((line, index) => {
      if (line && line.trim() !== '') {
        let fontSize = 7.5;
        if (index === 0) fontSize = 11;
        else if (index === 1 || index === 2) fontSize = 10;
        
        doc.setFontSize(fontSize);
        doc.setFont('helvetica', index === 0 ? 'bold' : 'normal'); 
        doc.text(line.toUpperCase(), 125, headerY, { align: 'center' });
        headerY += (fontSize / 2.8) + 0.8;
      } else {
        headerY += 4.5;
      }
    });

    let currentY = Math.max(headerY + 5, 55); 
    doc.setDrawColor(200);
    doc.line(10, currentY - 5, 200, currentY - 5);

    // Patients Data
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    const pInfo = [];
    if (reportData.patient) pInfo.push(`PACIENTE: ${reportData.patient.toUpperCase()}`);
    if (reportData.socialWork) pInfo.push(`OBRA SOCIAL: ${reportData.socialWork.toUpperCase()}`);
    if (reportData.dni) pInfo.push(`DNI: ${reportData.dni}`);
    doc.text(pInfo.join('  |  '), 10, currentY);
    currentY += 6;

    const cInfo = [];
    cInfo.push(`FECHA: ${new Date(reportData.date).toLocaleDateString('es-AR')}`);
    if (reportData.requester && reportData.requester.trim()) cInfo.push(`SOLICITANTE: ${reportData.requester.toUpperCase()}`);
    if (reportData.reason && reportData.reason.trim()) cInfo.push(`MOTIVO: ${reportData.reason.toUpperCase()}`);
    doc.text(cInfo.join('  |  '), 10, currentY);
    currentY += 6;

    doc.line(10, currentY, 200, currentY);
    currentY += 10;

    // Report Title
    if (reportData.includeTitle && selectedPractice) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const title = `INFORME DE ${selectedPractice.toUpperCase()}`;
      const titleWidth = doc.getTextWidth(title);
      const centerX = (pageWidth - titleWidth) / 2;
      
      doc.text(title, centerX, currentY);
      doc.line(centerX, currentY + 1, centerX + titleWidth, currentY + 1);
      currentY += 12;
    }

    // Main Content
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    const cleanContent = (content || "Sin observaciones registradas.")
      .replace(/<\/p>/g, '\n')
      .replace(/<\/div>/g, '\n')
      .replace(/<br\s*\/?>/g, '\n')
      .replace(/<li>/g, '\n• ')
      .replace(/<[^>]*>/g, '');
    
    const lines = cleanContent.split('\n');
    let yPos = currentY;
    const pageHeight = doc.internal.pageSize.height;

    lines.forEach(line => {
      if (!line.trim()) {
        yPos += 1.5;
        return;
      }
      const isHeader = line.includes(':') && line.indexOf(':') < 20;
      doc.setFont("helvetica", isHeader ? "bold" : "normal");
      const splitLines = doc.splitTextToSize(line.trim(), 180);
      if (yPos + (splitLines.length * 4.5) > pageHeight - 60) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(splitLines, 10, yPos);
      yPos += (splitLines.length * 4.5);
    });

    // Signature Area
    currentY = yPos + 15;
    if (prof.signatureBase64) {
      try {
        doc.addImage(prof.signatureBase64, 'PNG', 140, currentY, 40, 15);
        currentY += 18;
      } catch (e) {
        console.error("Error signature:", e);
      }
    } else {
        currentY += 10;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    
    const footerLines = [
      prof.nombre || 'Profesional',
      prof.especialidad || 'Especialista',
      `MP: ${prof.mp || '-'} ${prof.me ? ` | ME: ${prof.me}` : ''}`
    ];

    footerLines.forEach((text, i) => {
      if (i === 1) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
      }
      doc.text(text, 160, currentY, { align: 'center' });
      currentY += (i === 0 ? 4 : 3.5);
    });

    if (mode === 'print') {
      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl, '_blank');
      saveToHistory();
    } else if (mode === 'save') {
      doc.save(`Informe_${reportData.patient.replace(/\s/g, '_')}.pdf`);
      saveToHistory();
    }
    
    setIsGenerating(false);
    return doc;
  };

  const handleSendReport = async () => {
    if (!config.appsScriptUrl) {
      showToast('Falta configurar el Webhook de Google Apps Script.', 'error');
      return;
    }
    
    if (!reportData.patient || !selectedPractice) {
      showToast('Complete al menos Paciente y Práctica para enviar.', 'error');
      return;
    }

    setIsSending(true);
    try {
      const pdfDoc = generatePDF('instance');
      if (!pdfDoc) {
        setIsSending(false);
        return;
      }
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

      const recipientEmails = [config.adminEmail];
      if (reportData.patientEmail) {
        recipientEmails.push(reportData.patientEmail);
      }

      const subject = `COAT Informes - Paciente: ${reportData.patient} - ${selectedPractice}`;
      const bodyText = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2563eb;">Nuevo Informe Clínico - COAT</h2>
          <p>Estimado/a,</p>
          <p>Se adjunta el informe correspondiente al estudio realizado en nuestro centro.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
          <ul style="list-style: none; padding: 0;">
            <li><strong>Paciente:</strong> ${reportData.patient}</li>
            <li><strong>Estudio:</strong> ${selectedPractice}</li>
            <li><strong>Fecha:</strong> ${reportData.date}</li>
            <li><strong>Profesional:</strong> ${professional?.nombre || 'Dr/a.'}</li>
          </ul>
          <p style="font-size: 12px; color: #666; margin-top: 30px;">
            Este es un envío automático desde el sistema de Informes COAT. Por favor, no responda a este correo.
          </p>
        </div>
      `;

      await fetch(config.appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: config.token,
          pdfBase64,
          recipientEmails,
          subject,
          message: bodyText,
          fileName: `Informe_${reportData.patient.replace(/\s/g, '_')}.pdf`
        })
      });
      saveToHistory();
      showToast('¡Informe enviado con éxito!');
    } catch (err) {
      console.error(err);
      showToast('Error al enviar el informe técnico.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-[var(--bg-card)] p-4 rounded-3xl shadow-sm border border-main">
        <h1 className="text-xl font-bold text-[var(--text-main)]">Generador de Informes</h1>
        <p className="text-[10px] text-[var(--text-sub)] uppercase tracking-widest font-bold">Herramienta de Diagnóstico Digital</p>
      </div>

      {professional?.role?.toLowerCase().includes('secre') ? (
        <div className="bg-[var(--bg-card)] p-12 rounded-3xl border border-main shadow-sm text-center space-y-6">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 text-blue-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <ClipboardList size={40} />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-black tracking-tight">Modo Secretaría</h3>
            <p className="text-gray-400 max-w-sm mx-auto font-medium leading-relaxed">
              En este apartado solo se pueden generar informes. Para visualizar informes existentes, por favor diríjase a la sección <strong>"Ver Informes"</strong> en el menú lateral.
            </p>
          </div>
          <button 
            onClick={() => navigate('/history')}
            className="group btn-primary px-8 py-4 flex items-center gap-3 mx-auto shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
          >
            <span>Ir a Ver Informes</span>
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      ) : (
        <div className="bg-[var(--bg-card)] p-8 rounded-3xl border border-main shadow-sm space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center justify-between border-b border-main pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                <FilePlus size={24} />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{isEditing ? 'Editar Informe' : 'Nuevo Informe Clínico'}</h2>
                <p className="text-xs text-gray-400">{isEditing ? 'Modificando informe guardado' : 'Complete los datos para generar el PDF protocolizado'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] rounded-xl border border-main">
              <Settings size={16} className="text-gray-400" />
              <label className="text-[10px] font-bold uppercase cursor-pointer select-none flex items-center gap-2">
                <input 
                  type="checkbox" 
                  checked={reportData.includeTitle}
                  onChange={e => setReportData({...reportData, includeTitle: e.target.checked})}
                  className="w-4 h-4 rounded border-main text-blue-600 outline-none"
                />
                Incluir título "Informe de..."
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase opacity-60">Paciente *</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Nombre y Apellido completo"
                value={reportData.patient}
                onChange={e => setReportData({...reportData, patient: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">Fecha *</label>
              <input 
                type="date" 
                className="input-field"
                value={reportData.date}
                onChange={e => setReportData({...reportData, date: e.target.value})}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">Obra Social *</label>
              <input 
                type="text" 
                className="input-field"
                placeholder="Ej: OSDE, PAMI..."
                value={reportData.socialWork}
                onChange={e => setReportData({...reportData, socialWork: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">DNI (Opcional)</label>
              <input 
                type="text" 
                className="input-field"
                placeholder="Sin puntos"
                value={reportData.dni}
                onChange={e => setReportData({...reportData, dni: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">Solicitante (Opc)</label>
              <input 
                type="text" 
                className="input-field"
                placeholder="Médico que solicita..."
                value={reportData.requester}
                onChange={e => setReportData({...reportData, requester: e.target.value})}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase opacity-60 text-blue-600">Práctica Realizada</label>
            <select 
              className="input-field appearance-none cursor-pointer font-bold text-lg text-[var(--text-main)] bg-[var(--bg-secondary)]"
              value={selectedPractice}
              onChange={e => handlePracticeChange(e.target.value)}
            >
              <option value="" className="bg-[var(--bg-card)]">Seleccione una práctica...</option>
              {dbPractices.map(p => <option key={p.id} value={p.n} className="bg-[var(--bg-card)] text-[var(--text-main)]">{p.n}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between ml-1 text-sm font-semibold">
              <span>RESULTADOS / OBSERVACIONES</span>
              <span className="text-[10px] text-gray-400 font-normal">Formato enriquecido activo</span>
            </div>
            <div className="bg-[var(--bg-page)] rounded-2xl overflow-hidden border border-main min-h-[300px]">
              <ReactQuill 
                theme="snow"
                value={content}
                onChange={setContent}
                className="quill-editor-custom"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-main">
              <button 
                className="group flex-1 flex flex-col items-center gap-3 p-6 rounded-3xl bg-[var(--bg-secondary)] border border-main hover:border-blue-500/50 hover:bg-blue-50 transition-all active:scale-95"
                onClick={() => generatePDF('print')}
              >
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Printer size={28} />
                </div>
                <div className="text-center">
                  <span className="block font-bold">Imprimir</span>
                  <span className="text-[10px] text-gray-400">Vista previa y PDF</span>
                </div>
              </button>

              <button 
                className="group flex-1 flex flex-col items-center gap-3 p-6 rounded-3xl bg-[var(--bg-secondary)] border border-main hover:border-emerald-500/50 hover:bg-emerald-50 transition-all active:scale-95"
                onClick={() => generatePDF('save')}
              >
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <CheckCircle size={28} />
                </div>
                <div className="text-center">
                  <span className="block font-bold">{isEditing ? 'Actualizar' : 'Guardar'}</span>
                  <span className="text-[10px] text-gray-400">{isEditing ? 'Guardar cambios' : 'Descargar archivo'}</span>
                </div>
              </button>
            
            <button 
              onClick={handleSendReport}
              className="btn-primary flex items-center justify-center gap-2 px-10 py-4 shadow-lg shadow-blue-500/30 flex-1 md:flex-none"
              disabled={isGenerating || isSending || !reportData.patient || !selectedPractice}
            >
              {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
              {isSending ? 'Enviando...' : 'Enviar Informe'}
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Container */}
      <AnimatePresence>
        {toast.show && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9, x: '-50%' }}
            animate={{ opacity: 1, y: 0, scale: 1, x: '-50%' }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: '-50%' }}
            className="fixed bottom-10 left-1/2 z-[9999]"
          >
            <div className={`
              px-6 py-4 rounded-2xl shadow-2xl border flex items-center gap-4 min-w-[320px] backdrop-blur-md
              ${toast.type === 'success' ? 'bg-emerald-500/90 border-emerald-400 text-white' : 
                toast.type === 'error' ? 'bg-red-500/90 border-red-400 text-white' : 
                'bg-blue-600/90 border-blue-400 text-white'}
            `}>
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                {toast.type === 'success' ? <CheckCircle size={20} /> : <ClipboardList size={20} />}
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm leading-tight">{toast.message}</p>
              </div>
              <button 
                onClick={() => setToast(prev => ({ ...prev, show: false }))}
                className="hover:bg-white/10 p-1 rounded-lg transition-colors"
              >
                <Loader2 size={16} className={toast.type === 'error' ? 'text-white' : 'hidden'} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReportsPage;
