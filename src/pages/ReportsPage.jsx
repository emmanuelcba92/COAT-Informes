import React, { useState, useEffect, useMemo } from 'react';
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
import { doc, getDoc, collection, getDocs, addDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { AUDIT_ACTIONS, logAction } from '../services/auditService';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';

const ReportsPage = ({ isSecretaria, userProfile: initialProfile, isDarkMode }) => {
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const [reportData, setReportData] = useState({
    patient: '',
    socialWork: '',
    dni: '',
    date: new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0],
    requester: '',
    reason: '',
    patientEmail: '',
    includeTitle: true,
    customTitle: '',
    enableHeader: true,
    sentToAdmin: false,
    skipEmail: false
  });

  // Patient autocomplete logic
  useEffect(() => {
    const searchPatient = async () => {
      const cleanDni = reportData.dni.trim();
      if (cleanDni.length >= 7 && cleanDni.length <= 9) {
        try {
          const docRef = doc(db, 'patients', cleanDni);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const autoEmail = data.email || data.patientEmail || '';
            setReportData(prev => ({
              ...prev,
              patient: data.name || data.nombre || prev.patient,
              socialWork: data.insurance || data.obraSocial || prev.socialWork,
              patientEmail: autoEmail || prev.patientEmail
            }));
            showToast('✓ Datos de paciente cargados');
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
        } catch (err) {
          console.error("Error searching patient:", err);
        }
      } else {
        setEmailMissingWarning(false);
      }
    };
    const timer = setTimeout(searchPatient, 600);
    return () => clearTimeout(timer);
  }, [reportData.dni]);

  const savePatientToHistory = async () => {
    const cleanDni = reportData.dni.toString().replace(/\D/g, '');
    if (!cleanDni || cleanDni.length < 7) return;
    try {
      const patientRef = doc(db, 'patients', cleanDni);
      const patientName = reportData.patient.trim();
      const insuranceName = reportData.socialWork.trim();
      
      const payload = {
        name: patientName,
        nombre: patientName,
        dni: cleanDni,
        insurance: insuranceName,
        obraSocial: insuranceName,
        professionalIds: arrayUnion(professional?.id || professional?.uid || auth.currentUser.uid),
        lastUpdated: new Date().toISOString()
      };
      // Only update email if user has entered one — never overwrite with empty
      if (reportData.patientEmail.trim()) {
        payload.email = reportData.patientEmail.trim();
      }
      await setDoc(patientRef, payload, { merge: true });
    } catch (err) {
      console.error("Error saving patient to history:", err);
    }
  };
  
  const [selectedPractice, setSelectedPractice] = useState('');
  const [content, setContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [config, setConfig] = useState({ adminEmail: '', appsScriptUrl: '', token: '' });
  const [professional, setProfessional] = useState(initialProfile || null);
  const [dbPractices, setDbPractices] = useState([]);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [reportRequiredFields, setReportRequiredFields] = useState({
    reportRequiredPatient:    true,
    reportRequiredDate:       true,
    reportRequiredSocialWork: true,
    reportRequiredDni:        false,
    reportRequiredRequester:  false,
    reportRequiredReason:     false,
    reportRequiredEmail:      false,
  });
  const [emailAutoFilledToast, setEmailAutoFilledToast] = useState(false);
  const [emailMissingWarning, setEmailMissingWarning] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const editId = new URLSearchParams(location.search).get('edit');
  const printFlag = new URLSearchParams(location.search).get('print');
  const previewFlag = new URLSearchParams(location.search).get('preview');
  const [isEditing, setIsEditing] = useState(false);
  const [localReportId, setLocalReportId] = useState(editId || null);
  const isSavingRef = React.useRef(false);

  // Filtrado de modelos según especialidad/rol
  const filteredPractices = useMemo(() => {
    if (!dbPractices) return [];
    
    const userRole = (professional?.role || '').toLowerCase().trim();
    
    // Admin y Directora Médica ven todo para facilitar gestión y pruebas
    if (userRole === 'admin' || userRole === 'directora_medica') {
      return [...dbPractices].sort((a, b) => (a.n || '').localeCompare(b.n || ''));
    }
    
    const filtered = dbPractices.filter(p => {
      // Si el modelo no tiene roles definidos (legacy), se muestra a todos para no romper nada
      if (!p.allowedRoles || p.allowedRoles.length === 0) return true;
      
      // Solo si el rol del profesional está incluido en los permitidos para este modelo
      return p.allowedRoles.includes(userRole);
    });

    return [...filtered].sort((a, b) => (a.n || '').localeCompare(b.n || ''));
  }, [dbPractices, professional?.role]);
  
  // Sistema de Notificaciones Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  // Guardar en el historial corregido para manejar EDICIÓN
  const saveToHistory = async (pdfUrl = null, shouldNavigate = false) => {
    if (!auth.currentUser || !reportData.patient) return;
    if (isSecretaria && localReportId) {
      showToast('Las secretarias no pueden editar informes existentes.', 'error');
      return;
    }
    try {
      const data = {
        profesionalId: localReportId ? (professional?.id || professional?.uid || auth.currentUser.uid) : auth.currentUser.uid,
        profesionalNombre: professional?.nombre || professional?.n || 'Médico',
        pacienteNombre: reportData.patient,
        pacienteDni: reportData.dni || '',
        obraSocial: reportData.socialWork,
        fecha: reportData.date,
        practicaNombre: selectedPractice,
        tipoReporte: selectedPractice.toLowerCase().includes('fibro') ? 'fibro' : 'clinico',
        contenidoTexto: content,
        requester: reportData.requester || '',
        reason: reportData.reason || '',
        patientEmail: reportData.patientEmail || '',
        includeTitle: reportData.includeTitle,
        enableHeader: reportData.enableHeader,
        sentToAdmin: reportData.sentToAdmin,
        skipEmail: reportData.skipEmail || false,
        pdfUrl: pdfUrl,
        fechaUpdatedAt: new Date().toISOString()
      };

      if (!localReportId) {
        if (isSavingRef.current) return;
        isSavingRef.current = true;
        try {
          data.fechaCreatedAt = new Date().toISOString();
          const docRef = await addDoc(collection(db, 'reports'), data);
          setLocalReportId(docRef.id);

          // LOG AUDIT
          await logAction(
            AUDIT_ACTIONS.CREATE_REPORT,
            docRef.id,
            `Nuevo informe: ${data.pacienteNombre} (${data.practicaNombre})`
          );
        } finally {
          isSavingRef.current = false;
        }
      } else {
        const { setDoc, doc: fireDoc } = await import('firebase/firestore');
        await setDoc(fireDoc(db, 'reports', localReportId), data, { merge: true });

        // LOG AUDIT
        await logAction(
          AUDIT_ACTIONS.EDIT_REPORT,
          localReportId,
          `Informe editado: ${data.pacienteNombre} (${data.practicaNombre})`
        );

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
        // Carga paralela de Prácticas y Configuración
        const [practicesSnap, configSnap] = await Promise.all([
          getDocs(collection(db, 'practices')),
          getDoc(doc(db, 'config', 'settings'))
        ]);

        const list = practicesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setDbPractices(list);

        if (configSnap.exists()) {
          const cfgData = configSnap.data();
          setConfig(cfgData);
          // Load report required fields from config
          setReportRequiredFields({
            reportRequiredPatient:    cfgData.reportRequiredPatient    !== false ? true  : false,
            reportRequiredDate:       cfgData.reportRequiredDate       !== false ? true  : false,
            reportRequiredSocialWork: cfgData.reportRequiredSocialWork !== false ? true  : false,
            reportRequiredDni:        cfgData.reportRequiredDni        === true,
            reportRequiredRequester:  cfgData.reportRequiredRequester  === true,
            reportRequiredReason:     cfgData.reportRequiredReason     === true,
            reportRequiredEmail:      cfgData.reportRequiredEmail      === true,
          });
        }

        // Si no tenemos el perfil por props (caso raro), lo buscamos
        if (!professional) {
          const docSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
          if (docSnap.exists()) {
            const profData = docSnap.data();
            setProfessional({
              ...profData,
              nombre: profData.nombre || profData.n || 'Médico',
              especialidad: profData.especialidad || profData.esp || '',
              mp: profData.mp || profData.m || '',
              hasLetterhead: profData.hasLetterhead === true,
              headerGeneral: profData.headerGeneral || Array(8).fill(''),
              headerFibro: profData.headerFibro || Array(8).fill(''),
            });
          }
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      }
    };
    fetchData();
  }, [auth.currentUser, professional]);

  // Lógica para CARGAR el informe si estamos editando
  useEffect(() => {
    const loadReportToEdit = async () => {
      if (editId) {
        if (isSecretaria && !isPreview) {
          showToast('Permisos insuficientes para editar informes.', 'error');
          navigate('/reports/history');
          return;
        }
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
              customTitle: data.customTitle || '',
              enableHeader: data.enableHeader || false,
              sentToAdmin: data.sentToAdmin || false,
              skipEmail: data.skipEmail || false
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
                    nombre: profData.nombre || profData.n || 'Profesional',
                    especialidad: profData.especialidad || profData.esp || '',
                    mp: profData.mp || profData.m || '',
                    hasLetterhead: profData.hasLetterhead === true,
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
    const r = reportRequiredFields;
    if (r.reportRequiredPatient    && !reportData.patient.trim())    { showToast('El campo Paciente es obligatorio.', 'error');    return null; }
    if (r.reportRequiredDate       && !reportData.date)              { showToast('El campo Fecha es obligatorio.', 'error');       return null; }
    if (r.reportRequiredSocialWork && !reportData.socialWork.trim()) { showToast('El campo Obra Social es obligatorio.', 'error'); return null; }
    if (r.reportRequiredDni        && !reportData.dni.trim())        { showToast('El campo DNI es obligatorio.', 'error');         return null; }
    if (r.reportRequiredRequester  && !reportData.requester.trim())  { showToast('El campo Solicitante es obligatorio.', 'error'); return null; }
    if (r.reportRequiredReason     && !reportData.reason.trim())     { showToast('El campo Motivo es obligatorio.', 'error');      return null; }
    if (r.reportRequiredEmail      && !reportData.patientEmail.trim()){ showToast('El campo Email es obligatorio.', 'error');     return null; }

    await savePatientToHistory();
    setIsGenerating(true);
    // 0. Preparation
    const doc = new jsPDF({ compress: true });
    
    // Helper to clean HTML for PDF
    const cleanHtmlForPDF = (html) => {
      if (!html) return "";
      // Handle empty paragraphs from Quill properly
      let text = html.replace(/<p><br\s*\/?><\/p>/gi, '\n');
      text = text.replace(/<br\s*\/?>/gi, '\n');
      text = text.replace(/<\/p>/gi, '\n');
      text = text.replace(/<p>/gi, '');
      const tempDoc = new DOMParser().parseFromString(text, 'text/html');
      return (tempDoc.body.textContent || "").trimEnd();
    };
    const prof = professional || {};
    const pageWidth = doc.internal.pageSize.width;
    
    // Select Header
    const isFibro = (selectedPractice || '').toLowerCase().includes('rinofaringolaringofibroscopia');
    
    // hasCustomHeader: Habilitado si el admin dio permiso O si el rol es directora_medica
    const hasCustomHeader = prof.hasLetterhead === true || prof.role === 'directora_medica';
    
    // Forzamos que activeHeader sea un Array real, incluso si Firestore devuelve un Objeto
    let rawHeader = isFibro ? (prof.headerFibro || []) : (prof.headerGeneral || []);
    let activeHeader = Array.isArray(rawHeader) ? rawHeader : Object.values(rawHeader);
    
    // Rellenamos hasta 8 por seguridad
    while(activeHeader.length < 8) activeHeader.push('');

    // 1. Logo — ALWAYS
    const logoUrl = "/coat_logo.png";
    try {
      doc.addImage(logoUrl, 'PNG', 8, 8, 35, 16, undefined, 'FAST');
    } catch (e) {
      console.error("Logo error:", e);
    }

    // 2. Header Text
    let headerY = 16;

    if (hasCustomHeader && reportData.enableHeader && activeHeader.some(l => l && l.trim() !== '')) {
      // Custom 8-line header (only for professionals with permission + toggle enabled)
      doc.setTextColor(60, 60, 60);
      activeHeader.forEach((line, index) => {
        const textLine = (line || '').toString().trim();
        if (textLine !== '') {
          let fontSize = 7.5;
          if (index === 0) fontSize = 11;
          else if (index === 1 || index === 2) fontSize = 10;
          
          doc.setFontSize(fontSize);
          doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
          doc.text(textLine.toUpperCase(), 108, headerY, { align: 'center' });
          headerY += (fontSize / 2.8) + 1.5; // Un poco más de aire
        } else if (index < 4) { 
          // Si una de las líneas principales está vacía, dejamos el hueco para mantener estructura
          headerY += 5;
        }
      });
    } else {
      // Default COAT institutional header — always shown when no custom header
      doc.setTextColor(30, 30, 30);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text("CENTRO OTOAUDIOLÓGICO DE ALTA TECNOLOGÍA", 108, 14, { align: 'center' });
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text("NARIZ • GARGANTA • OÍDO", 108, 19, { align: 'center' });
    }

    // 3. Bloque de Datos del Paciente (Compactado)
    let currentY = (hasCustomHeader && reportData.enableHeader && activeHeader.some(l => l && l.trim() !== ''))
      ? Math.max(headerY + 4, 42)
      : 30;

    doc.setDrawColor(200, 200, 200);
    doc.line(15, currentY - 5, 195, currentY - 5); // Línea superior
    
    // Nombre del Paciente (CENTRADOS Y COMPACTOS)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`PACIENTE: ${reportData.patient}`, 105, currentY, { align: 'center' });
    
    // Datos secundarios (Obra Social, DNI, Fecha)
    currentY += 5.5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    const infoParts = [];
    if (reportData.socialWork) infoParts.push(`OBRA SOCIAL: ${reportData.socialWork}`);
    if (reportData.dni) infoParts.push(`DNI: ${reportData.dni}`);
    infoParts.push(`FECHA: ${new Date(reportData.date).toLocaleDateString('es-AR')}`);
    if (reportData.requester) infoParts.push(`SOLICITANTE: ${reportData.requester}`);
    if (reportData.reason) infoParts.push(`MOTIVO: ${reportData.reason}`);

    doc.text(infoParts.join('  |  '), 105, currentY, { align: 'center' });
    
    currentY += 4.5;
    doc.line(15, currentY, 195, currentY); // Línea inferior (Bien cerca de los datos)
    currentY += 6;

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

    // 4. Report Content with Intelligent Font Scaling
    doc.setFont("helvetica", "normal");
    const plainResult = cleanHtmlForPDF(reportData.result || content);
    const pageHeight = doc.internal.pageSize.height;
    
    // Alturas estimadas para la firma (aprox 40-50mm)
    const signatureReservedSpace = 55; 
    const footerReservedSpace = 20;
    
    // Espacio disponible en la primera hoja antes de tener que saltar o reducir letra
    const availableHeightFirstPage = pageHeight - currentY - signatureReservedSpace - footerReservedSpace;
    
    // Probar primero con 11pt
    let fontSize = 11;
    doc.setFontSize(fontSize);
    let contentLines = doc.splitTextToSize(plainResult, 185);
    let lineHeight = 5.2; 
    
    // Si el texto a 11pt supera el espacio disponible para que entre en una sola hoja, bajamos a 10pt
    if (contentLines.length * lineHeight > availableHeightFirstPage) {
      fontSize = 10;
      doc.setFontSize(fontSize);
      contentLines = doc.splitTextToSize(plainResult, 185);
      lineHeight = 4.5; // Altura de línea para 10pt
    }

    contentLines.forEach(line => {
      // Control de salto de página para el TEXTO
      // Dejamos margen para el footer institucional
      if (currentY > pageHeight - 25) {
        doc.addPage();
        currentY = 25;
      }
      doc.text(line, 10, currentY);
      currentY += lineHeight;
    });
    
    // 5. Signature Area - ADAPTATIVA
    // Objetivo: Que no quede abajo del todo si el informe es corto (petición de obras sociales)
    const middlePoint = pageHeight / 2;
    
    // Si el texto terminó muy arriba, forzamos la firma al menos a la mitad de la hoja
    if (currentY < middlePoint - 20) {
      currentY = middlePoint;
    } else {
      currentY += 10; // Un poco de aire después del texto
    }
    
    // Control de seguridad: Si la firma queda muy cerca del borde inferior, saltamos de hoja
    if (currentY > pageHeight - 65) {
        doc.addPage();
        currentY = 40; // Empezamos en un lugar visible en la nueva hoja
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
      prof.nombre || prof.n || (isStaff ? 'Administración' : 'Profesional'),
      isStaff ? '' : (prof.especialidad || prof.esp || 'Especialista'),
      isStaff ? '' : `MP: ${prof.mp || prof.m || '-'}${prof.me && String(prof.me).trim() !== "" ? ` | ME: ${prof.me}` : ''}`
    ].filter(line => line !== '');

    footerLines.forEach((text, i) => {
      // Usamos bold para simular el efecto de sello "Arial Black"
      doc.setFont("helvetica", "bold");
      doc.text(text, 160, currentY, { align: 'center' });
      currentY += (i === 0 ? 3.5 : 3);
    });

    // 10. Footer Institucional (Bottom of page) — ALWAYS shown
    const footerY = pageHeight - 15;
    doc.setDrawColor(30, 58, 138);
    doc.setLineWidth(0.5);
    doc.line(10, footerY - 5, 200, footerY - 5);
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.setFont('helvetica', 'normal');
    doc.text("Urquiza 401 - Alberdi • Córdoba • Tel: (0351) 423-0530 / 423-9428 • WhatsApp: 3543579794", 105, footerY, { align: 'center' });
    doc.text("Email: info@coat.com.ar • Web: www.coat.com.ar", 105, footerY + 3.5, { align: 'center' });

    if (mode === 'print') {
      const pdfUrl = doc.output('bloburl');
      window.open(pdfUrl, '_blank');
      saveToHistory(null, false);
    } else if (mode === 'save') {
      const fileName = `Informe_${reportData.patient.replace(/\s/g, '_')}.pdf`;
      doc.save(fileName);

      // Si el botón de envío está desactivado globalmente, enviamos la copia a administración automáticamente al guardar
      if (config.showSendButton === false && config.appsScriptUrl) {
        console.log("Auto-sending admin copy since manual button is hidden...");
        try {
          const pdfBase64 = doc.output('datauristring').split(',')[1];
          fetch(config.appsScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: config.token,
              action: 'sendAdminCopy',
              adminEmail: config.adminEmail,
              professionalName: professional?.nombre || 'Profesional',
              patientName: reportData.patient,
              pdfBase64: pdfBase64,
              fileName: fileName
            })
          }).catch(e => console.error("Error auto-sending admin copy:", e));
        } catch (err) {
          console.error("Failed to prepare auto-send:", err);
        }
      }
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
    
    await savePatientToHistory();
    setIsSending(true);
    
    if (reportData.patientEmail && (!reportData.patientEmail.includes('@') || !reportData.patientEmail.includes('.'))) {
      showToast('Por favor ingrese un email de paciente válido o déjelo en blanco.', 'error');
      return;
    }

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

      const emailBody = `
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

      let folderIdToSend = config.autoSaveToDrive ? config.driveFolderId : null;

      // Envío a Administración
      if (config.adminEmail) {
        try {
          await fetch(config.appsScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
              token: config.token,
              pdfBase64,
              recipientEmails: [config.adminEmail],
              subject: `Informe Médico: ${reportData.patient}`,
              message: emailBody,
              fileName: `${reportData.patient.replace(/\s/g, '_')}.pdf`,
              folderId: folderIdToSend,
              dni: reportData.dni
            })
          });
          folderIdToSend = null; // Consumido con éxito
        } catch (e) {
          console.warn("Error enviando copia admin:", e);
        }
      }

      // Envío al Paciente (si tiene email y no se marcó "skipEmail")
      if (reportData.patientEmail && !reportData.skipEmail) {
        try {
          await fetch(config.appsScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
              token: config.token,
              pdfBase64,
              recipientEmails: [reportData.patientEmail],
              subject: subjectPaciente,
              message: emailBody,
              fileName: `${reportData.patient.replace(/\s/g, '_')}.pdf`,
              folderId: folderIdToSend,
              dni: reportData.dni
            })
          });
          folderIdToSend = null; // Consumido con éxito
        } catch (e) {
          console.warn("Error enviando al paciente:", e);
        }
      }

      // Backup a Drive solo (si no se envió antes con éxito)
      if (folderIdToSend) {
        try {
          await fetch(config.appsScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
              token: config.token,
              pdfBase64,
              fileName: `${reportData.patient.replace(/\s/g, '_')}.pdf`,
              folderId: folderIdToSend,
              dni: reportData.dni
            })
          });
        } catch (e) {
          console.warn("Error backup Drive:", e);
        }
      }
      
      // Actualizamos el estado para que saveToHistory sepa que ya se envió a admin
      const updatedReportData = { ...reportData, sentToAdmin: true };
      setReportData(updatedReportData);
      
      // Guardamos en el historial con el nuevo flag
      await saveToHistory(null, false);
      
      // Auditoría
      await logAction(
        AUDIT_ACTIONS.SEND_REPORT,
        reportData.patient.replace(/\s/g, '_'),
        `Informe enviado: ${reportData.patient} (${displayTitle})`,
        { 
          sentToAdmin: !!config.adminEmail,
          sentToPatient: (reportData.patientEmail && !reportData.skipEmail),
          skipPatient: !!reportData.skipEmail
        }
      );

      showToast('¡Informe enviado con éxito!');
    } catch (err) {
      console.error("Error en handleSendReport:", err);
      showToast('Error al procesar el envío.', 'error');
    } finally {
      setIsSending(false);
      setIsGenerating(false);
    }
  };
  // Auxiliar para formatear fechas en el mail
  const formatDateForEmail = (date) => {
    if (!date) return '';
    const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
          fileName: `Informe_${reportData.patient.replace(/\s/g, '_')}.pdf`,
          dni: reportData.dni,
          folderId: config.autoSaveToDrive ? config.driveFolderId : null
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
      <div className="fixed inset-0 z-[9999] bg-[var(--bg-page)] flex flex-col">
        {/* Header de la Vista Previa exclusiva */}
        <div className="h-16 bg-[var(--bg-secondary)] border-b border-main flex items-center justify-between px-6 shadow-sm shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-black tracking-tight text-[var(--text-main)]">Vista Previa</h2>
            <div className="h-6 w-[1px] bg-[var(--border-main)]"></div>
            <p className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-widest">{reportData.patient}</p>
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

        <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-[var(--bg-secondary)]">
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

            {(professional?.hasLetterhead === true || professional?.role === 'directora_medica') && (
              <div 
                className={`
                  flex items-center gap-3 px-4 py-2 rounded-2xl border transition-all duration-300 cursor-pointer
                  ${reportData.enableHeader 
                    ? 'bg-blue-600/10 border-blue-500/50 shadow-lg shadow-blue-500/5' 
                    : 'bg-slate-100 dark:bg-slate-800/50 border-transparent'}
                `}
                onClick={() => setReportData({ ...reportData, enableHeader: !reportData.enableHeader })}
              >
                <div className="text-right select-none">
                  <p className={`text-[10px] font-black uppercase leading-none mb-0.5 ${reportData.enableHeader ? 'text-blue-600' : 'text-slate-400'}`}>
                    Membrete
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 opacity-60 leading-tight">Personalizado</p>
                </div>
                <div 
                  className={`
                    relative w-12 h-6 rounded-full transition-all duration-500 
                    ${reportData.enableHeader ? 'bg-blue-600 shadow-inner' : 'bg-slate-300 dark:bg-slate-700 shadow-inner'}
                  `}
                >
                  <div className={`
                    absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-md transition-all duration-500 flex items-center justify-center
                    ${reportData.enableHeader ? 'translate-x-6' : 'translate-x-0'}
                  `}>
                    {reportData.enableHeader && <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Row 1: DNI (buscar paciente) + Paciente */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">
                DNI {reportRequiredFields.reportRequiredDni ? '*' : '(Opcional)'}
              </label>
              <input
                type="text"
                inputMode="numeric"
                className="input-field"
                placeholder="Solo números - buscar paciente"
                value={reportData.dni}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '');
                  setReportData(prev => ({ ...prev, dni: val }));
                }}
              />
            </div>
            <div className="space-y-1 md:col-span-2">
              <label className="text-xs font-bold uppercase opacity-60">
                Paciente {reportRequiredFields.reportRequiredPatient ? '*' : '(Opc)'}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Nombre y Apellido completo"
                value={reportData.patient}
                onChange={e => {
                  const val = e.target.value;
                  setReportData(prev => ({ ...prev, patient: val }));
                }}
              />
            </div>
          </div>

          {/* Row 2: Fecha + Obra Social + Solicitante */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">
                Fecha {reportRequiredFields.reportRequiredDate ? '*' : '(Opc)'}
              </label>
              <input
                type="date"
                className="input-field"
                value={reportData.date}
                onChange={e => {
                  const val = e.target.value;
                  setReportData(prev => ({ ...prev, date: val }));
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">
                Obra Social {reportRequiredFields.reportRequiredSocialWork ? '*' : '(Opc)'}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder=""
                value={reportData.socialWork}
                onChange={e => {
                  const val = e.target.value;
                  setReportData(prev => ({ ...prev, socialWork: val }));
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">
                Solicitante {reportRequiredFields.reportRequiredRequester ? '*' : '(Opc)'}
              </label>
              <input
                type="text"
                className="input-field"
                placeholder="Médico que solicita..."
                value={reportData.requester}
                onChange={e => {
                  const val = e.target.value;
                  setReportData(prev => ({ ...prev, requester: val }));
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">
                Motivo / Descripción {reportRequiredFields.reportRequiredReason ? '*' : '(Opc)'}
              </label>
              <input 
                type="text" 
                className="input-field"
                placeholder=""
                value={reportData.reason}
                onChange={e => {
                  const val = e.target.value;
                  setReportData(prev => ({ ...prev, reason: val }));
                }}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase opacity-60">
                Email Paciente {reportRequiredFields.reportRequiredEmail ? '*' : '(Opc)'}
              </label>
              <input
                type="email"
                className={`input-field ${reportData.patientEmail && !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reportData.patientEmail)) ? 'input-error' : ''}`}
                placeholder={reportRequiredFields.reportRequiredEmail ? '' : 'Email...'}
                value={reportData.patientEmail}
                onChange={e => {
                  const val = e.target.value;
                  setReportData(prev => ({ ...prev, patientEmail: val }));
                }}
              />
              
              {/* No enviar al paciente Toggle - ESTILO COAT */}
              {config.showPrivacyToggle !== false && (
                <div 
                  className={`
                    flex items-center justify-between px-6 py-5 mt-4 rounded-3xl border-2 transition-all duration-300 cursor-pointer
                    ${reportData.skipEmail ? 'shadow-lg shadow-blue-500/5' : 'hover:shadow-md'}
                  `}
                  style={{ 
                    backgroundColor: reportData.skipEmail 
                      ? (isDarkMode ? 'rgba(30, 58, 138, 0.3)' : '#eff6ff') 
                      : 'var(--bg-card)',
                    borderColor: reportData.skipEmail ? '#2563eb' : 'var(--border-main)'
                  }}
                  onClick={() => setReportData(prev => ({ ...prev, skipEmail: !prev.skipEmail }))}
                >
                  <div className="flex items-center gap-4">
                    <div className={`
                      w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300
                      ${reportData.skipEmail ? 'bg-blue-600 text-white shadow-lg' : 'bg-[var(--bg-secondary)] text-blue-500 border border-main'}
                    `}>
                      <div className="relative">
                        <Send size={24} className={reportData.skipEmail ? 'opacity-30' : ''} />
                        {reportData.skipEmail && <X size={20} className="absolute inset-0 m-auto text-white font-black" />}
                      </div>
                    </div>
                    <div className="select-none text-left">
                      <p className="text-lg font-black uppercase tracking-tight leading-none text-[var(--text-main)]">
                        {reportData.skipEmail ? 'PRIVACIDAD ACTIVADA' : 'NO ENVIAR AL PACIENTE'}
                      </p>
                      <p className="text-[11px] font-bold leading-tight mt-1.5 uppercase opacity-70 text-[var(--text-sub)]">
                        {reportData.skipEmail ? 'El reporte NO llegará a su casilla' : 'Habilitar para evitar el envío automático'}
                      </p>
                    </div>
                  </div>

                <div 
                  className={`
                    relative w-16 h-8 rounded-full transition-all duration-500 border-2
                    ${reportData.skipEmail ? 'bg-blue-600 border-blue-700' : 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600'}
                  `}
                >
                  <div className={`
                    absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-500 flex items-center justify-center
                    ${reportData.skipEmail ? 'translate-x-8' : 'translate-x-0'}
                  `}>
                    {reportData.skipEmail && <div className="w-2.5 h-2.5 bg-blue-600 rounded-full animate-pulse" />}
                  </div>
                </div>
              </div>
            )}

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
            </div>
          </div>


          <div className="space-y-1">
            <label className="text-xs font-bold uppercase opacity-60 text-blue-600">Informe / Modelo</label>
            <select 
              className="input-field appearance-none cursor-pointer font-bold text-lg text-[var(--text-main)] bg-[var(--bg-secondary)]"
              value={selectedPractice}
              onChange={e => handlePracticeChange(e.target.value)}
            >
              <option value="" className="bg-[var(--bg-card)]">Seleccione un modelo de informe...</option>
              {filteredPractices.map(p => <option key={p.id} value={p.n} className="bg-[var(--bg-card)] text-[var(--text-main)]">{p.n}</option>)}
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
                placeholder=""
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
                modules={{
                  toolbar: [
                    [{ 'header': [1, 2, 3, false] }, { 'size': ['small', false, 'large', 'huge'] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                    [{ 'color': [] }, { 'background': [] }],
                    ['clean']
                  ],
                }}
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
            
              {config.showSendButton !== false && (
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
              )}
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
            className="fixed inset-0 z-[100] bg-[var(--bg-page)] flex flex-col"
          >
            {/* Overlay Header */}
            <div className="h-16 bg-[var(--bg-secondary)] border-b border-main flex items-center justify-between px-6 shadow-sm shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-black tracking-tight text-[var(--text-main)]">Vista Previa</h2>
                <div className="h-6 w-[1px] bg-[var(--border-main)]"></div>
                <p className="text-xs font-bold text-[var(--text-sub)] uppercase tracking-widest">{reportData.patient}</p>
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
