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
  CheckCircle
} from 'lucide-react';
import { db, auth } from '../services/firebase';
import { doc, getDoc, collection, getDocs, addDoc, query, where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { History, Search as SearchIcon, X as CloseIcon, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [config, setConfig] = useState({ adminEmail: '', appsScriptUrl: '' });
  const [professional, setProfessional] = useState(null);
  const [dbPractices, setDbPractices] = useState([]);
  const [history, setHistory] = useState([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const saveToHistory = async () => {
    if (!auth.currentUser || !reportData.patient) return;
    try {
      await addDoc(collection(db, 'reports_history'), {
        userId: auth.currentUser.uid,
        profName: professional?.nombre || '',
        patient: reportData.patient.toUpperCase(),
        socialWork: reportData.socialWork.toUpperCase(),
        date: reportData.date,
        practice: selectedPractice,
        content: content.substring(0, 500), // Only first 500 chars to save space
        createdAt: new Date().toISOString()
      });
      fetchHistory(); // Refresh
    } catch (err) {
      console.error("Error saving history:", err);
    }
  };

  const fetchHistory = async () => {
    if (!auth.currentUser) return;
    setIsLoadingHistory(true);
    try {
      const q = query(
        collection(db, 'reports_history'), 
        where('userId', '==', auth.currentUser.uid),
        orderBy('createdAt', 'desc'),
        firestoreLimit(50)
      );
      const snap = await getDocs(q);
      setHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (isHistoryOpen) fetchHistory();
  }, [isHistoryOpen]);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        const email = auth.currentUser.email || '';
        
        // 1. Fetch Professional (with adoption check)
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
          // Standardize for use in component
          setProfessional({
            ...profData,
            nombre: profData.nombre || profData.n || 'Médico',
            especialidad: profData.especialidad || profData.esp || '',
            mp: profData.mp || profData.m || '',
            headerGeneral: profData.headerGeneral || Array(8).fill(''),
            headerFibro: profData.headerFibro || Array(8).fill(''),
          });
        }

        // 2. Fetch Practices from Firestore
        const practicesRef = collection(db, 'practices');
        const practicesSnap = await getDocs(practicesRef);
        const list = practicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDbPractices(list);

        // 3. Fetch System Config
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

      // Preserve formatting by converting newlines to HTML paragraphs for Quill
      if (bodyText && !bodyText.includes('<p>')) {
        bodyText = bodyText.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '<p><br></p>').join('');
      }
      
      setContent(bodyText);
    }
  };

  const generatePDF = (shouldPrint = false) => {
    if (!reportData.patient || !reportData.socialWork || !reportData.date) {
      alert('Por favor complete los campos obligatorios: Paciente, Obra Social y Fecha.');
      return;
    }

    setIsGenerating(true);
    const doc = new jsPDF();
    const prof = professional || {};
    const pageWidth = doc.internal.pageSize.width;
    
    // Select Header
    const isFibro = (selectedPractice || '').toLowerCase().includes('rinofaringolaringofibroscopia');
    const activeHeader = isFibro ? (prof.headerFibro || []) : (prof.headerGeneral || []);
    const hasCustomHeader = activeHeader.some(l => l && l.trim() !== '');

    // 1. Logo (Top Left Corner)
    const logoUrl = "/coat_logo.png";
    try {
      doc.addImage(logoUrl, 'PNG', 10, 8, 30, 20); // Top-left position
    } catch (e) {
      console.error("Logo error:", e);
    }

    // 2. Header Text (To the right of the logo, centered in the remaining space)
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
        headerY += (fontSize / 2.8) + 0.8; // Dynamic spacing based on font size
      } else {
        headerY += 4.5; // Fixed space for empty lines
      }
    });

    let currentY = Math.max(headerY + 5, 55); 
    doc.setDrawColor(200);
    doc.line(10, currentY - 5, 200, currentY - 5);

    // Patients Data (10pt Arial/Helvetica) - Condensed 2 lines
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    
    // Line 1: Patient Info
    const pInfo = [];
    if (reportData.patient) pInfo.push(`PACIENTE: ${reportData.patient.toUpperCase()}`);
    if (reportData.socialWork) pInfo.push(`OBRA SOCIAL: ${reportData.socialWork.toUpperCase()}`);
    if (reportData.dni) pInfo.push(`DNI: ${reportData.dni}`);
    doc.text(pInfo.join('  |  '), 10, currentY);
    currentY += 6;

    // Line 2: Clinical Info
    const cInfo = [];
    cInfo.push(`FECHA: ${new Date(reportData.date).toLocaleDateString('es-AR')}`);
    if (reportData.requester && reportData.requester.trim()) cInfo.push(`SOLICITANTE: ${reportData.requester.toUpperCase()}`);
    if (reportData.reason && reportData.reason.trim()) cInfo.push(`MOTIVO: ${reportData.reason.toUpperCase()}`);
    doc.text(cInfo.join('  |  '), 10, currentY);
    currentY += 6;

    doc.line(10, currentY, 200, currentY);
    currentY += 10;

    // Report Title (Optional) - BOLD, UNDERLINED, CENTERED - 10pt
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

    // Main Content - 10pt Arial/Helvetica
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    // Convert HTML to Plain Text with improved regex splitting
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

    // 6. Signature Area (3-row centered format)
    currentY = yPos + 15;
    if (prof.signatureBase64) {
      try {
        const sigW = 40;
        const sigH = 15;
        const sigX = 140; 
        doc.addImage(prof.signatureBase64, 'PNG', sigX, currentY, sigW, sigH);
        currentY += sigH + 3;
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
      // Center the text block around the x=160 axis (right side of page)
      doc.text(text, 160, currentY, { align: 'center' });
      currentY += (i === 0 ? 4 : 3.5);
    });

    if (shouldPrint === 'print') {
      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl, '_blank');
      saveToHistory();
    } else if (shouldPrint === 'save') {
      doc.save(`Informe_${reportData.patient.replace(/\s/g, '_')}.pdf`);
      saveToHistory();
    } else if (shouldPrint === 'instance') {
      return doc;
    }
    setIsGenerating(false);
  };

  const handleSendReport = async () => {
    if (!config.appsScriptUrl) {
      alert('Error: No se ha configurado el Webhook de Google Apps Script en Administración.');
      return;
    }
    
    if (!reportData.patient || !selectedPractice) {
      alert('Complete al menos Paciente y Práctica para enviar.');
      return;
    }

    setIsSending(true);
    try {
      const pdfDoc = generatePDF('instance');
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

      const recipientEmails = [config.adminEmail];
      if (reportData.patientEmail) {
        recipientEmails.push(reportData.patientEmail);
      }

      const subject = `COAT Informes - Paciente: ${reportData.patient} - ${selectedPractice}`;
      const body = `
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
          token: config.token, // Security token from Firestore
          pdfBase64,
          recipientEmails,
          subject,
          message: body,
          fileName: `Informe_${reportData.patient.replace(/\s/g, '_')}.pdf`
        })
      });
      saveToHistory();
      alert('¡Informe enviado con éxito!');
    } catch (err) {
      console.error(err);
      alert('Error al enviar el informe. Verifique la conexión.');
    } finally {
      setIsSending(false);
    }
  };

  const filteredHistory = history.filter(h => 
    (h.patient || '').toLowerCase().includes(historySearch.toLowerCase()) ||
    (h.practice || '').toLowerCase().includes(historySearch.toLowerCase())
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center bg-[var(--bg-card)] p-4 rounded-3xl shadow-sm border border-main">
        <div>
          <h1 className="text-xl font-bold text-[var(--text-main)]">Generador de Informes</h1>
          <p className="text-[10px] text-[var(--text-sub)] uppercase tracking-widest font-bold">Herramienta de Diagnóstico Digital</p>
        </div>
        <button 
          onClick={() => setIsHistoryOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--hover-main)] hover:bg-blue-100 dark:hover:bg-blue-900/20 text-blue-600 rounded-xl transition-all font-bold text-sm"
        >
          <History size={18} />
          <span>Ver Historial</span>
        </button>
      </div>
      <section className="card p-8 space-y-8 shadow-xl">
        <div className="flex items-center justify-between border-b border-main pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <FilePlus size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-bold font-outfit">Nuevo Informe Clínico</h2>
              <p className="text-xs text-gray-400">Complete los datos para generar el PDF protocolizado</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] rounded-xl border border-main">
            <Settings2 size={16} className="text-gray-400" />
            <label className="text-[10px] font-bold uppercase cursor-pointer select-none flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={reportData.includeTitle}
                onChange={e => setReportData({...reportData, includeTitle: e.target.checked})}
                className="w-4 h-4 rounded border-main text-blue-600 focus:ring-blue-500"
              />
              Incluir título "Informe de..."
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1 md:col-span-2">
            <label className="text-xs font-bold uppercase opacity-60 flex items-center gap-2">
              <UserIcon size={12} /> Paciente *
            </label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Nombre y Apellido completo"
              value={reportData.patient}
              onChange={e => setReportData({...reportData, patient: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase opacity-60 flex items-center gap-2">
              <Calendar size={12} /> Fecha *
            </label>
            <input 
              type="date" 
              className="input-field"
              value={reportData.date}
              onChange={e => setReportData({...reportData, date: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase opacity-60 flex items-center gap-2">
              <CreditCard size={12} /> Obra Social *
            </label>
            <input 
              type="text" 
              className="input-field"
              placeholder="Ej: OSDE, PAMI..."
              value={reportData.socialWork}
              onChange={setReportData && (e => setReportData({...reportData, socialWork: e.target.value}))}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase opacity-60 flex items-center gap-2">
              <UserIcon size={12} /> DNI (Opcional)
            </label>
            <input 
              type="text" 
              className="input-field"
              placeholder="Sin puntos"
              value={reportData.dni}
              onChange={e => setReportData({...reportData, dni: e.target.value})}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase opacity-60 flex items-center gap-2">
              <UserPlus size={12} /> Solicitante (Opcional)
            </label>
            <input 
              type="text" 
              className="input-field"
              placeholder="Médico que solicita..."
              value={reportData.requester}
              onChange={e => setReportData({...reportData, requester: e.target.value})}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase opacity-60 flex items-center gap-2">
              <Send size={12} /> Email del Paciente (Opcional)
            </label>
            <input 
              type="email" 
              className="input-field"
              placeholder="envio.paciente@ejemplo.com"
              value={reportData.patientEmail}
              onChange={e => setReportData({...reportData, patientEmail: e.target.value})}
            />
          </div>
          
          <div className="space-y-1 md:col-span-3">
            <label className="text-xs font-bold uppercase opacity-60 flex items-center gap-2">
              <Settings2 size={12} /> Motivo de Consulta (Opcional)
            </label>
            <input 
              type="text" 
              className="input-field"
              placeholder="Causa o síntoma principal..."
              value={reportData.reason}
              onChange={e => setReportData({...reportData, reason: e.target.value})}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-bold uppercase opacity-60 text-blue-600">Práctica Realizada</label>
          <select 
            className="input-field appearance-none cursor-pointer font-bold text-lg"
            value={selectedPractice}
            onChange={e => handlePracticeChange(e.target.value)}
          >
            <option value="">Seleccione una práctica...</option>
            {dbPractices.length > 0 ? (
              dbPractices.map(p => <option key={p.id} value={p.n}>{p.n}</option>)
            ) : (
              ['Otomicroscopia', 'Extracción de cuerpo extraño', 'Escision de lesion local de conducto auditivo externo', 'Rinofaringolaringofibroscopia'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))
            )}
          </select>
        </div>

        <div className="md:col-span-3 space-y-2">
          <div className="flex items-center justify-between ml-1 text-sm font-semibold text-[var(--text-main)]">
            <span>RESULTADOS / OBSERVACIONES</span>
            <span className="text-[10px] text-gray-400 font-normal">Soporta formato básico (Negrita, Itálica)</span>
          </div>
          <div className="bg-[var(--bg-page)] rounded-2xl overflow-hidden border border-main min-h-[300px]">
            <ReactQuill 
              theme="snow"
              value={content}
              onChange={setContent}
              modules={{
                toolbar: [
                  [{ 'header': [1, 2, 3, false] }],
                  [{ 'size': ['small', false, 'large', 'huge'] }],
                  ['bold', 'italic', 'underline', 'strike'],
                  [{'list': 'ordered'}, {'list': 'bullet'}],
                  ['clean']
                ],
              }}
              className="quill-editor-custom"
            />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-end gap-3 pt-6 border-t border-main">
            <button 
              className="group flex-1 flex flex-col items-center gap-3 p-6 rounded-3xl bg-[var(--bg-secondary)] border border-main hover:border-blue-500/50 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-all active:scale-95"
              onClick={() => generatePDF('print')}
            >
              <div className="w-14 h-14 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Printer size={28} />
              </div>
              <div className="text-center">
                <span className="block font-bold text-[var(--text-main)]">Imprimir</span>
                <span className="text-[10px] text-[var(--text-sub)]">Vista previa y PDF</span>
              </div>
            </button>

            <button 
              className="group flex-1 flex flex-col items-center gap-3 p-6 rounded-3xl bg-[var(--bg-secondary)] border border-main hover:border-emerald-500/50 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/10 transition-all active:scale-95"
              onClick={() => generatePDF('save')}
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                <CheckCircle size={28} />
              </div>
              <div className="text-center">
                <span className="block font-bold text-[var(--text-main)]">Guardar</span>
                <span className="text-[10px] text-[var(--text-sub)]">Descargar archivo</span>
              </div>
            </button>
          
          <button 
            onClick={handleSendReport}
            className="btn-primary flex items-center justify-center gap-2 px-10 py-4 shadow-lg shadow-blue-500/30 flex-1 md:flex-none"
            disabled={isGenerating || isSending || !reportData.patient || !reportData.socialWork || !selectedPractice}
          >
            {isSending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {isSending ? 'Enviando...' : 'Enviar Informe'}
          </button>
        </div>
      </section>

      {/* HISTORIAL SLIDE-OVER */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100]"
            />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 w-full max-w-lg bg-[var(--bg-card)] z-[101] shadow-2xl flex flex-col border-l border-main"
              >
                <div className="p-6 border-b border-main flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                      <History size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-[var(--text-main)]">Historial Reciente</h3>
                      <p className="text-[10px] text-[var(--text-sub)] uppercase font-bold">Últimos 50 informes generados</p>
                    </div>
                  </div>
                  <button onClick={() => setIsHistoryOpen(false)} className="p-2 hover:bg-[var(--hover-main)] rounded-full transition-colors text-[var(--text-main)]">
                    <CloseIcon size={24} />
                  </button>
                </div>

                <div className="p-4 bg-[var(--bg-secondary)] border-b border-main">
                  <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-sub)]" size={18} />
                    <input 
                      type="text"
                      placeholder="Buscar por paciente o práctica..."
                      className="w-full pl-10 pr-4 py-3 bg-[var(--bg-card)] rounded-xl border border-main text-sm focus:ring-2 focus:ring-blue-500/50 text-[var(--text-main)] placeholder:text-gray-400"
                      value={historySearch}
                      onChange={e => setHistorySearch(e.target.value)}
                    />
                  </div>
                </div>

              <div className="flex-1 overflow-auto p-4 space-y-3">
                {isLoadingHistory ? (
                  <div className="flex justify-center p-20 opacity-30 animate-pulse">Cargando historial...</div>
                ) : filteredHistory.length === 0 ? (
                  <div className="text-center p-20 opacity-30">No se encontraron informes.</div>
                ) : (
                  filteredHistory.map(item => (
                    <div key={item.id} className="p-4 bg-[var(--bg-secondary)] border border-main rounded-2xl group hover:border-blue-500/50 transition-all cursor-pointer"
                         onClick={() => {
                           setReportData({
                             ...reportData,
                             patient: item.patient,
                             socialWork: item.socialWork,
                             date: item.date,
                           });
                           handlePracticeChange(item.practice);
                           //setContent(item.content); // We can't set full content as we only saved prefix, but we set the metadata
                           setIsHistoryOpen(false);
                         }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[10px] font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-600 px-2 py-0.5 rounded-full">
                          {new Date(item.date).toLocaleDateString('es-AR')}
                        </span>
                        <span className="text-[10px] text-gray-400 font-mono">{item.id.substring(0,6)}</span>
                      </div>
                      <h4 className="font-bold text-sm uppercase group-hover:text-blue-600 transition-colors">{item.patient}</h4>
                      <p className="text-xs text-gray-500 line-clamp-1">{item.practice}</p>
                      <p className="text-[10px] text-gray-400 mt-2 font-medium italic">OS: {item.socialWork}</p>
                    </div>
                  ))
                )}
              </div>
              
                <div className="p-6 bg-[var(--bg-secondary)] border-t border-main">
                  <p className="text-[10px] text-center text-[var(--text-sub)] leading-relaxed">
                    El historial solo almacena metadatos básicos y los primeros 500 caracteres del informe para optimizar espacio.
                  </p>
                </div>
              </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ReportsPage;
