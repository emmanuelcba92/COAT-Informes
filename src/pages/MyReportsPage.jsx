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
  Eye,
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
  PenLine
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  doc, 
  limit,
  addDoc 
} from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import { db, auth } from '../services/firebase';

// Inicializar Supabase
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const MyReportsPage = ({ user, userProfile }) => {
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [professionals, setProfessionals] = useState([]);
  const [selectedProfId, setSelectedProfId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all');

  // Sistema de Notificaciones Toast
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
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
    profId: '',
    date: new Date().toISOString().split('T')[0]
  });

  const isSecretaria = userProfile?.role?.toLowerCase().includes('secre');
  const isAdmin = userProfile?.role?.toLowerCase().includes('admin');
  const canSelectProfessional = isSecretaria || isAdmin;

  useEffect(() => {
    const fetchProfs = async () => {
      try {
        const q = query(collection(db, 'users'), orderBy('nombre', 'asc'));
        const snap = await getDocs(q);
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // De-duplication logic (same as Admin)
        const uniqueUsers = {};
        list.forEach(u => {
          // Extraer email de campo o de ID si es un slug legacy
          let email = (u.email || u.e || u.u || '').toLowerCase().trim();
          
          if (!email && u.id && u.id.includes('_')) {
            email = u.id.replace(/_/g, '.');
            if (!email.includes('@')) email += '@coat.com.ar';
          }
          
          const key = email || u.id;
          if (!key) return;

          if (!uniqueUsers[key]) {
            uniqueUsers[key] = u;
          } else {
            const existing = uniqueUsers[key];
            const currentHasName = !!(u.nombre || u.n);
            const existingHasName = !!(existing.nombre || existing.n);
            // Prioridad: 1. Tiene nombre, 2. Es ID oficial (28 chars)
            if (currentHasName && !existingHasName) {
              uniqueUsers[key] = u;
            } else if (currentHasName === existingHasName && u.id.length === 28) {
              uniqueUsers[key] = u;
            }
          }
        });

        const cleanList = Object.values(uniqueUsers)
          .map(u => {
            const rawName = u.nombre || u.n || u.u || 'Profesional';
            return {
              ...u,
              nombre: rawName.toUpperCase().trim(),
              rol: (u.role || u.rol || '').toLowerCase().trim()
            };
          })
          .filter(u => {
            const name = u.nombre.toLowerCase();
            const role = u.rol.toLowerCase();
            const isMedicalRole = role.includes('medico') || role.includes('médico') || role.includes('fonoaudiología');
            // Excluir si el nombre contiene "sercretaria" (con R), "secretaria" o "admin"
            const isExcludedName = name.includes('sercretaria') || name.includes('secretaria') || name.includes('admin');
            return isMedicalRole && !isExcludedName;
          })
          .sort((a, b) => a.nombre.localeCompare(b.nombre));

        setProfessionals(cleanList);
        
        if (!canSelectProfessional) {
          setSelectedProfId(user.uid);
          setUploadData(prev => ({ ...prev, profId: user.uid }));
        }
      } catch (err) {
        console.error("Error fetching professionals:", err);
      }
    };
    fetchProfs();
  }, [canSelectProfessional, user.uid]);

  useEffect(() => {
    if (selectedProfId) {
      setReports([]); // Limpiar lista al cambiar de profesional para evitar "fantasmas"
      fetchReports(selectedProfId);
    }
  }, [selectedProfId]);

  const fetchReports = async (profId) => {
    setLoading(true);
    try {
      const q = query(
        collection(db, 'reports'),
        where('profesionalId', '==', profId),
        orderBy('fechaCreatedAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReports(list);
    } catch (err) {
      console.error("Error fetching reports:", err);
      showToast("Error al cargar informes técnicos.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!uploadData.file || !uploadData.patientName || !uploadData.profId) {
      alert('Por favor complete los campos obligatorios y seleccione un archivo.');
      return;
    }

    setIsUploading(true);
    try {
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

      // 3. Save to Firestore (Guardamos la ruta para borrarla fácil después)
      await addDoc(collection(db, 'reports'), {
        profesionalId: uploadData.profId,
        profesionalNombre: selectedProf?.nombre || 'Externo',
        pacienteNombre: uploadData.patientName.toUpperCase(),
        pacienteDni: uploadData.patientDni || '',
        fecha: uploadData.date,
        fechaCreatedAt: new Date().toISOString(),
        pdfUrl: downloadURL,
        storagePath: filePath,
        tipoReporte: 'externo',
        practicaNombre: 'INFORME EXTERNO / PDF SUBIDO (SUPABASE)'
      });

      showToast('¡Archivo subido con éxito!');
      setIsUploadModalOpen(false);
      
      // Sincronizar el selector de la página con el profesional al que le subimos el informe
      if (canSelectProfessional) {
        setSelectedProfId(uploadData.profId);
      }

      setUploadData({ 
        file: null, 
        patientName: '', 
        patientDni: '', 
        profId: canSelectProfessional ? '' : user.uid, 
        date: new Date().toISOString().split('T')[0] 
      });
      
      // IMPORTANTE: Le damos un respiro a Firebase para que indexe el nuevo documento
      // Si consultamos INSTANTÁNEAMENTE, a veces devuelve 0 resultados.
      setTimeout(() => {
        fetchReports(uploadData.profId);
      }, 1500);

    } catch (err) {
      console.error("Error en handleUpload:", err);
      showToast('Error en la subida del archivo.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteReport = async (report) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este informe?')) return;
    
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
      
      showToast('Informe eliminado de la lista.');
      fetchReports(selectedProfId || user.uid);
    } catch (err) {
      console.error("Error en handleDeleteReport:", err);
      showToast('Error al intentar borrar el registro.', 'error');
    }
  };

  const handleViewReport = (report) => {
    // Si tiene URL de PDF (informe subido o PDF persistente), se abre normal
    if (report.pdfUrl) {
      window.open(report.pdfUrl, '_blank');
    } else {
      // Si no tiene PDF (es informe interno), vamos a editarlo
      navigate(`/?edit=${report.id}`);
    }
  };

  const handleEditReport = (report) => {
    if (report.tipoReporte === 'externo') {
      showToast('Los PDFs externos no se pueden editar.', 'info');
      return;
    }
    navigate(`/?edit=${report.id}`);
  };

  const filteredReports = reports.filter(r => {
    const matchesSearch = 
      r.pacienteNombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.pacienteDni?.includes(searchTerm) ||
      r.practicaNombre?.toLowerCase().includes(searchTerm.toLowerCase());
    
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
            {canSelectProfessional ? 'Ver Informes por Profesional' : 'Mis Informes Realizados'}
          </h1>
          <p className="text-gray-500 mt-1 font-medium">Historial completo de diagnósticos y prácticas</p>
        </div>

        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="btn-primary px-6 py-3 flex items-center gap-2 shadow-xl shadow-blue-500/20 active:scale-95 transition-all"
            >
                <Upload size={20} />
                <span>Subir PDF</span>
            </button>

            {canSelectProfessional && (
            <div className="flex items-center gap-4 bg-[var(--bg-card)] p-2 rounded-2xl border border-main shadow-sm min-w-[240px]">
                <div className="pl-3 text-blue-600">
                <User size={18} />
                </div>
                <select 
                className="flex-1 bg-transparent border-none outline-none font-bold text-xs pr-10 appearance-none cursor-pointer text-[var(--text-main)]"
                value={selectedProfId || ''}
                onChange={(e) => setSelectedProfId(e.target.value)}
                >
                <option value="" disabled className="bg-[var(--bg-card)]">Seleccionar profesional...</option>
                {professionals.map(p => (
                    <option key={p.id} value={p.id} className="bg-[var(--bg-card)] text-[var(--text-main)]">{p.nombre}</option>
                ))}
                </select>
            </div>
            )}
        </div>
      </div>

      {/* Stats & Search */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-500/20">
          <p className="text-xs font-black uppercase tracking-widest opacity-60">Total Informes</p>
          <h2 className="text-4xl font-black mt-2">{reports.length}</h2>
          <div className="mt-4 flex items-center text-xs opacity-80 gap-1">
            <Database size={14} /> Sincronizado con Firebase
          </div>
        </div>

        <div className="md:col-span-3 bg-[var(--bg-card)] p-4 rounded-[2.5rem] border border-main flex items-center gap-4 shadow-sm">
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
            onClick={() => fetchReports(selectedProfId)}
            className="p-4 bg-[var(--bg-secondary)] hover:bg-gray-100 rounded-2xl text-gray-400 transition-all active:scale-95"
          >
            <RefreshCw size={24} className={loading ? 'animate-spin text-blue-600' : ''} />
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-[var(--bg-card)] rounded-[3rem] border border-main overflow-hidden shadow-sm">
        <div className="p-8 border-b border-main bg-gray-50/50 flex items-center justify-between">
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
                        filterType === type ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:bg-gray-100'
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
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-300">
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
                <tr className="bg-gray-50/50 text-[10px] uppercase font-black tracking-[0.1em] text-gray-400">
                  <th className="px-8 py-4">Fecha</th>
                  <th className="px-8 py-4">Paciente</th>
                  <th className="px-8 py-4">Práctica / Origen</th>
                  <th className="px-8 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y border-main">
                {filteredReports.map((report) => (
                  <tr key={report.id} className="hover:bg-gray-50/50 transition-colors group">
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-bold text-sm">{report.fecha}</span>
                        <span className="text-[10px] text-gray-400">ID: {report.id.substring(0,8)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                             report.tipoReporte === 'externo' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                         }`}>
                            {report.pacienteNombre?.charAt(0)}
                         </div>
                         <div>
                            <p className="font-black text-sm">{report.pacienteNombre}</p>
                            <p className="text-xs text-gray-400">DNI: {report.pacienteDni || 'N/A'}</p>
                         </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-tighter ${
                         report.tipoReporte === 'fibro' ? 'bg-amber-100 text-amber-700' : 
                         report.tipoReporte === 'externo' ? 'bg-emerald-100 text-emerald-700' :
                         'bg-indigo-100 text-indigo-700'
                       }`}>
                         {report.practicaNombre || report.tipoReporte}
                       </span>
                    </td>
                      <td className="px-8 py-6">
                        <div className="flex items-center justify-center gap-2">
                          <button 
                            onClick={() => handleViewReport(report)}
                            className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all border border-amber-100 shadow-sm"
                            title="Ver / Imprimir"
                          >
                            <Eye className="w-5 h-5" />
                          </button>

                          <button 
                            onClick={() => handleEditReport(report)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-all border border-blue-100 shadow-sm"
                            title="Editar Informe"
                          >
                            <PenLine className="w-5 h-5" />
                          </button>

                          {(isAdmin || (!isSecretaria && user.uid === report.profesionalId)) && (
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
      </div>

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
              <div className="p-8 border-b border-main flex items-center justify-between bg-gray-50/50">
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
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-1">DNI</label>
                    <input 
                      type="text" 
                      placeholder="DNI del paciente"
                      className="input-field"
                      value={uploadData.patientDni}
                      onChange={e => setUploadData({...uploadData, patientDni: e.target.value})}
                    />
                  </div>
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
                            className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-main rounded-[2rem] bg-gray-50 hover:bg-white hover:border-blue-500 transition-all cursor-pointer group"
                        >
                            <Upload className="text-gray-300 group-hover:text-blue-500 mb-2" size={32} />
                            <span className="text-sm font-bold text-gray-500 group-hover:text-blue-600">
                                {uploadData.file ? uploadData.file.name : 'Click para seleccionar archivo'}
                            </span>
                            <span className="text-[10px] text-gray-400 mt-1">Solo se permiten archivos .pdf</span>
                        </label>
                    </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsUploadModalOpen(false)}
                    className="flex-1 py-4 bg-gray-100 hover:bg-gray-200 rounded-2xl font-bold transition-all text-sm"
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
