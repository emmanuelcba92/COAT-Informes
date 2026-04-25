import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  Search, 
  Trash2, 
  User as UserIcon, 
  Loader2, 
  ChevronRight,
  ExternalLink,
  Plus,
  Mail,
  CreditCard,
  Building2,
  Phone,
  Calendar,
  AlertCircle,
  Sparkles,
  BrainCircuit,
  Upload,
  FileText as FileIcon,
  Check,
  X,
  Clipboard,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '../services/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  deleteDoc, 
  query, 
  orderBy,
  limit,
  where,
  writeBatch,
  getDocs,
  getDoc,
  setDoc, 
  serverTimestamp,
  startAfter,
  getCountFromServer
} from 'firebase/firestore';
import * as pdfjsLib from 'pdfjs-dist';
import { extractPatientsFromImage, extractPatientsFromText } from '../utils/aiService';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@5.6.205/build/pdf.worker.min.mjs`;

export default function PatientsPage({ isAdmin = false, isSecretaria = false, isDirectora = false, currentUser }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastVisible, setLastVisible] = useState(null);
  const [isMoreLoading, setIsMoreLoading] = useState(false);
  const [totalPatients, setTotalPatients] = useState(0);
  const [error, setError] = useState(null);

  // States for Smart Importer
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importResults, setImportResults] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [isPasting, setIsPasting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!currentUser) return;
    
    const delayDebounceFn = setTimeout(() => {
      loadPatients();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [currentUser, searchTerm]);

  const loadPatients = async (isLoadMore = false) => {
    if (!currentUser) return;
    
    if (isLoadMore) setIsMoreLoading(true);
    else setLoading(true);

    try {
      let q;
      const patientsRef = collection(db, 'patients');
      const constraints = [];

      // 0. Get total count (for UI badge)
      const totalSnapshot = await getCountFromServer(patientsRef);
      setTotalPatients(totalSnapshot.data().count);

      // 1. Visibility constraints
      if (!(isAdmin || isSecretaria)) {
        constraints.push(where('professionalIds', 'array-contains', currentUser.uid));
      }

      // 2. Search constraints
      if (searchTerm.trim()) {
        const term = searchTerm.trim().toUpperCase();
        const isNumeric = /^\d+$/.test(term);
        
        if (isNumeric) {
          constraints.push(where('dni', '>=', term));
          constraints.push(where('dni', '<=', term + '\uf8ff'));
        } else {
          constraints.push(where('name', '>=', term));
          constraints.push(where('name', '<=', term + '\uf8ff'));
        }
      } else {
        // Use DNI as a stable sort that always exists
        constraints.push(orderBy('dni', 'asc'));
      }

      // 3. Pagination
      constraints.push(limit(25));
      if (isLoadMore && lastVisible) {
        constraints.push(startAfter(lastVisible));
      }

      q = query(patientsRef, ...constraints);
      const snapshot = await getDocs(q);
      
      const newPatients = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (isLoadMore) {
        setPatients(prev => [...prev, ...newPatients]);
      } else {
        setPatients(newPatients);
      }
      
      setLastVisible(snapshot.docs[snapshot.docs.length - 1]);
      setError(null);
    } catch (err) {
      console.error("Firestore Error:", err);
      setError("Error al cargar pacientes. Es posible que falte un índice en la base de datos.");
    } finally {
      setLoading(false);
      setIsMoreLoading(false);
    }
  };

  const handleDeletePatient = async (id, name) => {
    const patientName = name || 'este paciente';
    if (window.confirm(`¿Estás seguro de eliminar al paciente ${patientName}? Esta acción no se puede deshacer.`)) {
      try {
        await deleteDoc(doc(db, 'patients', id));
      } catch (err) {
        alert('Error al eliminar: ' + err.message);
      }
    }
  };

  // SMART IMPORTER LOGIC
  const handleSmartImport = async (fileOrPasted) => {
    setImportLoading(true);
    setImportResults([]);
    try {
      if (fileOrPasted instanceof File) {
        if (fileOrPasted.type.includes('image')) {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const base64 = e.target.result.split(',')[1];
            const data = await extractPatientsFromImage(base64);
            setImportResults(data || []);
          };
          reader.readAsDataURL(fileOrPasted);
        } else if (fileOrPasted.type === 'application/pdf') {
          const reader = new FileReader();
          reader.onload = async (e) => {
            const typedarray = new Uint8Array(e.target.result);
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = "";
            for (let i = 1; i <= pdf.numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              fullText += content.items.map(item => item.str).join(" ") + "\n";
            }
            const data = await extractPatientsFromText(fullText);
            setImportResults(data || []);
          };
          reader.readAsArrayBuffer(fileOrPasted);
        }
      } else {
        // Assume base64 from paste
        const data = await extractPatientsFromImage(fileOrPasted);
        setImportResults(data || []);
      }
    } catch (err) {
      console.error("Import error:", err);
      alert("Error al procesar el archivo. Revisa la consola.");
    } finally {
      setImportLoading(false);
    }
  };

  const onPaste = async (e) => {
    const item = e.clipboardData.items[0];
    if (item?.type.includes('image')) {
      setIsPasting(true);
      const blob = item.getAsFile();
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64 = event.target.result.split(',')[1];
        await handleSmartImport(base64);
        setIsPasting(false);
      };
      reader.readAsDataURL(blob);
    }
  };

  const saveImportedPatients = async () => {
    if (importResults.length === 0) return;
    setImportLoading(true);
    try {
      const batch = writeBatch(db);
      
      for (const p of importResults) {
        const cleanDni = p.dni.toString().replace(/\D/g, '');
        if (!cleanDni) continue;
        
        const patientRef = doc(db, 'patients', cleanDni);
        
        // Get existing patient to merge professionalIds
        const docSnap = await getDoc(patientRef);
        let currentProfIds = [currentUser.uid];
        let existingData = {};

        if (docSnap.exists()) {
          existingData = docSnap.data();
          const prevIds = existingData.professionalIds || [];
          if (!prevIds.includes(currentUser.uid)) {
            currentProfIds = [...prevIds, currentUser.uid];
          } else {
            currentProfIds = prevIds;
          }
        }

        // Standardize fields for dual compatibility
        const patientData = {
          ...existingData,
          dni: cleanDni,
          name: p.nombre?.toUpperCase() || existingData.name || '',
          nombre: p.nombre?.toUpperCase() || existingData.nombre || '',
          insurance: p.obraSocial?.toUpperCase() || existingData.insurance || '',
          obraSocial: p.obraSocial?.toUpperCase() || existingData.obraSocial || '',
          email: p.email?.toLowerCase() || existingData.email || null,
          telefono: p.telefono || existingData.telefono || '',
          professionalIds: currentProfIds,
          updatedAt: serverTimestamp(),
          lastImportedBy: currentUser.uid
        };

        batch.set(patientRef, patientData, { merge: true });
      }

      await batch.commit();
      alert(`Se importaron/actualizaron ${importResults.length} pacientes.`);
      setIsImportModalOpen(false);
      setImportResults([]);
    } catch (err) {
      console.error("Error saving patients:", err);
      alert("Error al guardar en la base de datos.");
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in p-4 pb-20" onPaste={onPaste}>
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-main">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Pacientes</h1>
          <p className="text-slate-500 font-medium">Gestión y registro centralizado de la institución</p>
        </div>
        
        <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          {/* Smart Importer Button */}
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="w-full md:w-auto px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-xl hover:shadow-blue-500/20 transition-all flex items-center justify-center gap-2 group"
          >
            <Sparkles size={18} className="group-hover:animate-pulse" />
            Importador Inteligente
          </button>

          <div className="relative w-full md:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
              <Search size={20} />
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre o DNI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-[var(--bg-card)] border-2 border-slate-200 dark:border-main rounded-2xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all outline-none font-medium text-slate-700 dark:text-slate-200 shadow-sm"
            />
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card p-6 border-none bg-[var(--bg-card)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 transition-transform group-hover:scale-110">
              <Users size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-[var(--text-sub)] uppercase tracking-widest">Pacientes Visibles</p>
              <h3 className="text-2xl font-black text-[var(--text-main)] flex items-end gap-2">
                {loading ? <Loader2 className="animate-spin text-blue-600" size={20} /> : patients.length}
                <span className="text-sm font-bold text-slate-400 mb-1">/ {totalPatients}</span>
              </h3>
            </div>
          </div>
        </motion.div>
        
        {(!isAdmin && !isDirectora && !isSecretaria) && (
          <div className="md:col-span-3 flex items-center gap-3 px-6 py-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800/30 rounded-2xl text-blue-700 dark:text-blue-400">
            <Info size={20} className="shrink-0" />
            <p className="text-sm font-bold">Estás viendo solo los pacientes vinculados a tus informes o pedidos.</p>
          </div>
        )}
      </div>

      {/* Main Table/Grid */}
      <div className="bg-[var(--bg-card)] border border-main rounded-[32px] shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <Loader2 className="animate-spin" size={48} />
            <p className="font-bold uppercase tracking-widest text-xs">Cargando base de datos...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-red-500">
            <AlertCircle size={48} />
            <p className="font-bold uppercase tracking-widest text-xs">{error}</p>
          </div>
        ) : patients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-slate-400">
            <Users size={48} className="opacity-20" />
            <p className="font-bold uppercase tracking-widest text-xs">No se encontraron pacientes</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[var(--bg-secondary)] text-[10px] uppercase font-black tracking-[0.15em] text-[var(--text-sub)] border-b border-main">
                  <th className="px-6 py-5 text-left font-black">Paciente</th>
                  <th className="px-6 py-5 text-left font-black">DNI / ID</th>
                  <th className="px-6 py-5 text-left font-black">Obra Social</th>
                  <th className="px-6 py-5 text-left font-black">Contacto</th>
                  <th className="px-6 py-5 text-right font-black">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-main">
                {patients.map((patient, idx) => (
                  <motion.tr 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.03 }}
                    key={patient.id} 
                    className="group hover:bg-[var(--bg-secondary)]/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-sm border border-white dark:border-slate-800 shadow-sm">
                          {(patient.name || patient.nombre)?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div>
                          <p className="font-bold text-[var(--text-main)] capitalize">{patient.name || patient.nombre || 'Sin nombre'}</p>
                          <p className="text-[10px] text-[var(--text-sub)] font-bold uppercase">Paciente Registrado</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-[var(--text-main)] flex items-center gap-1.5">
                          <CreditCard size={12} className="text-[var(--text-sub)]" />
                          {patient.dni || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5 text-sm font-bold text-[var(--text-main)]">
                          <Building2 size={12} className="text-[var(--text-sub)]" />
                          {patient.insurance || patient.obraSocial || 'Particular'}
                        </div>
                        {(patient.affiliateNumber || patient.nroAfiliado) && (
                          <div className="text-[10px] text-[var(--text-sub)] font-black uppercase tracking-tighter">
                            Af: {patient.affiliateNumber || patient.nroAfiliado}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        {(patient.email || patient.patientEmail) && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-main)] max-w-[200px] truncate" title={patient.email || patient.patientEmail}>
                            <Mail size={12} className="text-[var(--text-sub)] shrink-0" />
                            {patient.email || patient.patientEmail}
                          </div>
                        )}
                        {(patient.telefono || patient.phone) && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-main)]">
                            <Phone size={12} className="text-[var(--text-sub)]" />
                            {patient.telefono || patient.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`flex items-center justify-end gap-2 ${(isAdmin || isDirectora) && !isSecretaria ? 'opacity-0 group-hover:opacity-100' : 'hidden'} transition-opacity`}>
                        <button 
                          onClick={() => handleDeletePatient(patient.id, patient.name || patient.nombre)}
                          className="p-2.5 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all duration-300 shadow-sm hover:shadow-red-500/20"
                          title="Eliminar Paciente"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lastVisible && (
        <div className="flex justify-center pt-4">
          <button
            disabled={isMoreLoading}
            onClick={() => loadPatients(true)}
            className="flex items-center gap-2 px-8 py-3 bg-white dark:bg-slate-800 border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-black rounded-2xl hover:bg-blue-50 transition-all active:scale-95 shadow-lg shadow-blue-500/10 uppercase tracking-widest text-xs disabled:opacity-50"
          >
            {isMoreLoading ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            {isMoreLoading ? 'Cargando...' : 'Cargar más pacientes'}
          </button>
        </div>
      )}

      {/* SMART IMPORT MODAL */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsImportModalOpen(false)}
              className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl bg-[var(--bg-card)] rounded-[40px] shadow-2xl overflow-hidden border border-main flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-8 border-b border-main flex items-center justify-between bg-gradient-to-r from-blue-600/5 to-transparent">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <BrainCircuit size={24} />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-[var(--text-main)]">Importador Inteligente</h3>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">IA-Powered Patient Extraction</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
                {importResults.length === 0 ? (
                  <div className="space-y-8">
                    {/* Instructions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30">
                        <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black mb-3">1</div>
                        <p className="text-xs font-bold text-blue-700 dark:text-blue-400 uppercase mb-1">Captura GACITUA</p>
                        <p className="text-[10px] text-blue-600/70">Haz una captura de pantalla del listado de turnos.</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-indigo-50 dark:bg-indigo-900/10 border border-indigo-100 dark:border-indigo-800/30">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black mb-3">2</div>
                        <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400 uppercase mb-1">Pega o Sube</p>
                        <p className="text-[10px] text-indigo-600/70">Presiona Ctrl+V aquí o sube un PDF de turnos.</p>
                      </div>
                      <div className="p-4 rounded-2xl bg-purple-50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-800/30">
                        <div className="w-8 h-8 rounded-lg bg-purple-600 text-white flex items-center justify-center font-black mb-3">3</div>
                        <p className="text-xs font-bold text-purple-700 dark:text-purple-400 uppercase mb-1">Confirma</p>
                        <p className="text-[10px] text-purple-600/70">La IA extraerá DNI, Nombre, Mutual y Email.</p>
                      </div>
                    </div>

                    {/* Dropzone */}
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`
                        relative border-4 border-dashed rounded-[32px] p-12 flex flex-col items-center justify-center gap-6 transition-all cursor-pointer
                        ${isPasting || importLoading ? 'border-blue-500 bg-blue-50/50 scale-[0.98]' : 'border-slate-200 dark:border-slate-800 hover:border-blue-400 hover:bg-blue-50/10'}
                      `}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*,application/pdf"
                        onChange={(e) => e.target.files[0] && handleSmartImport(e.target.files[0])}
                      />
                      
                      {importLoading ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="relative">
                            <div className="w-20 h-20 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
                            <BrainCircuit className="absolute inset-0 m-auto text-blue-600 animate-pulse" size={32} />
                          </div>
                          <div className="text-center">
                            <p className="text-lg font-black text-blue-600 animate-pulse">PROCESANDO CON IA...</p>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">Leyendo datos de pacientes</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="w-24 h-24 bg-blue-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                            <Upload size={40} />
                          </div>
                          <div className="text-center space-y-2">
                            <p className="text-xl font-black text-[var(--text-main)]">Presiona <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg border border-main text-sm">Ctrl + V</kbd> aquí</p>
                            <p className="text-sm font-medium text-slate-400">o haz clic para subir imagen o PDF</p>
                          </div>
                          <div className="flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            <span className="flex items-center gap-2"><Check size={14} className="text-green-500" /> Captura GACITUA</span>
                            <span className="flex items-center gap-2"><Check size={14} className="text-green-500" /> PDF de Turnos</span>
                          </div>
                        </>
                      )}
                    </div>

                    {isPasting && (
                      <div className="text-center animate-bounce">
                        <p className="text-xs font-black text-blue-600 uppercase tracking-widest">Pegando captura...</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-black text-slate-500 uppercase tracking-widest text-xs">
                        Pacientes Detectados ({importResults.length})
                      </h4>
                      <button 
                        onClick={() => setImportResults([])}
                        className="text-xs font-black text-red-500 uppercase hover:underline"
                      >
                        Limpiar y reintentar
                      </button>
                    </div>
                    <div className="border border-main rounded-2xl overflow-hidden shadow-sm">
                      <table className="w-full text-left">
                        <thead className="bg-slate-50 dark:bg-slate-800/50">
                          <tr>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">DNI</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Nombre</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Obra Social</th>
                            <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResults.map((r, idx) => (
                            <tr key={idx} className="border-t border-main">
                              <td className="px-4 py-3">
                                <input 
                                  value={r.dni} 
                                  onChange={(e) => {
                                    const next = [...importResults];
                                    next[idx].dni = e.target.value;
                                    setImportResults(next);
                                  }}
                                  className="w-full bg-transparent font-mono text-xs text-blue-600 focus:outline-none"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  value={r.nombre} 
                                  onChange={(e) => {
                                    const next = [...importResults];
                                    next[idx].nombre = e.target.value.toUpperCase();
                                    setImportResults(next);
                                  }}
                                  className="w-full bg-transparent font-bold text-xs focus:outline-none"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  value={r.obraSocial} 
                                  onChange={(e) => {
                                    const next = [...importResults];
                                    next[idx].obraSocial = e.target.value.toUpperCase();
                                    setImportResults(next);
                                  }}
                                  className="w-full bg-transparent text-xs text-slate-500 focus:outline-none"
                                />
                              </td>
                              <td className="px-4 py-3">
                                <input 
                                  value={r.email || ''} 
                                  placeholder="Sin email"
                                  onChange={(e) => {
                                    const next = [...importResults];
                                    next[idx].email = e.target.value.toLowerCase();
                                    setImportResults(next);
                                  }}
                                  className="w-full bg-transparent text-xs text-slate-500 focus:outline-none"
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {importResults.length > 0 && (
                <div className="p-8 border-t border-main bg-slate-50 dark:bg-slate-900/20 flex gap-4">
                  <button 
                    disabled={importLoading}
                    onClick={() => setIsImportModalOpen(false)}
                    className="flex-1 py-4 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-300 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    disabled={importLoading}
                    onClick={saveImportedPatients}
                    className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                  >
                    {importLoading ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
                    CONFIRMAR E IMPORTAR {importResults.length} PACIENTES
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
