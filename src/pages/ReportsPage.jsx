import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { 
  FileText,
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
  Settings,
  Download,
  X
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
    includeTitle: true,
    customTitle: ''
  });
  
  const [selectedPractice, setSelectedPractice] = useState('');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [config, setConfig] = useState({ adminEmail: '', appsScriptUrl: '', token: '' });
  const [professional, setProfessional] = useState(null);
  const [dbPractices, setDbPractices] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const editId = new URLSearchParams(location.search).get('edit');
  const printFlag = new URLSearchParams(location.search).get('print');
  const previewFlag = new URLSearchParams(location.search).get('preview');
  const [isEditing, setIsEditing] = useState(false);
  
  // Sistema de Notificaciones Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  // Guardar en el historial corregido para manejar EDICIÓN
  const saveToHistory = async (pdfUrl = null, shouldNavigate = false) => {
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
        const { setDoc, doc: fireDoc } = await import('firebase/firestore');
        await setDoc(fireDoc(db, 'reports', editId), data, { merge: true });
        if (shouldNavigate) {
          showToast("¡Informe actualizado correctamente!");
          setTimeout(() => navigate('/history'), 1500);
        }
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
              includeTitle: data.includeTitle !== undefined ? data.includeTitle : true,
              customTitle: data.customTitle || ''
            });
            setSelectedPractice(data.practicaNombre || '');
            setContent(data.contenidoTexto || '');

            // Si el informe fue hecho por otro profesional, cargamos sus datos para la firma/membrete
            if (data.profesionalId) {
              try {
                const profRef = doc(db, 'users', data.profesionalId);
                const profSnap = await getDoc(profRef);
                if (profSnap.exists()) {
                  const profData = profSnap.data();
                  setProfessional({
                    ...profData,
                    nombre: profData.nombre || profData.n || 'Médico',
                    especialidad: profData.especialidad || profData.esp || '',
                    mp: profData.mp || profData.m || '',
                    headerGeneral: profData.headerGeneral || Array(8).fill(''),
                    headerFibro: profData.headerFibro || Array(8).fill(''),
                  });
                }
              } catch (profErr) {
                console.error("Error cargando profesional autor:", profErr);
              }
            }

            // Si viene con flag de preview o print, generamos el preview
            if (previewFlag === 'true' || printFlag === 'true') {
              // Necesitamos esperar a que el estado se asiente y profesional esté cargado
              // El useEffect de profesional se encargará de esto o lo hacemos aquí con un delay si ya está
            }
          }
        } catch (err) {
          console.error("Error cargando informe para editar:", err);
        }
      }
    };
    loadReportToEdit();
  }, [editId]);

  // AUTO-PRINT / PREVIEW Logic
  useEffect(() => {
    // Si ya tenemos previewUrl no hacemos nada
    if (previewUrl) return;

    if ((printFlag === 'true' || previewFlag === 'true') && isEditing) {
      // Damos un pequeño respiro para asegurar que los estados se hayan seteado
      const timer = setTimeout(async () => {
        // Generamos aunque falten cosas, la función generatePDF ya tiene fallbacks
        const blob = await generatePDF('blob');
        if (blob) {
          const url = URL.createObjectURL(blob);
          setPreviewUrl(url);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [printFlag, previewFlag, isEditing, professional, selectedPractice, content, previewUrl]);

  const handlePracticeChange = (practiceName) => {
    setSelectedPractice(practiceName);
    const p = dbPractices.find(item => item.n === practiceName);
    if (p) {
      // Configuramos el título basado en la práctica
      setReportData(prev => ({
        ...prev,
        includeTitle: p.st !== undefined ? p.st : true,
        customTitle: ''
      }));

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

  const generatePDF = async (mode = 'print') => {
    if (!reportData.patient || !reportData.date) {
      showToast('Complete los campos obligatorios: Paciente y Fecha.', 'error');
      return null;
    }

    setIsGenerating(true);
    // 0. Preparation
    const doc = new jsPDF({ compress: true });
    
    // Helper to clean HTML for PDF
    const cleanHtmlForPDF = (html) => {
      if (!html) return "";
      let text = html.replace(/<br\s*\/?>/gi, '\n');
      text = text.replace(/<\/p>/gi, '\n');
      text = text.replace(/<p>/gi, '');
      const tempDoc = new DOMParser().parseFromString(text, 'text/html');
      return tempDoc.body.textContent || "";
    };
    const prof = professional || {};
    const pageWidth = doc.internal.pageSize.width;
    
    // Select Header
    const isFibro = (selectedPractice || '').toLowerCase().includes('rinofaringolaringofibroscopia');
    const activeHeader = isFibro ? (prof.headerFibro || []) : (prof.headerGeneral || []);

    // 1. Logo
    const logoUrl = "/coat_logo.png";
    try {
      doc.addImage(logoUrl, 'PNG', 10, 8, 35, 16, undefined, 'FAST');
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

    let currentY = Math.max(headerY + 5, 45); 
    doc.setDrawColor(200);
    doc.line(10, currentY - 5, 200, currentY - 5);

    // Patients Data (Fixed 2-Line Header)
    doc.setFontSize(9); // Correct size for readability and fit
    doc.setFont("helvetica", "normal");
    
    // Line 1: PACIENTE (Centered)
    doc.setFont("helvetica", "bold");
    const patientText = `PACIENTE: ${reportData.patient.toUpperCase()}`;
    const pWidth = doc.getTextWidth(patientText);
    doc.text(patientText, (pageWidth - pWidth) / 2, currentY);
    
    currentY += 5;

    // Line 2: Other info centered and reflowing (hiding empty fields)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8); // Slightly smaller for the secondary info line
    const infoParts = [];
    if (reportData.socialWork) infoParts.push(`OBRA SOCIAL: ${reportData.socialWork.toUpperCase()}`);
    if (reportData.dni) infoParts.push(`DNI: ${reportData.dni}`);
    infoParts.push(`FECHA: ${new Date(reportData.date).toLocaleDateString('es-AR')}`);
    if (reportData.requester) infoParts.push(`SOLICITANTE: ${reportData.requester.toUpperCase()}`);
    if (reportData.reason) infoParts.push(`MOTIVO: ${reportData.reason.toUpperCase()}`);

    const secondaryInfo = infoParts.join("  |  ");
    const sWidth = doc.getTextWidth(secondaryInfo);
    doc.text(secondaryInfo, (pageWidth - sWidth) / 2, currentY);
    
    currentY += 7;

    doc.line(10, currentY, 200, currentY);
    currentY += 8;

    // Report Title
    let titleToPrint = "";
    if (reportData.includeTitle && selectedPractice) {
      titleToPrint = `INFORME DE ${selectedPractice.toUpperCase()}`;
    } else if (reportData.customTitle) {
      titleToPrint = reportData.customTitle.toUpperCase();
    }

    if (titleToPrint) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const titleWidth = doc.getTextWidth(titleToPrint);
      const centerX = (pageWidth - titleWidth) / 2;
      
      doc.text(titleToPrint, centerX, currentY);
      doc.line(centerX, currentY + 1, centerX + titleWidth, currentY + 1);
      currentY += 10;
    }

    // Main Content
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    
    const plainResult = cleanHtmlForPDF(reportData.result || content);
    const contentLines = doc.splitTextToSize(plainResult, 185);
    const pageHeight = doc.internal.pageSize.height;

    contentLines.forEach(line => {
      // Check for page break (leaving space for signature/footer)
      if (currentY > pageHeight - 50) {
        doc.addPage();
        currentY = 20;
      }
      doc.text(line, 10, currentY);
      currentY += 4.8;
    });
    
    // Signature Area
    currentY += 10;
    if (currentY > pageHeight - 35) {
       doc.addPage();
       currentY = 20;
    }

    if (prof.signatureBase64) {
      try {
        let imageData = prof.signatureBase64;
        
        // Procesar imagen (sea URL o Base64 antigua) para asegurar que esté redimensionada y optimizada
        try {
          imageData = await new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.onload = () => {
              const canvas = document.createElement('canvas');
              const ctx = canvas.getContext('2d');
              // Redimensionar a un tamaño profesional razonable (max 600px de ancho)
              const maxWidth = 600;
              const scale = Math.min(1, maxWidth / img.width);
              canvas.width = img.width * scale;
              canvas.height = img.height * scale;
              ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
              resolve(canvas.toDataURL('image/png', 0.8));
            };
            img.onerror = () => reject(new Error("Error al cargar imagen para redimensionar"));
            
            // Si es una URL de Supabase, la descargamos primero para evitar problemas de CORS/Blobs
            // Pero Image() con crossOrigin suele manejar URLs directas si el bucket tiene CORS configurado.
            // Para mayor seguridad con el flujo de jsPDF, usamos la URL o el Base64 directamente.
            img.src = imageData;
          });
        } catch (err) {
          console.error("Error optimizing signature image:", err);
          // Si falla el redimensionamiento, intentamos usar la original como fallback
        }

        doc.addImage(imageData, 'PNG', 140, currentY, 35, 12, undefined, 'FAST');
        currentY += 15;
      } catch (e) {
        console.error("Error signature:", e);
      }
    } else {
        currentY += 5;
    }
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    
    const isStaff = prof.role === 'admin' || prof.role === 'secre';
    const footerLines = [
      prof.nombre || (isStaff ? 'Administración' : 'Profesional'),
      isStaff ? '' : (prof.especialidad || 'Especialista'),
      isStaff ? '' : `MP: ${prof.mp || '-'} ${prof.me ? ` | ME: ${prof.me}` : ''}`
    ].filter(line => line !== '');

    footerLines.forEach((text, i) => {
      // Usamos bold para simular el efecto de sello "Arial Black"
      doc.setFont("helvetica", "bold");
      doc.text(text, 160, currentY, { align: 'center' });
      currentY += (i === 0 ? 3.5 : 3);
    });

    if (mode === 'print') {
      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl, '_blank');
      saveToHistory(null, false);
    } else if (mode === 'save') {
      doc.save(`Informe_${reportData.patient.replace(/\s/g, '_')}.pdf`);
      saveToHistory(null, true);
    } else if (mode === 'blob') {
      setIsGenerating(false);
      return doc.output('blob');
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
    
    if (reportData.patientEmail && (!reportData.patientEmail.includes('@') || !reportData.patientEmail.includes('.'))) {
      showToast('Por favor ingrese un email de paciente válido o déjelo en blanco.', 'error');
      return;
    }

    setIsSending(true);
    try {
      const pdfDoc = await generatePDF('instance');
      if (!pdfDoc) {
        setIsSending(false);
        return;
      }
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

      const recipientEmails = [config.adminEmail];
      if (reportData.patientEmail) {
        recipientEmails.push(reportData.patientEmail);
      }

      const formatDateForEmail = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}-${m}-${y}`;
      };

      const displayTitle = (reportData.includeTitle 
        ? `INFORME DE ${selectedPractice}` 
        : (reportData.customTitle || selectedPractice)).toUpperCase();

      const subjectPaciente = `COAT Informes - Nuevo estudio disponible: ${reportData.patient}`;
      
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

      const bodyPaciente = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
          <p>Estimado/a <strong>${reportData.patient}</strong>,</p>
          <p>Esperamos que se encuentre bien.</p>
          <p>Le informamos que ya está disponible el nuevo informe correspondiente a su reciente consulta en COAT. Adjunto a este correo encontrará el documento en formato PDF.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Detalles del informe:</strong></p>
            <ul style="list-style: none; padding-left: 0; margin: 10px 0 0 0;">
              <li><strong>Paciente:</strong> ${reportData.patient}</li>
              <li><strong>Estudio/Motivo:</strong> ${displayTitle}</li>
              <li><strong>Fecha:</strong> ${formatDateForEmail(reportData.date)}</li>
              <li><strong>Profesional Responsable:</strong> ${professional?.nombre || 'Dr/a.'}</li>
            </ul>
          </div>

          <p>Si tiene alguna duda respecto al contenido del informe, por favor no dude en contactarse con nosotros o consultarlo en su próxima visita.</p>
          
          <p>Atentamente,<br/><strong>Equipo de COAT.</strong></p>
          
          ${emailFooter}
          
          <p style="font-size: 11px; color: #999; margin-top: 30px;">
            Este es un mensaje automático, por favor no responda a esta dirección de correo.
          </p>
        </div>
      `;

      const bodyAdmin = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #d32f2f;">Copia de Informe - Sistema COAT</h2>
          <p>Se ha generado un nuevo informe técnico.</p>
          <hr/>
          <ul>
            <li><strong>Paciente:</strong> ${reportData.patient}</li>
            <li><strong>DNI:</strong> ${reportData.dni || 'No informado'}</li>
            <li><strong>Estudio:</strong> ${displayTitle}</li>
            <li><strong>Profesional:</strong> ${professional?.nombre || 'Dr/a.'}</li>
          </ul>
        </div>
      `;

      // Preparar ejecuciones en paralelo para no bloquear el UI
      const emailPromises = [];

      // Envío a Administración
      emailPromises.push(
        fetch(config.appsScriptUrl, {
          method: 'POST',
          mode: 'no-cors',
          body: JSON.stringify({
            token: config.token,
            pdfBase64,
            recipientEmails: [config.adminEmail],
            subject: `${reportData.patient} - ${displayTitle}`,
            message: bodyAdmin,
            fileName: `${reportData.patient.replace(/\s/g, '_')}.pdf`
          })
        })
      );

      // Envío al Paciente (si tiene email)
      if (reportData.patientEmail) {
        emailPromises.push(
          fetch(config.appsScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
              token: config.token,
              pdfBase64,
              recipientEmails: [reportData.patientEmail],
              subject: subjectPaciente,
              message: bodyPaciente,
              fileName: `${reportData.patient.replace(/\s/g, '_')}.pdf`
            })
          })
        );
      }

      await Promise.all(emailPromises);
      
      // Guardamos en el historial (sin navegar fuera si estamos enviando)
      await saveToHistory(null, false);
      
      showToast('¡Informe enviado con éxito!');
    } catch (err) {
      console.error("Error en handleSendReport:", err);
      showToast('Error al procesar el envío.', 'error');
    } finally {
      setIsSending(false);
      setIsGenerating(false);
    }
  };
  const handleResendToPatient = async () => {
    if (!reportData.patientEmail) {
      showToast('El informe no cuenta con un email de paciente registrado.', 'error');
      return;
    }

    if (!config.appsScriptUrl) {
      showToast('Webhook de envío no configurado.', 'error');
      return;
    }

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

    const displayTitle = (reportData.includeTitle 
      ? `INFORME DE ${selectedPractice}` 
      : (reportData.customTitle || selectedPractice)).toUpperCase();

    const bodyPaciente = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
        <p>Estimado/a <strong>${reportData.patient}</strong>,</p>
        <p>Esperamos que se encuentre bien.</p>
        <p>Le informamos que ya está disponible el reenvío del informe correspondiente a su consulta en COAT. Adjunto encontrará el documento PDF.</p>
      
      <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <p style="margin: 0;"><strong>Detalles del informe:</strong></p>
        <ul style="list-style: none; padding-left: 0; margin: 10px 0 0 0;">
          <li><strong>Paciente:</strong> ${reportData.patient}</li>
          <li><strong>Estudio/Motivo:</strong> ${displayTitle}</li>
          <li><strong>Fecha:</strong> ${formatDateForEmail(reportData.date)}</li>
        </ul>
      </div>

      <p>Atentamente,<br/><strong>Equipo de COAT.</strong></p>
        ${emailFooter}
        <p style="font-size: 11px; color: #999; margin-top: 30px;">
          Este es un mensaje automático, por favor no responda a esta dirección de correo.
        </p>
      </div>
    `;

    setIsSending(true);
    try {
      const pdfDoc = generatePDF('instance');
      if (!pdfDoc) {
        setIsSending(false);
        return;
      }
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

      await fetch(config.appsScriptUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({
          token: config.token,
          pdfBase64,
          recipientEmails: [reportData.patientEmail],
          subject: `COAT Informes - REENVÍO: ${reportData.patient}`,
          message: bodyPaciente,
          fileName: `Informe_${reportData.patient.replace(/\s/g, '_')}.pdf`
        })
      });

      showToast('Informe reenviado exitosamente al paciente.');
    } catch (err) {
      console.error("Error al reenviar informe:", err);
      showToast('Error al reenviar el informe.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  if (previewFlag === 'true') {
    if (!previewUrl) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-6">
           <div className="relative">
              <div className="absolute inset-0 bg-blue-500 blur-2xl opacity-20 animate-pulse"></div>
              <Loader2 className="animate-spin text-blue-500 relative" size={48} />
           </div>
           <div className="text-center">
              <h2 className="text-2xl font-black uppercase tracking-widest">Generando Vista Previa</h2>
              <p className="text-slate-400 mt-2 font-medium">Buscando datos históricos y renderizando PDF...</p>
           </div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col">
        {/* Header de la Vista Previa exclusiva */}
        <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-black tracking-tight text-slate-800">Vista Previa</h2>
            <div className="h-6 w-[1px] bg-slate-200"></div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{reportData.patient}</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => generatePDF('save')}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
            >
              <Download size={16} />
              Descargar
            </button>
            {reportData.patientEmail && (
              <button 
                disabled={isSending}
                onClick={handleResendToPatient}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
              >
                {isSending ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                Reenviar al Paciente
              </button>
            )}
            <button 
              onClick={() => generatePDF('print')}
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
                navigate('/history');
              }}
              className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95"
            >
              <X size={16} />
              Cerrar
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-slate-800">
          <div className="w-full max-w-5xl h-full bg-white rounded-2xl shadow-2xl overflow-hidden">
            <iframe 
              src={previewUrl}
              className="w-full h-full border-none"
              title="PDF Preview"
            />
          </div>
        </div>
      </div>
    );
  }

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
                inputMode="numeric"
                className="input-field"
                placeholder="Solo números"
                value={reportData.dni}
                onChange={e => setReportData({...reportData, dni: e.target.value.replace(/\D/g, '')})}
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">Motivo / Descripción (Opc)</label>
              <input 
                type="text" 
                className="input-field"
                placeholder="Ej: Control, Derivación..."
                value={reportData.reason}
                onChange={e => setReportData({...reportData, reason: e.target.value})}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">Email Paciente (Opc)</label>
              <input 
                type="email" 
                className={`input-field ${reportData.patientEmail && !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reportData.patientEmail)) ? 'input-error' : ''}`}
                placeholder="Para envío de copia por mail"
                value={reportData.patientEmail}
                onChange={e => setReportData({...reportData, patientEmail: e.target.value})}
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

          {!reportData.includeTitle && selectedPractice && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-1"
            >
              <label className="text-xs font-bold uppercase opacity-60 text-amber-600">Título Personalizado del Informe</label>
              <input 
                type="text" 
                className="input-field border-amber-200 focus:border-amber-400 bg-amber-50/20"
                placeholder="Ej: INFORME DE..."
                value={reportData.customTitle}
                onChange={e => setReportData({...reportData, customTitle: e.target.value})}
              />
            </motion.div>
          )}

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
                onClick={async () => await generatePDF('print')}
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
                onClick={async () => await generatePDF('save')}
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
                className="group flex-1 flex flex-col items-center gap-3 p-6 rounded-3xl bg-blue-600 border border-blue-500 shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 text-white disabled:opacity-50 disabled:scale-100"
                onClick={handleSendReport}
                disabled={isGenerating || isSending || !reportData.patient || !selectedPractice}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/20 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                  {isSending ? <Loader2 size={28} className="animate-spin" /> : <Send size={28} />}
                </div>
                <div className="text-center">
                  <span className="block font-bold">{isSending ? 'Enviando...' : 'Enviar Informe'}</span>
                  <span className="text-[10px] text-white/60">Por email (Clínica + Copia)</span>
                </div>
              </button>
          </div>
        </div>
      )}

      {/* Preview Overlay */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col"
          >
            {/* Overlay Header */}
            <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-black tracking-tight text-slate-800">Vista Previa</h2>
                <div className="h-6 w-[1px] bg-slate-200"></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{reportData.patient}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={async () => await generatePDF('save')}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  <Download size={16} />
                  Descargar
                </button>
                {reportData.patientEmail && (
                  <button 
                    disabled={isSending}
                    onClick={handleResendToPatient}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {isSending ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                    Reenviar al Paciente
                  </button>
                )}
                <button 
                  onClick={async () => await generatePDF('print')}
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
                    if (previewFlag || printFlag) navigate('/history');
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95"
                >
                  <X size={16} />
                  Cerrar
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-slate-800/50">
              <div className="w-full max-w-5xl h-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
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
