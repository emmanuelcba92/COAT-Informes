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
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';

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

  React.useEffect(() => {
    const fetchData = async () => {
      if (!auth.currentUser) return;
      try {
        // Fetch Professional
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProfessional(docSnap.data());
        }

        // Fetch Practices from Firestore
        const practicesRef = collection(db, 'practices');
        const practicesSnap = await getDocs(practicesRef);
        const list = practicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDbPractices(list);

        // Fetch System Config
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
      if (personal) {
        setContent(typeof personal === 'string' ? personal : (personal.b || ''));
      } else {
        setContent(p.b || '');
      }
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
    const logoToUse = prof.logoUrl || "/coat_logo.png";
    try {
      doc.addImage(logoToUse, 'PNG', 10, 10, 35, 18);
    } catch (e) {
      console.error("Logo error:", e);
    }

    // 2. Letterhead (Centered with Specific Sizes) - Centered horizontally
    let headerY = 18;
    activeHeader.forEach((line, index) => {
      if (line && line.trim() !== '') {
        // Line 1: 11 pts, 2-3: 10 pts, 4-8: 7.5 pts
        let fontSize = 7.5;
        if (index === 0) fontSize = 11;
        else if (index === 1 || index === 2) fontSize = 10;

        doc.setFontSize(fontSize);
        doc.setFont('helvetica', index === 0 ? 'bold' : 'normal'); 
        
        const textWidth = doc.getTextWidth(line.toUpperCase());
        doc.text(line.toUpperCase(), (210 - textWidth) / 2, headerY);
        headerY += (fontSize/2.8) + 1;
      }
    });

    let currentY = Math.max(headerY + 10, 45); 
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
        yPos += 5;
        return;
      }

      const isHeader = line.includes(':') && line.indexOf(':') < 20;
      doc.setFont("helvetica", isHeader ? "bold" : "normal");

      const splitLines = doc.splitTextToSize(line.trim(), 180);
      
      if (yPos + (splitLines.length * 5) > pageHeight - 20) {
        doc.addPage();
        yPos = 20;
      }

      doc.text(splitLines, 10, yPos);
      yPos += (splitLines.length * 5) + 1;
    });

    // Signature Area
    const sigY = pageHeight - 50;
    if (prof.signatureBase64) {
      try {
        doc.addImage(prof.signatureBase64, 'PNG', 150, pageHeight - 60, 40, 20);
      } catch (e) {
        console.error("Error signature:", e);
      }
    }
    doc.line(140, pageHeight - 35, 190, pageHeight - 35);
    doc.setFontSize(9);
    doc.text(`${prof.nombre || ''}`, 150, pageHeight - 30);
    doc.text(`MP ${prof.mp || ''}`, 150, pageHeight - 26);

    if (shouldPrint === 'print') {
      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl, '_blank');
    } else if (shouldPrint === 'save') {
      doc.save(`Informe_${reportData.patient.replace(/\s/g, '_')}.pdf`);
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
      alert('¡Informe enviado con éxito!');
    } catch (err) {
      console.error(err);
      alert('Error al enviar el informe. Verifique la conexión.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
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
    </div>
  );
};

export default ReportsPage;
