import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Stethoscope, 
  Mail, 
  Plus, 
  FileUp, 
  Trash2, 
  Edit2, 
  ExternalLink,
  Settings2, 
  UserPlus, 
  X, 
  Check, 
  Key, 
  ShieldCheck,
  ClipboardList,
  Search,
  Loader2,
  Save,
  UserCog,
  Upload,
  Briefcase,
  FileText,
  BookOpen,
  User as UserIcon,
  Search as SearchIcon,
  Database,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '../services/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  setDoc,
  getDoc,
  getDocs,
  where,
  limit,
  getCountFromServer,
  writeBatch
} from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

// Inicializar Supabase para gestión de archivos
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const AdminPage = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [token, setToken] = useState('');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [manualUserForm, setManualUserForm] = useState({ nombre: '', mp: '', me: '', especialidad: '', u: '', password: '', role: 'médico' });
  const [loading, setLoading] = useState(true);
  
  // State for Users
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  // State for Practices
  const [practices, setPractices] = useState([]);
  const [practiceSearch, setPracticeSearch] = useState('');
  const [practiceForm, setPracticeForm] = useState({ c: '', n: '', b: '', st: true });
  const [selectedPractice, setSelectedPractice] = useState(null);

  // State for Managing Professional Profile
  const [isManageProfessionalModalOpen, setIsManageProfessionalModalOpen] = useState(false);
  const [targetProf, setTargetProf] = useState(null);
  const [isProfSaving, setIsProfSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState('general'); // 'general' or 'fibro'
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);
  
  // State for Managing Professional MODELS (Personal Practices)
  const [isModelsModalOpen, setIsModelsModalOpen] = useState(false);
  const [targetUserForModels, setTargetUserForModels] = useState(null);
  const [isModelsSaving, setIsModelsSaving] = useState(false);
  const [editingModelId, setEditingModelId] = useState(null);
  const [modelForm, setModelForm] = useState({ n: '', b: '', practiceId: '' });

  // Real-time synchronization
  useEffect(() => {
    setLoading(true);
    
    // Sync Practices
    const qPractices = query(collection(db, 'practices'), orderBy('n', 'asc'));
    const unsubscribePractices = onSnapshot(qPractices, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPractices(list);
    });

    // Sync Users
    const qUsers = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const uniqueUsers = {};
      list.forEach(u => {
        const email = (u.email || u.e || (typeof u.id === 'string' && u.id.includes('@') ? u.id : '')).toLowerCase().trim();
        const username = (u.u || '').toLowerCase().trim();
        const key = email || username || u.id;
        
        if (!key) return;

        if (!uniqueUsers[key]) {
          uniqueUsers[key] = u;
        } else {
          const existing = uniqueUsers[key];
          const currentHasName = !!(u.nombre || u.n);
          const existingHasName = !!(existing.nombre || existing.n);
          
          if (currentHasName && !existingHasName) {
            uniqueUsers[key] = u;
          } 
          if (u.id.length === 28 && existing.id.length !== 28) {
            uniqueUsers[key] = u;
          }
        }
      });
      setUsers(Object.values(uniqueUsers));
      setLoading(false);
    });

    fetchStorageStats();

    // Sync Settings
    const unsubscribeSettings = onSnapshot(doc(db, 'config', 'settings'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAppsScriptUrl(data.appsScriptUrl || '');
        setAdminEmail(data.adminEmail || '');
        setToken(data.token || '');
      }
    });

    return () => {
      unsubscribePractices();
      unsubscribeUsers();
      unsubscribeSettings();
    };
  }, []);

  // ESTADOS PARA MANTENIMIENTO Y ALMACENAMIENTO
  const [storageStats, setStorageStats] = useState({ 
    fbCount: 0, 
    fbSize: 0, 
    sbCount: 0, 
    sbSize: 0, 
    loading: true 
  });
  const [cleanRange, setCleanRange] = useState({ start: '', end: '' });
  const [cleanOptions, setCleanOptions] = useState({ pdfs: true, records: false });
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanSummary, setCleanSummary] = useState(null);

  const fetchStorageStats = async () => {
    setStorageStats(prev => ({ ...prev, loading: true }));
    try {
      // 1. Firebase (Database)
      const reportsSnap = await getDocs(collection(db, 'reports'));
      const fbCount = reportsSnap.size;
      
      let totalBytes = 0;
      reportsSnap.forEach(doc => {
        totalBytes += JSON.stringify(doc.data()).length;
      });

      // 2. Supabase (Files)
      const { data: files } = await supabase.storage.from('informescoat').list('', { limit: 1000 });
      
      let sbSize = 0;
      let sbCount = 0;
      if (files) {
        const realFiles = files.filter(f => f.name !== '.emptyFolderPlaceholder');
        sbCount = realFiles.length;
        sbSize = realFiles.reduce((acc, file) => acc + (file.metadata?.size || 0), 0);
      }

      setStorageStats({
        fbCount,
        fbSize: (totalBytes / 1024).toFixed(2), 
        sbCount,
        sbSize: (sbSize / (1024 * 1024)).toFixed(2), 
        loading: false
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
      setStorageStats(prev => ({ ...prev, loading: false }));
    }
  };

  const handleAnalyzeCleanup = async () => {
    if (!cleanRange.start || !cleanRange.end) {
      alert("Por favor seleccione un rango de fechas válido.");
      return;
    }
    setIsCleaning(true);
    setCleanSummary(null);

    try {
      const q = query(
        collection(db, 'reports'),
        where('fecha', '>=', cleanRange.start),
        where('fecha', '<=', cleanRange.end)
      );

      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const withFiles = docs.filter(d => d.storagePath || d.pdfUrl?.includes('supabase'));
      
      setCleanSummary({
        total: docs.length,
        withFiles: withFiles.length,
        estimatedSize: (withFiles.length * 0.5).toFixed(1),
        docs: docs
      });
    } catch (err) {
      console.error("Error analyzing:", err);
      alert("Error al analizar los datos.");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleExecuteCleanup = async () => {
    if (!cleanSummary) return;
    if (!window.confirm(`¿ESTÁ SEGURO? Esta acción es irreversible.\nSe eliminarán ${cleanOptions.records ? 'REGISTROS Y ARCHIVOS' : 'SOLO ARCHIVOS'} de ${cleanSummary.total} informes.`)) return;

    setIsCleaning(true);
    try {
      let filesDeleted = 0;
      let recordsDeleted = 0;

      if (cleanOptions.pdfs) {
        for (const docData of cleanSummary.docs) {
          const path = docData.storagePath;
          if (path) {
            const { error } = await supabase.storage.from('informescoat').remove([path]);
            if (!error) filesDeleted++;
          }
        }
      }

      if (cleanOptions.records) {
        const batch = writeBatch(db);
        cleanSummary.docs.forEach(d => {
          batch.delete(doc(db, 'reports', d.id));
          recordsDeleted++;
        });
        await batch.commit();
      } else if (cleanOptions.pdfs) {
        const batch = writeBatch(db);
        cleanSummary.docs.forEach(d => {
          if (d.storagePath) {
            batch.update(doc(db, 'reports', d.id), { 
              pdfUrl: null, 
              storagePath: null,
              notaMantenimiento: `Archivo eliminado por limpieza el ${new Date().toLocaleDateString()}` 
            });
          }
        });
        await batch.commit();
      }

      alert(`Limpieza completada:\n- Archivos borrados: ${filesDeleted}\n- Registros borrados: ${recordsDeleted}`);
      setCleanSummary(null);
      fetchStorageStats();
    } catch (err) {
      console.error("Error in cleanup:", err);
      alert("Ocurrió un error parcial durante la limpieza.");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleCleanOrphans = async () => {
    if (!window.confirm('¿Desea eliminar los archivos de ALMACENAMIENTO que NO tienen un informe asociado? (Esto NO borrará firmas)')) return;
    setIsCleaning(true);
    try {
      // 1. Obtener todos los archivos de Supabase (Raíz)
      const { data: files } = await supabase.storage.from('informescoat').list('', { limit: 1000 });
      if (!files || files.length === 0) {
        alert("No hay archivos en la raíz de Supabase.");
        return;
      }

      // 2. Obtener todos los storagePaths de Firebase (Informes)
      const fbSnap = await getDocs(collection(db, 'reports'));
      const activePaths = new Set(fbSnap.docs.map(doc => doc.data().storagePath).filter(Boolean));

      // 3. Obtener todas las firmas activas de Usuarios (Para protegerlas)
      const usersSnap = await getDocs(collection(db, 'users'));
      const signatureUrls = usersSnap.docs.map(doc => doc.data().signatureBase64).filter(Boolean);
      
      // 4. Identificar huérfanos con PROTECCIÓN
      const orphanedPaths = files
        .filter(f => {
          const name = f.name;
          // PROTECCIÓN 1: No borrar carpetas (metadata null en list suele ser carpeta)
          if (!f.metadata) return false;
          // PROTECCIÓN 2: No borrar la carpeta de firmas ni archivos dentro de ella (aunque list root no debería traerlos)
          if (name === 'firmas' || name === '.emptyFolderPlaceholder') return false;
          // PROTECCIÓN 3: Si es un reporte activo, ignorar
          if (activePaths.has(name)) return false;
          // PROTECCIÓN 4: Si por alguna razón la URL de una firma coincide con el nombre del archivo, proteger
          const isASignature = signatureUrls.some(url => url.includes(name));
          if (isASignature) return false;

          return true; // Es un huérfano real en la raíz
        })
        .map(f => f.name);

      if (orphanedPaths.length === 0) {
        alert("No se encontraron archivos huérfanos en la raíz.");
      } else {
        const { error } = await supabase.storage.from('informescoat').remove(orphanedPaths);
        if (error) {
          alert("Error de Supabase: " + error.message);
        } else {
          alert(`Limpieza protegida finalizada. Se borraron ${orphanedPaths.length} archivos huérfanos.`);
        }
      }
      
      setTimeout(() => fetchStorageStats(), 1500);
    } catch (err) {
      alert("Error crítico limpiando huérfanos: " + err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const tabs = [
    { id: 'users', label: 'Gestión de Usuarios', icon: <Users size={20} /> },
    { id: 'practices', label: 'Gestión de Prácticas', icon: <Stethoscope size={20} /> },
    { id: 'settings', label: 'Configuración', icon: <ShieldCheck size={20} /> },
    { id: 'maintenance', label: 'Mantenimiento', icon: <Settings2 size={20} /> },
  ];

  // Helper to get standardized user data
  const getStandardUser = (u) => {
    const role = u.role || 'médico';
    const isStaff = role === 'admin' || role === 'secre';
    return {
      nombre: (u.nombre || u.n || u.u || 'Sin nombre').toUpperCase().trim(),
      email: (u.email || u.e || u.u || '').toLowerCase().trim(),
      especialidad: isStaff ? '' : (u.especialidad || u.esp || 'Otorrinolaringólogo'),
      mp: isStaff ? '' : (u.mp || u.m || '-'),
      me: isStaff ? '' : (u.me || '-'),
      id: u.id,
      role: role,
      isOfficial: u.id.length === 28
    };
  };

  const handleDeleteUser = async (id) => {
    if (window.confirm('¿Eliminar este perfil profesional? (No elimina su cuenta de acceso de Firebase Auth)')) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }
  };

  const handleExcelUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const bstr = event.target.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);
        
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryExcel");
        const secondaryAuth = getAuth(secondaryApp);

        for (const item of data) {
          const userData = {
            nombre: (item.Profesional || item.Nombre || item.nombre || 'Profesional').trim(),
            mp: item.MP || item.mp || '-',
            me: item.ME || item.me || '-',
            especialidad: item.Especialidad || item.especialidad || 'ORL',
            u: (item.Usuario || item.usuario || 'user').toLowerCase().trim(),
            email: `${(item.Usuario || item.usuario || 'user').toLowerCase().trim()}@coat.com.ar`
          };
          const password = (item.Contraseña || item.contraseña || '123456').toString();
          
          try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.email, password);
            await setDoc(doc(db, 'users', userCredential.user.uid), { ...userData, isOfficial: true }, { merge: true });
            await signOut(secondaryAuth);
          } catch (authErr) {
            const userSlug = userData.email.replace(/[@.]/g, '_');
            await setDoc(doc(db, 'users', userSlug), userData, { merge: true });
          }
        }
        await deleteApp(secondaryApp);
        alert('Carga masiva finalizada');
      } catch (error) {
        alert('Error en Excel');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const handleSavePractice = async () => {
    if (!practiceForm.c || !practiceForm.n) return alert('Campos obligatorios');
    try {
      if (selectedPractice) {
        await updateDoc(doc(db, 'practices', selectedPractice.id), practiceForm);
        setSelectedPractice(null);
      } else {
        await addDoc(collection(db, 'practices'), practiceForm);
      }
      setPracticeForm({ c: '', n: '', b: '', st: true });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditPractice = (p) => {
    setSelectedPractice(p);
    setPracticeForm({ c: p.c, n: p.n, b: p.b, st: p.st !== undefined ? p.st : true });
  };

  const handleDeletePractice = async (id) => {
    if (window.confirm('¿Eliminar práctica?')) await deleteDoc(doc(db, 'practices', id));
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'config', 'settings'), {
        appsScriptUrl,
        adminEmail,
        token
      });
      alert('Configuración guardada correctamente');
    } catch (err) {
      alert('Error al guardar: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleManageUser = (user) => {
    setTargetProf({
      ...user,
      headerGeneral: user.headerGeneral || Array(8).fill(''),
      headerFibro: user.headerFibro || Array(8).fill(''),
      signatureBase64: user.signatureBase64 || null
    });
    setIsManageProfessionalModalOpen(true);
  };

  const handleSaveManagedUser = async () => {
    if (!targetProf) return;
    setIsProfSaving(true);
    try {
      await setDoc(doc(db, 'users', targetProf.id), targetProf, { merge: true });
      setIsManageProfessionalModalOpen(false);
      alert('Perfil actualizado');
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProfSaving(false);
    }
  };

  const handleManualUserCreate = async () => {
    if (!manualUserForm.nombre || !manualUserForm.u || !manualUserForm.password) {
      return alert('Completa nombre, usuario y contraseña');
    }

    const secondaryApp = initializeApp(firebaseConfig, "SecondaryManual");
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const email = `${manualUserForm.u.toLowerCase().trim()}@coat.com.ar`;
      const res = await createUserWithEmailAndPassword(secondaryAuth, email, manualUserForm.password);
      
      await setDoc(doc(db, 'users', res.user.uid), {
        nombre: manualUserForm.nombre.trim(),
        u: manualUserForm.u.toLowerCase().trim(),
        email: email,
        especialidad: 'Otorrinolaringólogo',
        mp: '-',
        me: '-',
        isOfficial: true,
        role: manualUserForm.role || 'médico'
      }, { merge: true });

      await signOut(secondaryAuth);
      setIsManualModalOpen(false);
      setManualUserForm({ nombre: '', mp: '', me: '', especialidad: '', u: '', password: '', role: 'médico' });
      alert('Usuario creado con éxito');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  const updateHeader = (key, i, value) => {
    const newHeader = [...targetProf[key]];
    newHeader[i] = value;
    setTargetProf({ ...targetProf, [key]: newHeader });
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !targetProf) return;

    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecciona una imagen válida.');
        return;
    }

    setIsUploadingSignature(true);
    try {
      const uid = targetProf.id || targetProf.uid; // targetProf has id or uid
      if (!uid) throw new Error("ID de profesional no encontrado");
      
      const fileExt = file.name.split('.').pop();
      const fileName = `firmas/${uid}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('informescoat')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('informescoat')
        .getPublicUrl(fileName);

      setTargetProf({ ...targetProf, signatureBase64: publicUrl });
    } catch (err) {
      console.error('Error uploading signature (admin):', err);
      alert('Error cargando firma: ' + err.message);
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const filteredUsers = users
    .map(u => ({ ...u, _std: getStandardUser(u) }))
    .filter(u => {
      const search = userSearch.toLowerCase();
      return u._std.nombre.toLowerCase().includes(search) || u._std.email.toLowerCase().includes(search);
    });

  const filteredPractices = practices.filter(p => 
    (p.n || '').toLowerCase().includes(practiceSearch.toLowerCase()) || 
    (p.c || '').toLowerCase().includes(practiceSearch.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in p-4 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-main">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Administración</h1>
          <p className="text-gray-500 font-medium">Control centralizado de usuarios y prácticas</p>
        </div>
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold transition-all text-sm ${
                activeTab === tab.id 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' 
                  : 'bg-[var(--bg-card)] text-[var(--text-sub)] hover:bg-[var(--hover-main)] border border-[var(--border-main)]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-slide-up">
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[var(--bg-card)] p-4 rounded-3xl shadow-sm border border-[var(--border-main)]">
              <div className="relative w-full md:w-96">
                <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar profesional..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="input-field pl-12"
                />
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 px-5 py-2.5 bg-green-100 dark:bg-green-900/20 text-green-600 rounded-2xl font-bold text-sm cursor-pointer hover:bg-green-200 transition-colors">
                  <FileUp size={18} />
                  <span>Importar Excel</span>
                  <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelUpload} />
                </label>
                <button onClick={() => setIsManualModalOpen(true)} className="btn-primary flex items-center gap-2 py-2.5">
                  <Plus size={18} />
                  <span>Nuevo</span>
                </button>
              </div>
            </div>

            {/* USER LIST (HORIZONTAL ACTION FORMAT) */}
            <div className="bg-[var(--bg-card)] rounded-[2.5rem] border border-[var(--border-main)] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 dark:bg-slate-900/50 border-b border-main">
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Médico</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Especialidad</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Estado</th>
                      <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, idx) => (
                      <tr key={user.id} className="border-b border-main/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center font-bold text-lg">
                              {user._std.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-[var(--text-main)] truncate">{user._std.nombre}</p>
                              <p className="text-xs text-gray-400 truncate">{user._std.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-[var(--text-sub)]">{user._std.especialidad}</span>
                          <div className="flex gap-2 mt-1">
                            {user._std.mp && <span className="text-[9px] font-mono text-gray-400">MP: {user._std.mp}</span>}
                            {user._std.me && <span className="text-[9px] font-mono text-gray-400">ME: {user._std.me}</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                            user._std.isOfficial ? 'bg-green-100 text-green-600' : 'bg-orange-100 text-orange-600'
                          }`}>
                            {user._std.isOfficial ? 'Oficial' : 'Provisorio'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => handleManageUser(user)}
                              className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                              title="Configurar Perfil"
                            >
                              <UserCog size={18} />
                            </button>
                            <button 
                              onClick={() => handleDeleteUser(user.id)}
                              className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                              title="Eliminar"
                            >
                              <Trash2 size={18} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'practices' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1">
              <div className="card p-8 bg-[var(--bg-card)] sticky top-8">
                <h3 className="text-xl font-bold flex items-center gap-2 mb-6">
                  {selectedPractice ? <Edit2 className="text-blue-500" /> : <Plus className="text-green-500" />}
                  {selectedPractice ? 'Editar Práctica' : 'Nueva Práctica'}
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-gray-400 ml-1">Código</label>
                    <input type="text" value={practiceForm.c} onChange={e => setPracticeForm({...practiceForm, c: e.target.value.toUpperCase()})} className="input-field" placeholder="Ej: OT01" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-gray-400 ml-1">Nombre</label>
                    <input type="text" value={practiceForm.n} onChange={e => setPracticeForm({...practiceForm, n: e.target.value})} className="input-field" placeholder="Ej: Rinoscopia" />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase text-gray-400 ml-1">Informe Base (Template)</label>
                    <textarea rows="8" value={practiceForm.b} onChange={e => setPracticeForm({...practiceForm, b: e.target.value})} className="input-field p-4 resize-none" placeholder="Texto que aparecerá por defecto..." />
                  </div>

                  <label className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={practiceForm.st}
                      onChange={e => setPracticeForm({...practiceForm, st: e.target.checked})}
                      className="w-5 h-5 rounded border-blue-200 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-blue-900">Incluir título "INFORME DE..."</span>
                      <span className="text-[10px] text-blue-700/70">Si se desactiva, se podrá poner un título manual.</span>
                    </div>
                  </label>
                  <button onClick={handleSavePractice} className="btn-primary w-full py-4 mt-2 font-black uppercase tracking-widest text-xs">
                    {selectedPractice ? 'Actualizar Práctica' : 'Guardar Nueva Práctica'}
                  </button>
                </div>
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <div className="bg-[var(--bg-card)] rounded-[2.5rem] border border-main overflow-hidden">
                <div className="p-6 border-b border-main flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2"><ClipboardList size={20} className="text-blue-500" /> Catálogo de Prácticas</h3>
                  <div className="relative w-48">
                    <SearchIcon size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input type="text" placeholder="Filtrar..." className="input-field pl-9 py-1.5 text-xs" value={practiceSearch} onChange={e => setPracticeSearch(e.target.value)} />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-50/30 dark:bg-slate-900/30 text-[10px] uppercase font-black tracking-widest text-gray-400 border-b border-main">
                        <th className="px-6 py-4">Cód.</th>
                        <th className="px-6 py-4">Práctica</th>
                        <th className="px-6 py-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPractices.map(p => (
                        <tr key={p.id} className="border-b border-main/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-blue-600 text-xs">{p.c}</td>
                          <td className="px-6 py-4 font-medium text-sm">{p.n}</td>
                          <td className="px-6 py-4 text-right space-x-1">
                            <button onClick={() => handleEditPractice(p)} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={16} /></button>
                            <button onClick={() => handleDeletePractice(p.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto">
            <div className="card p-10 bg-[var(--bg-card)] border-main shadow-lg space-y-8">
              <div className="flex items-center gap-4 border-b border-main pb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                  <Mail size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">Configuración del Sistema</h3>
                  <p className="text-gray-400">Parámetros globales de correo y servicios externos</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase text-gray-400 ml-1 flex items-center gap-2">
                    <ExternalLink size={14} /> URL de Google Apps Script (Envío de Mails)
                  </label>
                  <input 
                    type="text" 
                    value={appsScriptUrl} 
                    onChange={e => setAppsScriptUrl(e.target.value)} 
                    className="input-field font-mono text-sm" 
                    placeholder="https://script.google.com/macros/s/.../exec"
                  />
                  <p className="text-[10px] text-gray-400 ml-1">Este enlace comunica la app con el servidor de correos de Google.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase text-gray-400 ml-1 flex items-center gap-2">
                    <Mail size={14} /> Email para Copias (Destinatario)
                  </label>
                  <input 
                    type="email" 
                    value={adminEmail} 
                    onChange={e => setAdminEmail(e.target.value)} 
                    className="input-field" 
                    placeholder="consultas@coat.com.ar"
                  />
                  <p className="text-[10px] text-gray-400 ml-1">Aquí llegará una copia automática de cada informe enviado por los médicos.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase text-gray-400 ml-1 flex items-center gap-2">
                    <Key size={14} /> Token de Seguridad (Opcional)
                  </label>
                  <input 
                    type="password" 
                    value={token} 
                    onChange={e => setToken(e.target.value)} 
                    className="input-field" 
                    placeholder="••••••••"
                  />
                </div>

                <div className="pt-6">
                  <button 
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="btn-primary w-full py-5 flex items-center justify-center gap-3 shadow-xl shadow-blue-500/30"
                  >
                    {isSavingSettings ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                    <span className="text-base uppercase tracking-widest">Guardar Cambios</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-8 max-w-5xl mx-auto">
            {/* Monitor de Almacenamiento */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="card p-6 bg-[var(--bg-card)] border-main flex flex-col items-center text-center space-y-2">
                <Database className="text-blue-500 mb-2" size={32} />
                <h4 className="text-[10px] font-black uppercase text-gray-400">Firebase (Base de Datos)</h4>
                {storageStats.loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    <span className="text-3xl font-black">{storageStats.fbCount}</span>
                    <span className="text-[10px] text-gray-500 italic">Registros ({storageStats.fbSize} KB aprox)</span>
                  </>
                )}
              </div>
              <div className="card p-6 bg-[var(--bg-card)] border-main flex flex-col items-center text-center space-y-2">
                <FileUp className="text-purple-500 mb-2" size={32} />
                <h4 className="text-[10px] font-black uppercase text-gray-400">Supabase (Archivos)</h4>
                {storageStats.loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    <span className="text-3xl font-black">{storageStats.sbCount}</span>
                    <span className="text-[10px] text-gray-500 italic">Archivos (.pdf) en almacenamiento</span>
                  </>
                )}
              </div>
              <div className="card p-6 bg-[var(--bg-card)] border-main flex flex-col items-center text-center space-y-2">
                <Trash2 className="text-orange-500 mb-2" size={32} />
                <h4 className="text-[10px] font-black uppercase text-gray-400">Espacio Ocupado (Files)</h4>
                {storageStats.loading ? <Loader2 className="animate-spin" /> : (
                  <>
                    <span className="text-3xl font-black text-orange-500">{storageStats.sbSize} MB</span>
                    <span className="text-[10px] text-gray-500 italic">De 1024 MB disponibles (Tier Free)</span>
                  </>
                )}
              </div>
            </div>

            {/* Herramienta de Limpieza por Lotes */}
            <div className="card p-10 bg-[var(--bg-card)] border-main shadow-lg space-y-8">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-black">Limpieza Manual por Fecha</h3>
                  <p className="text-gray-400 text-sm">Libere espacio eliminando informes o archivos antiguos.</p>
                </div>
                <button 
                  onClick={fetchStorageStats} 
                  className="p-3 bg-blue-500/5 hover:bg-blue-500/10 rounded-full text-blue-500 transition-colors"
                  title="Recargar estadísticas"
                >
                  <RefreshCw size={20} className={storageStats.loading ? 'animate-spin' : ''} />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                {/* Selector de Rango */}
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Fecha Inicio</label>
                      <input 
                        type="date" 
                        value={cleanRange.start} 
                        onChange={e => setCleanRange({...cleanRange, start: e.target.value})}
                        className="input-field" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-500 ml-1">Fecha Fin</label>
                      <input 
                        type="date" 
                        value={cleanRange.end} 
                        onChange={e => setCleanRange({...cleanRange, end: e.target.value})}
                        className="input-field" 
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <label className="flex items-center gap-3 p-4 bg-blue-500/5 rounded-2xl border border-blue-500/10 cursor-pointer hover:bg-blue-500/10 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={cleanOptions.pdfs} 
                        onChange={e => setCleanOptions({...cleanOptions, pdfs: e.target.checked})}
                        className="w-5 h-5 rounded border-blue-200 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold uppercase">Eliminar Archivos PDFs</span>
                        <span className="text-[10px] text-gray-400">Libera espacio en Supabase pero mantiene el registro.</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-red-500/5 rounded-2xl border border-red-500/10 cursor-pointer hover:bg-red-500/10 transition-colors group">
                      <input 
                        type="checkbox" 
                        checked={cleanOptions.records} 
                        onChange={e => setCleanOptions({...cleanOptions, records: e.target.checked})}
                        className="w-5 h-5 rounded border-red-200 text-red-600 focus:ring-red-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-red-600 uppercase">Eliminar Registros de Base de Datos</span>
                        <span className="text-[10px] text-red-400">CUIDADO: Borra el informe definitivamente del historial.</span>
                      </div>
                    </label>
                  </div>

                  <button 
                    onClick={handleAnalyzeCleanup}
                    disabled={isCleaning}
                    className="w-full py-5 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 transition-all flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
                  >
                    {isCleaning ? <Loader2 className="animate-spin" /> : <Search size={20} />}
                    Analizar Rango Seleccionado
                  </button>
                </div>

                {/* Resultado de Simulación */}
                <div className="bg-slate-500/5 rounded-3xl border border-main p-8 flex flex-col justify-center min-h-[300px]">
                  {cleanSummary ? (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
                      <div className="text-center">
                        <CheckCircle2 className="mx-auto text-green-500 mb-4" size={48} />
                        <h4 className="text-xl font-bold">Análisis Completo</h4>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-white/50 dark:bg-black/20 rounded-2xl border border-main text-center">
                          <p className="text-[10px] font-black text-gray-500 uppercase">Informes Totales</p>
                          <p className="text-2xl font-black">{cleanSummary.total}</p>
                        </div>
                        <div className="p-4 bg-white/50 dark:bg-black/20 rounded-2xl border border-main text-center font-bold">
                          <p className="text-[10px] font-black text-gray-500 uppercase">Con Archivo Adjunto</p>
                          <p className="text-2xl font-black text-blue-500">{cleanSummary.withFiles}</p>
                        </div>
                      </div>

                      <div className="p-5 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-center">
                        <p className="text-[10px] font-black text-blue-500 uppercase tracking-tighter">Espacio a recuperar estimado</p>
                        <p className="text-3xl font-black text-blue-600">~ {cleanSummary.estimatedSize} MB</p>
                      </div>

                      <button 
                        onClick={handleExecuteCleanup}
                        disabled={isCleaning}
                        className="w-full py-5 bg-red-600 hover:bg-red-700 text-white font-black rounded-[1.5rem] transition-all shadow-xl shadow-red-600/30 flex items-center justify-center gap-3 uppercase tracking-widest"
                      >
                        {isCleaning ? <Loader2 className="animate-spin" size={20} /> : <Trash2 size={20} />}
                        Confirmar y Ejecutar Limpieza
                      </button>
                      <p className="text-[10px] text-center text-red-500/50 uppercase font-black">Esta acción es permanente e irreversible</p>
                    </div>
                  ) : (
                    <div className="text-center space-y-4 opacity-30 text-gray-400">
                      <Search size={64} className="mx-auto" />
                      <div>
                        <p className="font-bold text-lg">Sin análisis activo</p>
                        <p className="text-xs">Seleccione un rango y presione "Analizar" para ver qué se liberará.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Otras Acciones */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
              <div className="p-8 bg-blue-500/5 rounded-[2.5rem] border border-blue-500/20 space-y-4">
                <ShieldCheck size={40} className="text-blue-500" />
                <h4 className="text-lg font-bold">Migración de IDs</h4>
                <p className="text-xs text-slate-400 leading-relaxed italic">Convierte perfiles temporales basados en slugs de email a IDs definitivos de Firebase Auth.</p>
                <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-600/20">Ejecutar Migración</button>
              </div>

              <div className="p-8 bg-purple-500/5 rounded-[2.5rem] border border-purple-500/20 space-y-4">
                <FileUp size={40} className="text-purple-500" />
                <h4 className="text-lg font-bold">Limpiar Archivos Huérfanos</h4>
                <p className="text-xs text-slate-400 leading-relaxed italic">Elimina archivos en Supabase que no tienen un informe asociado en la base de datos.</p>
                <button 
                  onClick={handleCleanOrphans}
                  disabled={isCleaning}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-purple-600/20 flex items-center justify-center gap-2"
                >
                  {isCleaning ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />}
                  Limpiar Almacenamiento
                </button>
              </div>
              
              <div className="p-8 bg-red-500/5 rounded-[2.5rem] border border-red-500/20 space-y-4">
                <Trash2 size={40} className="text-red-500" />
                <h4 className="text-lg font-bold">Nivela Base de Datos</h4>
                <p className="text-xs text-slate-400 leading-relaxed italic">Elimina todos los perfiles excepto el administrador. Útil para re-importaciones masivas.</p>
                <button className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-600/20">Wipe All (Except Admin)</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL: MANAGE PROFESSIONAL PROFILE */}
      <AnimatePresence>
        {isManageProfessionalModalOpen && targetProf && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-hidden">
            <motion.div 
               initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
               className="bg-[var(--bg-card)] w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[var(--border-main)] flex flex-col"
            >
              <div className="p-6 border-b border-main flex items-center justify-between bg-[var(--bg-card)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <UserCog size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[var(--text-main)]">Configurar Perfil: {targetProf.nombre}</h3>
                    <p className="text-xs text-gray-500">Ajuste de membretes y datos oficiales</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsPreviewOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                  >
                    <FileText size={16} /> Ver Vista Previa
                  </button>
                  <button onClick={() => setIsManageProfessionalModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-500">
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nombre</label>
                    <input type="text" value={targetProf.nombre} onChange={e => setTargetProf({...targetProf, nombre: e.target.value})} className="input-field" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Especialidad</label>
                    <input type="text" value={targetProf.especialidad} onChange={e => setTargetProf({...targetProf, especialidad: e.target.value})} className="input-field" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">MP</label>
                    <input type="text" value={targetProf.mp} onChange={e => setTargetProf({...targetProf, mp: e.target.value})} className="input-field" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">ME</label>
                    <input type="text" value={targetProf.me} onChange={e => setTargetProf({...targetProf, me: e.target.value})} className="input-field" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1 font-black text-blue-500">Rol de Acceso</label>
                    <select 
                      className="input-field" 
                      value={targetProf.role || 'médico'} 
                      onChange={e => setTargetProf({...targetProf, role: e.target.value})}
                    >
                      <option value="médico">Médico (Solo sus informes)</option>
                      <option value="médico_admin">Médico Admin (Acceso total)</option>
                      <option value="secre">Secretaría (Carga datos)</option>
                    </select>
                  </div>
                </div>

                {/* Signature Section in Admin */}
                <div className="space-y-4 pt-4 border-t border-main">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Firma Digital (PNG)</label>
                  <div className="flex items-center gap-6">
                    <div className="w-40 h-24 bg-white rounded-xl border-2 border-dashed border-main flex items-center justify-center relative overflow-hidden group">
                      {isUploadingSignature ? (
                        <div className="flex flex-col items-center gap-1 text-blue-500">
                           <Loader2 size={24} className="animate-spin" />
                           <span className="text-[8px] font-bold uppercase">Subiendo</span>
                        </div>
                      ) : targetProf.signatureBase64 ? (
                        <img src={targetProf.signatureBase64} alt="firma" className="max-w-full max-h-full object-contain" />
                      ) : (
                        <div className="text-gray-300 flex flex-col items-center">
                          <Upload size={20} />
                          <span className="text-[8px] font-bold">Subir PNG</span>
                        </div>
                      )}
                      {!isUploadingSignature && (
                        <input type="file" accept="image/*" onChange={handleSignatureUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
                      )}
                    </div>
                    {targetProf.signatureBase64 && (
                      <button 
                        onClick={() => setTargetProf({...targetProf, signatureBase64: null})}
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-colors"
                      >
                        Eliminar Firma
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-400 italic">Esta firma se utilizará para generar los reportes en PDF del profesional.</p>
                </div>

                {/* Headers */}
                <div className="space-y-4">
                   <div className="flex gap-4 border-b border-main">
                      <button 
                        onClick={() => setPreviewType('general')}
                        className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${previewType === 'general' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400'}`}
                      >
                        Membrete General
                      </button>
                      <button 
                         onClick={() => setPreviewType('fibro')}
                         className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${previewType === 'fibro' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400'}`}
                      >
                        Membrete Fibroscopía
                      </button>
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--bg-secondary)] p-6 rounded-3xl border border-main">
                      {Array(8).fill(0).map((_, i) => (
                        <div key={i} className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 ml-1 uppercase tracking-tight">Línea {i+1} {i === 0 ? '(Principal)' : (i < 3 ? '(Secundaria)' : '(Pie)')}</label>
                          <input 
                            type="text" 
                            className="input-field text-sm" 
                            value={previewType === 'general' ? (targetProf.headerGeneral?.[i] || '') : (targetProf.headerFibro?.[i] || '')}
                            onChange={(e) => updateTargetHeader(previewType, i, e.target.value)}
                            placeholder={`Texto línea ${i+1}...`}
                          />
                        </div>
                      ))}
                   </div>
                </div>
              </div>

              <div className="p-8 border-t border-main flex gap-4 bg-[var(--bg-card)]">
                <button 
                  onClick={handleSaveManagedUser}
                  disabled={isProfSaving}
                  className="btn-primary flex-1 py-4 font-black flex items-center justify-center gap-2"
                >
                  {isProfSaving ? <Loader2 className="animate-spin" /> : <Save size={20} />}
                  GUARDAR CAMBIOS EN PERFIL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: PREVIEW (SINCRO WITH PDF) */}
      <AnimatePresence>
        {isPreviewOpen && targetProf && (
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-12 bg-slate-900/90 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-[210mm] min-h-[80mm] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden relative border border-gray-400 flex flex-col p-[15mm]"
            >
              <div className="flex border-b-2 border-slate-200 pb-[5mm] mb-[5mm]">
                {/* Logo Area */}
                <div className="w-[45mm] flex items-center justify-center pr-10 border-r border-slate-100">
                   {targetProf.logoBase64 ? (
                     <img src={targetProf.logoBase64} className="max-w-full max-h-full object-contain" alt="logo" />
                   ) : (
                     <div className="text-slate-200 text-[10pt] font-sans font-bold uppercase tracking-tighter text-center">Espacio para Logo</div>
                   )}
                </div>

                {/* Header Text Area */}
                <div className="flex-1 flex flex-col justify-center">
                    {(previewType === 'general' ? (targetProf.headerGeneral || []) : (targetProf.headerFibro || [])).map((line, i) => {
                      if (!line) return null;
                      
                      let fontSize = '9pt';
                      let fontWeight = '400';
                      let marginBottom = '1mm';
                      if (i === 0) { fontSize = '16pt'; fontWeight = '700'; marginBottom = '3mm'; }
                      else if (i < 3) { fontSize = '11pt'; fontWeight = '600'; }

                      return (
                        <p key={i} style={{ 
                          fontSize, 
                          fontWeight, 
                          textAlign: 'center', 
                          margin: 0,
                          marginBottom,
                          color: '#000000',
                          fontFamily: 'sans-serif'
                        }}>
                          {line}
                        </p>
                      );
                    })}
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-slate-200 uppercase tracking-[0.5rem] font-bold text-sm">Contenido editable del informe</p>
              </div>

              {/* Close Button UI */}
              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-6 right-6 w-12 h-12 bg-red-500 text-white rounded-full shadow-2xl hover:bg-red-600 transition-all flex items-center justify-center active:scale-90"
              >
                <X size={28} />
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: MANUAL USER CREATE */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
               className="bg-[var(--bg-card)] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-[var(--border-main)]"
            >
              <div className="p-6 border-b border-main flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2"><UserPlus /> Nuevo Profesional</h3>
                <button onClick={() => setIsManualModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
              </div>
              <div className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                   <div className="col-span-2 space-y-1">
                      <label className="text-xs font-bold uppercase opacity-40 ml-1">Nombre Completo</label>
                      <input type="text" value={manualUserForm.nombre} onChange={e => setManualUserForm({...manualUserForm, nombre: e.target.value})} className="input-field" placeholder="Dr. Nome Apellido" />
                   </div>
                   <div className="col-span-1 space-y-1">
                      <label className="text-xs font-bold uppercase opacity-40 ml-1">Usuario</label>
                      <input type="text" value={manualUserForm.u} onChange={e => setManualUserForm({...manualUserForm, u: e.target.value})} className="input-field" placeholder="usuario_coat" />
                   </div>
                   <div className="col-span-1 space-y-1">
                      <label className="text-xs font-bold uppercase opacity-40 ml-1">Contraseña</label>
                      <input type="password" value={manualUserForm.password} onChange={e => setManualUserForm({...manualUserForm, password: e.target.value})} className="input-field" placeholder="******" />
                   </div>
                   <div className="col-span-2 space-y-1">
                      <label className="text-xs font-bold uppercase opacity-40 ml-1">Rol de Acceso</label>
                      <select 
                        value={manualUserForm.role} 
                        onChange={e => setManualUserForm({...manualUserForm, role: e.target.value})}
                        className="input-field appearance-none cursor-pointer"
                      >
                        <option value="médico">Médico (Solo sus informes)</option>
                        <option value="fonoaudiología">Fonoaudiología (Solo sus informes)</option>
                        <option value="secretaría">Secretaría (Solo lectura)</option>
                        <option value="admin">Administrador (Control Total)</option>
                      </select>
                   </div>
                </div>
                <button onClick={handleManualUserCreate} className="btn-primary w-full py-4 mt-4 font-black">CREAR CUENTA PROFESIONAL</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AdminPage;
