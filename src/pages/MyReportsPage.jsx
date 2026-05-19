import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  User, 
  Calendar, 
  FileText, 
  Download, 
  Trash2, 
  Filter,
  RefreshCw,
  Printer,
  ChevronRight,
  ChevronDown,
  ArrowRight,
  Database,
  ArrowLeft,
  Upload,
  X,
  FileUp,
  Loader2,
  Plus,
  CheckCircle2,
  ExternalLink,
  PenLine,
  Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDoc,
  getDocs, 
  deleteDoc, 
  doc, 
  limit,
  startAfter,
  addDoc,
  setDoc,
  arrayUnion 
} from 'firebase/firestore';
import { supabase } from '../services/supabase';
import { db, auth } from '../services/firebase';
import { logAction, AUDIT_ACTIONS } from '../services/auditService';
import { deduplicateProfessionals, normalizeName, formatDisplayName } from '../utils/userNormalization';
import { extractPatientsFromImage } from '../utils/aiService';



const MyReportsPage = ({ user, userProfile, isAdmin, isSecretaria: isSecretariaProp, isSuperSecretaria = false, isDarkMode }) => {
  const navigate = useNavigate();
  
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Helper para fechas en el email
  const formatDateForEmail = (date) => {
    if (!date) return '';
    const d = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };
  const [professionals, setProfessionals] = useState([]);

  // isAdmin is now received as a prop
  const isSecretaria = isSecretariaProp || userProfile?.role?.toLowerCase().includes('secre');
  const canSelectProfessional = isAdmin || isSecretaria || isSuperSecretaria;

  const [selectedProfId, setSelectedProfId] = useState('all');

  // Sync selectedProfId when role is determined
  useEffect(() => {
    if (userProfile) {
      if (canSelectProfessional) {
        setSelectedProfId('all');
      } else {
        setSelectedProfId(user.uid);
      }
    }
  }, [userProfile, canSelectProfessional, user.uid]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 15;

  // Sistema de Notificaciones Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [deleteModal, setDeleteModal] = useState({ show: false, report: null });
  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };
  
  // Upload State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadData, setUploadData] = useState({
    file: null,
    patientName: '',
    patientDni: '',
    socialWork: '',
    requester: '',
    reason: '',
    patientEmail: '',
    profId: canSelectProfessional ? '' : user.uid,
    date: new Date().toLocaleDateString('en-CA')
  });
  const [config, setConfig] = useState({ adminEmail: '', appsScriptUrl: '', token: '' });
  const [emailAutoFilledToast, setEmailAutoFilledToast] = useState(false);
  const [emailMissingWarning, setEmailMissingWarning] = useState(false);
  const [isPasting, setIsPasting] = useState(false);

  // Autocompletado de Paciente por DNI
  useEffect(() => {
    const searchPatient = async () => {
      const cleanDni = uploadData.patientDni.trim();
      if (cleanDni.length >= 7 && cleanDni.length <= 9) {
        try {
          const docRef = doc(db, 'patients', cleanDni);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            const autoEmail = data.email || data.patientEmail || '';
            setUploadData(prev => ({
              ...prev,
              patientName: data.name || data.nombre || prev.patientName,
              socialWork: data.insurance || data.obraSocial || prev.socialWork,
              patientEmail: autoEmail || prev.patientEmail
            }));
            showToast('✓ Datos de paciente cargados');
            if (!autoEmail) {
              setEmailMissingWarning(true);
              setTimeout(() => setEmailMissingWarning(false), 8000);
            }
          }
        } catch (err) {
          console.error("Error searching patient:", err);
        }
      }
    };
    const timer = setTimeout(searchPatient, 600);
    return () => clearTimeout(timer);
  }, [uploadData.patientDni]);

  const savePatientToHistory = async () => {
    const cleanDni = uploadData.patientDni.toString().replace(/\D/g, '');
    if (!cleanDni || cleanDni.length < 7) return;
    try {
      const patientRef = doc(db, 'patients', cleanDni);
      const patientName = uploadData.patientName.trim().toUpperCase();
      const insuranceName = uploadData.socialWork.trim().toUpperCase();
      
      const payload = {
        name: patientName,
        nombre: patientName,
        dni: cleanDni,
        insurance: insuranceName,
        obraSocial: insuranceName,
        professionalIds: arrayUnion(uploadData.profId || user.uid),
        lastUpdated: new Date().toISOString()
      };
      
      if (uploadData.patientEmail && uploadData.patientEmail.trim()) {
        payload.email = uploadData.patientEmail.trim();
      }
      
      await setDoc(patientRef, payload, { merge: true });
    } catch (err) {
      console.error("Error saving patient to history:", err);
    }
  };

  const handlePaste = async (e) => {
    const items = e.clipboardData.items;
    let imageItem = null;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        imageItem = items[i];
        break;
      }
    }

    if (imageItem) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result.split(',')[1];
        setIsPasting(true);
        showToast('Procesando imagen con IA...', 'info');
        try {
          const results = await extractPatientsFromImage(base64);
          if (results && results.length > 0) {
            const p = results[0];
            setUploadData(prev => ({
              ...prev,
              patientDni: p.dni || prev.patientDni,
              patientName: p.nombre || prev.patientName,
              socialWork: p.obraSocial || prev.socialWork,
              patientEmail: p.email || prev.patientEmail
            }));
            showToast('¡Datos extraídos de la captura!');
          } else {
            showToast('No se detectaron datos en la imagen', 'error');
          }
        } catch (err) {
          console.error("Paste processing error:", err);
          showToast('Error al analizar la imagen', 'error');
        } finally {
          setIsPasting(false);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    const fetchProfs = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        const rawUsers = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        const filtered = deduplicateProfessionals(rawUsers)
          .filter(u => {
            const r = (u.role || u.rol || '').toLowerCase();
            return !['admin', 'secretaria', 'super_secretaria', 'secre', 'secretaría'].includes(r) && (u.nombre || u.n || u.u);
          })
          .map(u => ({
            ...u,
            displayName: formatDisplayName(u.nombre || u.n || u.u)
          }))
          .sort((a, b) => a.displayName.localeCompare(b.displayName));
          
        setProfessionals(filtered);
        
        if (!canSelectProfessional) {
          const profId = user.uid;
          setSelectedProfId(profId);
          setUploadData(prev => ({ ...prev, profId }));
        } else if (selectedProfId === null) {
          setSelectedProfId('all');
        }
      } catch (err) {
        console.error("Error fetching professionals:", err);
      }
    };
    fetchProfs();

    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'settings'));
        if (snap.exists()) setConfig(snap.data());
      } catch (err) { console.error("Config fetch error:", err); }
    };
    fetchConfig();
  }, [canSelectProfessional, user.uid]);

  useEffect(() => {
    // Si es médico solo puede cargar los suyos (uid ya seteado en selectedProfId por default)
    // Si es admin/secre puede cargar todos si no hay selection
    fetchReports(selectedProfId, true);
  }, [selectedProfId, canSelectProfessional]);

  const fetchReports = async (profId, reset = false) => {
    setLoading(true);
    if (reset) {
        setReports([]);
        setLastVisible(null);
    }
    
    try {
      let q;
      const constraints = [
        orderBy('fechaCreatedAt', 'desc'),
        limit(PAGE_SIZE)
      ];

      if (reset === false && lastVisible) {
        constraints.splice(1, 0, startAfter(lastVisible));
      }

      if (profId && profId !== 'all') {
        q = query(
          collection(db, 'reports'),
          where('profesionalId', '==', profId),
          ...constraints
        );
      } else if (canSelectProfessional) {
        q = query(
          collection(db, 'reports'),
          ...constraints
        );
      } else {
        setLoading(false);
        return;
      }

      try {
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        if (reset) {
          setReports(list);
        } else {
          setReports(prev => [...prev, ...list]);
        }
        
        setLastVisible(snap.docs[snap.docs.length - 1]);
        setHasMore(list.length === PAGE_SIZE);
      } catch (innerErr) {
        // Fallback si falla por índice faltante
        if (innerErr.message?.includes('index') || innerErr.code === 'failed-precondition') {
          console.warn("Missing index for query. Falling back to date-only fetch.");
          let fallbackQ;
          if (profId && profId !== 'all') {
            fallbackQ = query(collection(db, 'reports'), where('profesionalId', '==', profId), orderBy('fecha', 'desc'), limit(50));
          } else {
            fallbackQ = query(collection(db, 'reports'), orderBy('fecha', 'desc'), limit(50));
          }
          const snap = await getDocs(fallbackQ);
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setReports(list);
          setHasMore(false);
        } else {
          throw innerErr;
        }
      }
    } catch (err) {
      console.error("Error fetching reports:", err);
      showToast("Error al cargar informes técnicos.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.file || !uploadData.patientName || !uploadData.patientDni || !uploadData.profId) {
      showToast('Por favor complete los campos obligatorios: Paciente, DNI y Archivo.', 'error');
      return;
    }

    if (uploadData.patientEmail && (!uploadData.patientEmail.includes('@') || !uploadData.patientEmail.includes('.'))) {
      showToast('Por favor ingrese un email válido o deje el campo en blanco.', 'error');
      return;
    }

    setIsUploading(true);
    try {
      await savePatientToHistory();
      
      let downloadURL = '';
      let filePath = '';
      
      try {
        // Limpiar nombre de archivo (quitar eñes, acentos, espacios y caracteres raros)
        const cleanFileName = uploadData.file.name
          .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
          .replace(/ñ/g, "n").replace(/Ñ/g, "N")            // Quitar eñes
          .replace(/[^a-zA-Z0-9._-]/g, "_");               // Todo lo demás a guión bajo

        const fileName = `${Date.now()}_${cleanFileName}`;
        filePath = `${uploadData.profId}/${fileName}`;
        
        const { data, error: uploadError } = await supabase.storage
          .from('informescoat')
          .upload(filePath, uploadData.file);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('informescoat')
          .getPublicUrl(filePath);
          
        downloadURL = publicUrl;
        // ---------------------------------
      } catch (storageErr) {
        console.error("Error en Supabase Storage:", storageErr);
        throw new Error(`Error de Supabase: ${storageErr.message || storageErr.error_description || 'Error desconocido'}`);
      }

      // 2. Get Professional Name
      const selectedProf = professionals.find(p => p.id === uploadData.profId);

      // 3. Save to Firestore
      const reportSaveData = {
        profesionalId: uploadData.profId,
        profesionalNombre: selectedProf?.displayName || 'Externo',
        pacienteNombre: uploadData.patientName.toUpperCase(),
        pacienteDni: uploadData.patientDni || '',
        obraSocial: uploadData.socialWork.toUpperCase(),
        fecha: uploadData.date,
        fechaCreatedAt: new Date().toISOString(),
        pdfUrl: downloadURL,
        storagePath: filePath,
        tipoReporte: 'externo',
        practicaNombre: uploadData.reason.toUpperCase() || 'INFORME EXTERNO',
        requester: uploadData.requester || '',
        reason: uploadData.reason || '',
        patientEmail: uploadData.patientEmail || ''
      };

      const docRef = await addDoc(collection(db, 'reports'), reportSaveData);

      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.UPLOAD_EXTERNAL_PDF, 
        docRef.id, 
        `PDF Externo subido: ${uploadData.patientName.toUpperCase()} (${uploadData.reason.toUpperCase() || 'INFORME EXTERNO'})`
      );

      // 4. Send Email if configured
      if (config.appsScriptUrl && config.token) {
        try {
          // Convert file to base64 for Apps Script
          const base64data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(uploadData.file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
          });

          const formatDateForEmail = (dateStr) => {
            if (!dateStr) return '';
            const [y, m, d] = dateStr.split('-');
            return `${d}-${m}-${y}`;
          };

          const displayTitle = (uploadData.reason || 'Informe Técnico').toUpperCase();
          const subjectPaciente = `COAT Informes - Nuevo estudio disponible: ${uploadData.patientName.toUpperCase()}`;
          
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
              <p>Estimado/a <strong>${uploadData.patientName.toUpperCase()}</strong>,</p>
              <p>Esperamos que se encuentre bien.</p>
              <p>Le informamos que ya está disponible su <strong>informe médico</strong> generado en COAT. Adjunto a este correo encontrará el documento en formato PDF.</p>
              
              <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 0;"><strong>Detalles del informe:</strong></p>
                <ul style="list-style: none; padding-left: 0; margin: 10px 0 0 0;">
                  <li><strong>Paciente:</strong> ${uploadData.patientName.toUpperCase()}</li>
                  <li><strong>Estudio/Prácticas:</strong> ${displayTitle}</li>
                  <li><strong>Fecha:</strong> ${formatDateForEmail(uploadData.date)}</li>
                  <li><strong>Profesional Responsable:</strong> ${selectedProf?.displayName || 'Externo'}</li>
                </ul>
              </div>

              <p>Si tiene alguna duda respecto al contenido del informe, por favor no dude en contactarse con nosotros.</p>
              
              <p>Atentamente,<br/><strong>Equipo de COAT.</strong></p>
              
              ${emailFooter}
              
              <p style="font-size: 11px; color: #999; margin-top: 30px;">
                Este es un mensaje automático, por favor no responda a esta dirección de correo.
              </p>
            </div>
          `;

          const bodyAdmin = `
            <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
              <h2 style="color: #d32f2f;">Carga de Informe externo - COAT</h2>
              <p>Se ha subido un nuevo archivo al historial.</p>
              <hr/>
              <ul>
                <li><strong>Paciente:</strong> ${uploadData.patientName.toUpperCase()}</li>
                <li><strong>DNI:</strong> ${uploadData.patientDni || 'No informado'}</li>
                <li><strong>Motivo/Estudio:</strong> ${displayTitle}</li>
                <li><strong>Profesional Responsable:</strong> ${selectedProf?.displayName || 'Externo'}</li>
              </ul>
            </div>
          `;

          // Envío a Administración
          await fetch(config.appsScriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({
              token: config.token,
              pdfBase64: base64data,
              recipientEmails: [config.adminEmail],
              subject: `${uploadData.patientName.toUpperCase()}`,
              message: bodyAdmin,
              fileName: `${uploadData.patientName.replace(/\s/g, '_')}.pdf`
            })
          });

          // Envío al Paciente (si tiene email)
          if (uploadData.patientEmail) {
            await fetch(config.appsScriptUrl, {
              method: 'POST',
              mode: 'no-cors',
              body: JSON.stringify({
                token: config.token,
                pdfBase64: base64data,
                recipientEmails: [uploadData.patientEmail],
                subject: subjectPaciente,
                message: bodyPaciente,
                fileName: `${uploadData.patientName.replace(/\s/g, '_')}.pdf`
              })
            });
          }
        } catch (mailErr) {
          console.error("Error sending upload notification:", mailErr);
        }
      }

      showToast('PDF subido y guardado con éxito');
      setIsUploadModalOpen(false);
      setUploadData({
        file: null, patientName: '', patientDni: '', socialWork: '', 
        requester: '', reason: '', patientEmail: '', profId: '',
        date: new Date().toLocaleDateString('en-CA')
      });
      fetchReports(selectedProfId, true);
      
      // Sincronizar el selector de la página con el profesional al que le subimos el informe
      if (canSelectProfessional) {
        setSelectedProfId(uploadData.profId);
      }

    } catch (err) {
      console.error("Error en handleUpload:", err);
      showToast('Error en la subida del archivo.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteReport = async (report) => {
    setDeleteModal({ show: true, report });
  };

  const confirmDelete = async () => {
    const report = deleteModal.report;
    if (!report) return;
    
    setLoading(true);
    setDeleteModal({ show: false, report: null });
    try {
      // 1. Intentar borrar en Supabase SOLO si tiene pdfUrl y storagePath
      const hasSupabaseFile = report.pdfUrl && (report.storagePath || report.pdfUrl.includes('/informescoat/'));
      
      if (hasSupabaseFile) {
        const storagePath = report.storagePath || decodeURIComponent(report.pdfUrl.split('/informescoat/')[1]?.split('?')[0] || '');
        
        if (storagePath) {
          console.log('Solicitando borrado a Supabase:', storagePath);
          const { error: storageError } = await supabase.storage.from('informescoat').remove([storagePath]);
          
          if (storageError) {
             console.error('Detalle error Supabase:', storageError);
             showToast(`Supabase no permitió borrar el archivo: ${storageError.message || 'Error de permisos'}. El registro de la lista se borrará igual.`, 'error');
          }
        }
      }

      // 2. Borrar en Firestore (siempre lo hacemos)
      await deleteDoc(doc(db, 'reports', report.id));
      
      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.DELETE_REPORT,
        report.id,
        `Informe eliminado: ${report.patient || report.pacienteNombre || 'Desconocido'} (${report.practicaNombre || 'Sin práctica'})`
      );
      
      showToast('Informe eliminado de la lista.');
      fetchReports(selectedProfId || 'all', true);
    } catch (err) {
      console.error("Error en handleDeleteReport:", err);
      showToast('Error al intentar borrar el registro.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewReport = (report) => {
    // Si tiene URL de PDF (informe subido o PDF persistente), se abre normal
    if (report.pdfUrl) {
      window.open(report.pdfUrl, '_blank');
    } else {
      // Si no tiene PDF (es informe interno), vamos a la vista previa en la página de informes
      navigate(`/reports/new?edit=${report.id}&preview=true`);
    }
  };

  const handleEditReport = (report) => {
    if (report.tipoReporte === 'externo') {
      showToast('Los PDFs externos no se pueden editar.', 'info');
      return;
    }
    navigate(`/reports/new?edit=${report.id}`);
  };

  const [isResending, setIsResending] = useState(null);

  const handleResendEmail = async (report) => {
    if (!report.patientEmail) {
      showToast('El informe no cuenta con un email de paciente registrado.', 'error');
      return;
    }
    if (!config.appsScriptUrl) {
      showToast('Apps Script no configurado.', 'error');
      return;
    }

    setIsResending(report.id);
    showToast("Reenviando informe...");

    try {
      let pdfBase64 = '';
      
      if (report.tipoReporte === 'externo') {
        // Fetch external PDF and convert to base64
        const response = await fetch(report.pdfUrl);
        const blob = await response.blob();
        pdfBase64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
          reader.readAsDataURL(blob);
        });
      } else {
        // Internal report: we need to generate it or fetch it if possible. 
        // For simplicity in this view, if it's internal we redirect to preview which has the full logic,
        // OR we can implement a quick resend if we had the generator here.
        // Since MyReportsPage doesn't have the generator logic, we'll inform the user.
        showToast('Para informes internos, utilice la opción de "Ver/Editar" para reenviar.', 'info');
        setIsResending(null);
        return;
      }

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
              </td>
            </tr>
          </table>
        </div>
      `;

      const emailBody = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
          <p>Estimado/a <strong>${report.pacienteNombre}</strong>,</p>
          <p>Esperamos que se encuentre bien.</p>
          <p>Le informamos que ya está disponible su <strong>informe médico</strong> generado en COAT. Adjunto a este correo encontrará el documento en formato PDF.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Detalles del informe:</strong></p>
            <ul style="list-style: none; padding-left: 0; margin: 10px 0 0 0;">
              <li><strong>Paciente:</strong> ${report.pacienteNombre}</li>
              <li><strong>Estudio/Prácticas:</strong> ${report.practicaNombre || 'Informe Médico'}</li>
              <li><strong>Fecha:</strong> ${formatDateForEmail(report.fecha)}</li>
              <li><strong>Profesional Responsable:</strong> ${report.profesionalNombre}</li>
            </ul>
          </div>

          <p>Si tiene alguna duda respecto al contenido del informe, por favor no dude en contactarse con nosotros.</p>
          
          <p>Atentamente,<br/><strong>Equipo de COAT.</strong></p>
          
          ${emailFooter}
          
          <p style="font-size: 11px; color: #999; margin-top: 30px;">
            Este es un mensaje automático, por favor no responda a esta dirección de correo.
          </p>
        </div>
      `;

      const emailPromises = [];
      // Admin copy (ONLY if not sent before)
      if (config.adminEmail && !report.sentToAdmin) {
        emailPromises.push(fetch(config.appsScriptUrl, {
          method: 'POST', mode: 'no-cors',
          body: JSON.stringify({
            token: config.token, pdfBase64,
            recipientEmails: [config.adminEmail],
            subject: `Reenvío Informe Médico: ${report.pacienteNombre}`,

            message: emailBody,
            fileName: `Informe_${report.pacienteNombre.replace(/\s/g, '_')}.pdf`
          })
        }));
      }
      
      emailPromises.push(fetch(config.appsScriptUrl, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({
          token: config.token, pdfBase64,
          recipientEmails: [report.patientEmail],
          subject: `COAT - Reenvío de Informe Médico: ${report.pacienteNombre}`,
          message: emailBody,
          fileName: `Informe_${report.pacienteNombre.replace(/\s/g, '_')}.pdf`
        })
      }));

      await Promise.all(emailPromises);

      // Update record if it was the first time sending to admin
      if (!report.sentToAdmin) {
        const { updateDoc, doc: fireDoc } = await import('firebase/firestore');
        await updateDoc(fireDoc(db, 'reports', report.id), { sentToAdmin: true });
      }

      showToast('¡Informe reenviado con éxito!');
    } catch (err) {
      console.error(err);
      showToast('Error al reenviar informe.', 'error');
    } finally {
      setIsResending(null);
    }
  };

  const filteredReports = reports.filter(r => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
      r.pacienteNombre?.toLowerCase().includes(searchLower) ||
      r.pacienteDni?.includes(searchTerm) ||
      r.practicaNombre?.toLowerCase().includes(searchLower) ||
      r.profesionalNombre?.toLowerCase().includes(searchLower) ||
      r.contenidoTexto?.toLowerCase().includes(searchLower);
    
    if (filterType === 'all') return matchesSearch;
    return matchesSearch && r.tipoReporte === filterType;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in relative">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-3">
            <ClipboardList className="text-blue-600" size={32} />
            {isSecretaria ? 'Visor de Informes' : (canSelectProfessional ? 'Ver Informes por Profesional' : 'Mis Informes Realizados')}
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            {isSecretaria ? 'Consulta y descarga de informes de todos los profesionales' : 'Historial completo de diagnósticos y prácticas'}
          </p>
        </div>

        <div className="flex items-center gap-3">
            {!isSecretaria && (
              <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  className="btn-primary px-6 py-3 flex items-center gap-2 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
              >
                  <Upload size={20} />
                  <span>Subir PDF</span>
              </button>
            )}

            {canSelectProfessional && (
            <div className="relative group min-w-[300px]">
                <select
                  className="w-full pl-12 pr-10 py-3 bg-[var(--bg-secondary)] border-2 border-[var(--border-main)] rounded-xl text-[var(--text-main)] focus:ring-4 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer group-hover:border-blue-500/50 font-bold"
                  value={selectedProfId}
                  onChange={(e) => setSelectedProfId(e.target.value)}
                >
                  <option value="all">TODOS LOS PROFESIONALES</option>
                  {professionals.map(prof => (
                    <option key={prof.id} value={prof.id}>
                      {prof.displayName || formatDisplayName(prof.nombre || prof.n || prof.u)}
                    </option>
                  ))}
                </select>
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-600">
                  <User size={18} />
                </div>
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-main)] opacity-30 pointer-events-none">
                  <ChevronDown size={18} />
                </div>
            </div>
            )}
        </div>
      </div>

      {/* Stats & Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-500/20">
          <p className="text-xs font-black uppercase tracking-widest opacity-60">Informes Mostrados</p>
          <h2 className="text-4xl font-black mt-2">{reports.length}</h2>
          <div className="mt-4 flex items-center text-xs opacity-80 gap-1">
            <Database size={14} /> Sincronizado con Firebase
          </div>
        </div>

        <div className={`md:col-span-3 p-4 rounded-[2.5rem] border-2 flex items-center gap-4 shadow-xl ${isDarkMode ? 'bg-[var(--bg-card)] border-main shadow-none' : 'bg-white border-slate-200 shadow-slate-200/50'}`}>
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por paciente, DNI o práctica..."
              className="w-full pl-12 pr-4 py-4 bg-[var(--bg-secondary)] border-none rounded-2xl font-medium outline-none transition-all focus:ring-2 focus:ring-blue-500/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => fetchReports(selectedProfId, true)}
            className="p-4 bg-[var(--bg-secondary)] hover:brightness-110 text-[var(--text-main)] rounded-2xl transition-all active:scale-95 border border-white/5 shadow-sm"
          >
            <RefreshCw size={24} className={loading ? 'animate-spin text-blue-600' : 'opacity-60 group-hover:opacity-100'} />
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-[var(--bg-card)] rounded-[3rem] border border-main overflow-hidden shadow-sm">
        <div className="p-8 border-b border-main bg-[var(--bg-secondary)]/30 flex items-center justify-between">
            <h3 className="font-bold flex items-center gap-2">
              <ClipboardList size={20} className="text-blue-600" />
              Resultados ({filteredReports.length})
            </h3>
            <div className="flex gap-2">
               {['all', 'clinico', 'fibro', 'externo'].map(type => (
                 <button 
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight transition-all ${
                        filterType === type ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-[var(--bg-secondary)]'
                    }`}
                 >
                    {type === 'all' ? 'Todos' : type === 'clinico' ? 'Clínicos' : type === 'fibro' ? 'Fibro' : 'PDFs'}
                 </button>
               ))}
            </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4 text-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-gray-500 font-bold animate-pulse">Obteniendo base de datos...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-6 text-center">
              <div className="w-20 h-20 bg-[var(--bg-secondary)] rounded-full flex items-center justify-center text-gray-300">
                <FileText size={40} />
              </div>
              <div>
                <h4 className="font-bold text-xl">Sin informes encontrados</h4>
                <p className="text-gray-400 max-w-xs mx-auto mt-2">No se encontraron registros que coincidan.</p>
              </div>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-secondary)]/50 text-[10px] uppercase font-black tracking-[0.1em] text-gray-400">
                  <th className="px-8 py-4">Fecha</th>
                  <th className="px-8 py-4">Profesional</th>
                  <th className="px-8 py-4">Paciente</th>
                  <th className="px-8 py-4">Práctica / Origen</th>
                  <th className="px-8 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y border-main">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-[var(--bg-secondary)]/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm">
                            {report.fecha?.includes('-') 
                              ? (() => {
                                  const [y, m, d] = report.fecha.split('-').map(Number);
                                  return new Date(y, m - 1, d).toLocaleDateString('es-AR');
                                })()
                              : report.fecha}
                            {report.fechaCreatedAt && (
                              <span className="ml-2 text-blue-600/60 dark:text-blue-400/60 font-medium">
                                - {new Date(report.fechaCreatedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 mt-1">ID: {report.id.substring(0,8)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                        <p className="font-bold text-[10px] text-blue-600 uppercase tracking-tighter max-w-[120px] truncate">
                          {(!report.profesionalNombre || report.profesionalNombre === 'Desconocido' || report.profesionalNombre === 'Profesional Desconocido') 
                            ? (professionals.find(p => p.id === report.profesionalId)?.nombre || report.profesionalNombre || 'Médico')
                            : report.profesionalNombre}
                        </p>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                             report.tipoReporte === 'externo' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                         }`}>
                            {report.pacienteNombre?.charAt(0)}
                         </div>
                         <div>
                            <p className="font-black text-sm">{toTitleCase(report.pacienteNombre)}</p>
                            <p className="text-xs text-gray-400">DNI: {report.pacienteDni || 'N/A'}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-2">
                        <span className={`w-fit px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                          report.tipoReporte === 'fibro' ? 'bg-amber-100 text-amber-700' : 
                          report.tipoReporte === 'externo' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-indigo-100 text-indigo-700'
                        }`}>
                          {report.practicaNombre || report.tipoReporte}
                        </span>
                        {isAdmin && (
                          <div className="flex items-center gap-1.5 ml-1">
                            {report.tipoReporte === 'externo' ? (
                              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600/60 uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                Supabase (PDF)
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-[9px] font-bold text-indigo-600/60 uppercase tracking-widest">
                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                Firestore (Texto)
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleViewReport(report)}
                            className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all border border-amber-100 shadow-sm"
                            title="Ver / Imprimir"
                          >
                            <Printer className="w-5 h-5" />
                          </button>

                          {(isAdmin || isSuperSecretaria || !isSecretaria) && report.tipoReporte !== 'externo' && (
                            <button 
                              onClick={() => handleEditReport(report)}
                              className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 shadow-sm"
                              title="Editar Informe"
                            >
                              <PenLine className="w-5 h-5" />
                            </button>
                          )}

                          {report.patientEmail && report.tipoReporte === 'externo' && (
                            <button 
                              disabled={isResending === report.id}
                              onClick={() => handleResendEmail(report)}
                              className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100 shadow-sm disabled:opacity-50"
                              title="Reenviar por Email"
                            >
                              {isResending === report.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mail className="w-5 h-5" />}
                            </button>
                          )}

                          {(isAdmin || isSuperSecretaria || (!isSecretaria && user.uid === report.profesionalId)) && (
                            <button 
                              onClick={() => handleDeleteReport(report)}
                              className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all border border-red-100 shadow-sm"
                              title="Eliminar Informe"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          )}
                        </div>
                      </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {hasMore && (
          <div className="p-8 border-t border-main bg-[var(--bg-secondary)]/30 flex justify-center">
            <button 
              onClick={() => fetchReports(selectedProfId, false)}
              disabled={loading}
              className="px-8 py-3 bg-[var(--bg-card)] border border-main rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-[var(--bg-secondary)] transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 text-[var(--text-main)]"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin text-blue-600" /> : <ChevronDown className="w-4 h-4" />}
              Cargar más informes
            </button>
          </div>
        )}

        {!hasMore && reports.length > 0 && (
          <div className="p-8 border-t border-main bg-[var(--bg-secondary)]/30 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-[var(--text-main)] opacity-40">
              No hay más informes para mostrar
            </p>
          </div>
        )}
      </div>

      {/* MODAL: DELETE CONFIRMATION */}
      <AnimatePresence>
        {deleteModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteModal({ show: false, report: null })}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-[var(--bg-card)] rounded-3xl p-8 max-w-md w-full shadow-2xl relative z-10 border border-white/10"
            >
              <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-center text-[var(--text-main)] mb-2 text-white">¿Eliminar Informe?</h3>
              <p className="text-[var(--text-main)] opacity-60 text-center mb-8 text-sm">
                Estás a punto de eliminar el informe de <span className="font-bold text-[var(--text-main)] opacity-100">{deleteModal.report?.pacienteNombre}</span>. Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteModal({ show: false, report: null })}
                  className="flex-1 py-3 px-4 bg-[var(--bg-secondary)] text-[var(--text-main)] rounded-xl font-bold hover:bg-[var(--bg-card)] transition-colors border border-white/5"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 shadow-lg shadow-red-500/20 transition-all"
                >
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-[var(--bg-card)] w-full max-w-lg rounded-[3rem] border border-main shadow-2xl overflow-hidden"
            >
              <div className="p-8 border-b border-main flex items-center justify-between bg-[var(--bg-secondary)]/30 text-[var(--text-main)]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <FileUp size={24} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black">Subir Informe PDF</h2>
                    <p className="text-xs text-gray-400 font-medium">Asociar informe externo a profesional</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsUploadModalOpen(false)}
                  className="p-3 hover:bg-gray-200 rounded-xl transition-colors text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleUpload} className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Paciente *</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Nombre Completo"
                      className="input-field"
                      value={uploadData.patientName}
                      onChange={e => setUploadData({...uploadData, patientName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1 flex justify-between items-center w-full">
                      <span>DNI *</span>
                      <span className="text-[8px] text-blue-500 font-bold normal-case bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-full">
                        Pegar captura (CTRL+V)
                      </span>
                    </label>
                    <input 
                      required
                      type="text" 
                      inputMode="numeric"
                      placeholder="Solo números"
                      className={`input-field ${isPasting ? 'animate-pulse border-blue-400' : ''}`}
                      value={uploadData.patientDni}
                      onPaste={handlePaste}
                      onChange={e => setUploadData({...uploadData, patientDni: e.target.value.replace(/\D/g, '')})}
                    />
                  </div>
                </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Obra Social (Opc)</label>
                      <input 
                        type="text" 
                        placeholder=""
                        className="input-field"
                        value={uploadData.socialWork}
                        onChange={e => setUploadData({...uploadData, socialWork: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Fecha de informe</label>
                      <input 
                        type="date" 
                        className="input-field"
                        value={uploadData.date}
                        onChange={e => setUploadData({...uploadData, date: e.target.value})}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Solicitante (Opc)</label>
                      <input 
                        type="text" 
                        placeholder="Médico..."
                        className="input-field"
                        value={uploadData.requester}
                        onChange={e => setUploadData({...uploadData, requester: e.target.value})}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Email Paciente (Opc)</label>
                      <input 
                        type="email" 
                        placeholder="Para envío por mail"
                        className={`input-field ${uploadData.patientEmail && !(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(uploadData.patientEmail)) ? 'input-error' : ''}`}
                        value={uploadData.patientEmail}
                        onChange={e => setUploadData({...uploadData, patientEmail: e.target.value})}
                      />
                      {emailMissingWarning && (
                        <p className="text-[9px] text-amber-500 font-bold ml-1 animate-pulse">
                          ⚠ Paciente sin email registrado
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Motivo / Descripción *</label>
                    <input 
                      required
                      type="text" 
                      placeholder=""
                      className="input-field"
                      value={uploadData.reason}
                      onChange={e => setUploadData({...uploadData, reason: e.target.value})}
                    />
                  </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Profesional Asociado *</label>
                  <select 
                    required
                    className="input-field cursor-pointer text-[var(--text-main)] bg-[var(--bg-secondary)]"
                    value={uploadData.profId}
                    onChange={e => setUploadData({...uploadData, profId: e.target.value})}
                  >
                    <option value="" disabled className="bg-[var(--bg-card)]">Seleccionar profesional...</option>
                    {professionals.map(p => (
                      <option key={p.id} value={p.id} className="bg-[var(--bg-card)] text-[var(--text-main)]">{p.nombre}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">Archivo PDF *</label>
                    <div className="relative group">
                        <input 
                            required
                            type="file" 
                            accept=".pdf"
                            className="hidden" 
                            id="pdf-upload"
                            onChange={e => setUploadData({...uploadData, file: e.target.files[0]})}
                        />
                        <label 
                            htmlFor="pdf-upload"
                            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-blue-500/30 rounded-[2rem] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] hover:border-blue-500 transition-all cursor-pointer group"
                        >
                            <Upload className="text-gray-400 group-hover:text-blue-500 mb-2" size={32} />
                            <span className="text-sm font-bold text-[var(--text-main)] opacity-70 group-hover:opacity-100 group-hover:text-blue-500">
                                {uploadData.file ? uploadData.file.name : 'Click para seleccionar archivo'}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-1">Solo se permiten archivos .pdf</span>
                        </label>
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="flex-1 py-4 bg-[var(--bg-secondary)] hover:bg-[var(--bg-card)] text-[var(--text-main)] border border-white/5 rounded-2xl font-bold transition-all text-sm"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={isUploading}
                    type="submit"
                    className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Database size={20} />}
                    {isUploading ? 'Subiendo...' : 'Registrar Informe'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyReportsPage;
