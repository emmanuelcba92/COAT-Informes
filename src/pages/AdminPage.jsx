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
  BookOpen
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
  setDoc
} from 'firebase/firestore';

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
  const [manualUserForm, setManualUserForm] = useState({ nombre: '', mp: '', me: '', especialidad: '', u: '', password: '' });
  const [loading, setLoading] = useState(true);
  
  // State for Users
  const [users, setUsers] = useState([]);
  const [userSearch, setUserSearch] = useState('');

  // State for Practices
  const [practices, setPractices] = useState([]);
  const [practiceSearch, setPracticeSearch] = useState('');
  const [practiceForm, setPracticeForm] = useState({ c: '', n: '', b: '' });
  const [selectedPractice, setSelectedPractice] = useState(null);

  // State for Managing Professional Profile
  const [isManageProfessionalModalOpen, setIsManageProfessionalModalOpen] = useState(false);
  const [targetProf, setTargetProf] = useState(null);
  const [isProfSaving, setIsProfSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState('general'); // 'general' or 'fibro'
  
  // State for Managing Professional MODELS (Personal Practices)
  const [isModelsModalOpen, setIsModelsModalOpen] = useState(false);
  const [targetUserForModels, setTargetUserForModels] = useState(null);
  const [isModelsSaving, setIsModelsSaving] = useState(false);
  const [editingModelId, setEditingModelId] = useState(null);
  const [modelForm, setModelForm] = useState({ n: '', b: '' });

  // Real-time synchronization
  useEffect(() => {
    setLoading(true);
    
    // Sync Practices
    const qPractices = query(collection(db, 'practices'), orderBy('n', 'asc'));
    const unsubscribePractices = onSnapshot(qPractices, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPractices(list);
      setLoading(false);
    });

    // Sync Users
    const qUsers = query(collection(db, 'users'), orderBy('u', 'asc'));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Deduplicate by email/user to avoid double entries during migration
      const uniqueUsers = {};
      list.forEach(u => {
        const key = (u.e || u.u || u.id).toLowerCase();
        // If we have doc with UID (id same as no special chars basically or 28 chars), prefer it
        if (!uniqueUsers[key] || u.id.length === 28) {
          uniqueUsers[key] = u;
        }
      });
      setUsers(Object.values(uniqueUsers));
    });

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

  const tabs = [
    { id: 'users', label: 'Gestión de Usuarios', icon: <Users size={20} /> },
    { id: 'practices', label: 'Gestión de Prácticas', icon: <Stethoscope size={20} /> },
    { id: 'settings', label: 'Configuración de Sistema', icon: <ShieldCheck size={20} /> },
    { id: 'maintenance', label: 'Mantenimiento', icon: <Settings2 size={20} /> },
  ];

  // Helper to get standardized user data
  const getStandardUser = (u) => {
    return {
      nombre: u.nombre || u.n || 'Sin nombre',
      email: (u.email || u.e || u.u || '').toLowerCase(),
      especialidad: u.especialidad || u.esp || 'Médico Otorrinolaringólogo',
      mp: u.mp || u.m || '-',
      me: u.me || '-',
      id: u.id,
      role: u.role || 'médico',
      isOfficial: u.id.length === 28
    };
  };

  const handleMigrateIds = async () => {
    if (!window.confirm('¿Deseas migrar los perfiles antiguos a IDs oficiales de Firebase? Esto unirá duplicados y arreglará perfiles en blanco.')) return;
    setLoading(true);
    try {
      let migrated = 0;
      const slugs = users.filter(u => (u.id.includes('@') || u.id.includes('_')) && u.id.length !== 28);
      
      for (const u of slugs) {
        const std = getStandardUser(u);
        const email = std.email;
        if (email) {
          const officialUser = users.find(x => x.id.length === 28 && getStandardUser(x).email === email);
          
          if (officialUser) {
            console.log(`Migrating ${u.id} to ${officialUser.id}`);
            // Merge data (prefer official one but keep headers from slug if official is empty)
            const merged = {
              ...u,
              ...officialUser,
              headerGeneral: (officialUser.headerGeneral?.some(l => l) ? officialUser.headerGeneral : u.headerGeneral) || Array(8).fill(''),
              headerFibro: (officialUser.headerFibro?.some(l => l) ? officialUser.headerFibro : u.headerFibro) || Array(8).fill(''),
              signatureBase64: officialUser.signatureBase64 || u.signatureBase64,
              email: email, // Standardize email field
              nombre: officialUser.nombre || u.nombre || u.n || 'Médico',
              id: officialUser.id // Ensure we use UID
            };
            await setDoc(doc(db, 'users', officialUser.id), merged, { merge: true });
            await deleteDoc(doc(db, 'users', u.id));
            migrated++;
          }
        }
      }
      alert(`Mantenimiento completado. Se migraron ${migrated} registros.`);
    } catch (err) {
      alert('Error en mantenimiento: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWipeAllExceptAdmin = async () => {
    const adminEmailToKeep = 'egomez@coat.com.ar';
    if (!window.confirm(`¡ADVERTENCIA CRÍTICA!\n\nEsta acción eliminará TODOS los perfiles profesionales registrados en la base de datos excepto los vinculados al correo (${adminEmailToKeep}).\n\n¿Estás absolutamente seguro de continuar?`)) return;
    
    setLoading(true);
    try {
      let deleted = 0;
      // We use the full 'users' list from state to ensure we catch everything including items filtered from view
      for (const u of users) {
        const std = getStandardUser(u);
        if (std.email !== adminEmailToKeep) {
          await deleteDoc(doc(db, 'users', u.id));
          deleted++;
        }
      }
      alert(`Limpieza completada. Se eliminaron ${deleted} perfiles. El sistema ahora está limpio.`);
    } catch (err) {
      alert('Error en limpieza: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Logic for Users
  const handleDeleteUser = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar los datos de este usuario? (Esto no elimina su cuenta de acceso, solo su perfil profesional)')) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (err) {
        alert('Error al eliminar usuario: ' + err.message);
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
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Map and Upload
        let count = 0;
        let authCreated = 0;
        const secondaryApp = initializeApp(firebaseConfig, "SecondaryExcel");
        const secondaryAuth = getAuth(secondaryApp);

        for (const item of data) {
          const userData = {
            nombre: item.Profesional || item.Nombre || item.nombre || (item.Usuario || 'Profesional'),
            mp: item.MP || item.mp || '-',
            me: item.ME || item.me || '-',
            especialidad: item.Especialidad || item.especialidad || 'Médico Otorrinolaringólogo',
            u: (item.Usuario || item.usuario || (item.nombre || 'user')).toLowerCase().trim(),
            e: item.Email || item.email || `${(item.Usuario || item.usuario || 'user').toLowerCase().trim()}@coat.com.ar`,
            m: item.Matricula || item.Matrícula || item.matricula || '-'
          };
          const password = item.Contraseña || item.contraseña || item.Contra || item.contra;
          
          if (password && password.toString().length >= 6) {
            try {
              const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.e, password.toString());
              const uid = userCredential.user.uid;
              await setDoc(doc(db, 'users', uid), { ...userData, role: 'médico' }, { merge: true });
              await signOut(secondaryAuth);
              authCreated++;
            } catch (authErr) {
               console.warn("Auth creation bypass:", authErr.code);
               const userSlug = userData.e.replace(/[@.]/g, '_');
               await setDoc(doc(db, 'users', userSlug), { ...userData, role: 'médico' }, { merge: true });
            }
          } else {
             const userSlug = userData.e.replace(/[@.]/g, '_');
             await setDoc(doc(db, 'users', userSlug), { ...userData, role: 'médico' }, { merge: true });
          }
          count++;
        }
        await deleteApp(secondaryApp);

        alert(`¡Éxito! Se importaron ${count} perfiles y se crearon ${authCreated} accesos.`);
      } catch (error) {
        console.error("Excel import error:", error);
        alert('Error al procesar el Excel. Formato requerido: Nombre, Especialidad, MP, ME, Usuario.');
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; 
  };

  const handleBulkPasteImport = async () => {
    if (!pasteData.trim()) return;

    try {
      const rows = pasteData.trim().split('\n');
      let count = 0;
      let authCreated = 0;

      // Initialize secondary app to create users without logging out admin
      const secondaryApp = initializeApp(firebaseConfig, "Secondary");
      const secondaryAuth = getAuth(secondaryApp);

      for (const row of rows) {
        const columns = row.split('\t');
        if (columns.length < 5) continue; 

        const userData = {
          nombre: (columns[0] || '').trim(),
          mp: (columns[1] || '').trim(),
          me: (columns[2] || '').trim(),
          especialidad: (columns[3] || '').trim() || 'Médico Otorrinolaringólogo',
          u: (columns[4] || '').toLowerCase().trim(),
          e: `${(columns[4] || '').toLowerCase().trim()}@coat.com.ar`,
          m: (columns[1] || '').trim()
        };
        const password = columns[5] ? columns[5].trim() : null;
        if (!userData.u || userData.u === 'usuario') continue; 

        // Create in Auth if password provided
        if (password && password.length >= 6) {
          try {
            const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.e, password);
            const uid = userCredential.user.uid;
            await setDoc(doc(db, 'users', uid), { ...userData, role: 'médico' }, { merge: true });
            await signOut(secondaryAuth); // Sign out from secondary app immediately
            authCreated++;
          } catch (authErr) {
            console.warn(`Auth creation failed for ${userData.e}:`, authErr.code);
            const userSlug = userData.e.replace(/[@.]/g, '_');
            await setDoc(doc(db, 'users', userSlug), { ...userData, role: 'médico' }, { merge: true });
          }
        } else {
          const userSlug = userData.e.replace(/[@.]/g, '_');
          await setDoc(doc(db, 'users', userSlug), { ...userData, role: 'médico' }, { merge: true });
        }
        
        count++;
      }
      
      await deleteApp(secondaryApp);

      alert(`¡Proceso completado!\n- ${count} perfiles en base de datos.\n- ${authCreated} accesos nuevos creados en Firebase.`);
      setIsBulkModalOpen(false);
      setPasteData('');
    } catch (error) {
      console.error("Paste error:", error);
      alert('Error al procesar los datos. Asegúrate de copiar el rango completo desde Excel.');
    }
  };

  const handleManualUserCreate = async () => {
    if (!manualUserForm.u || !manualUserForm.nombre || !manualUserForm.password) {
      alert('Nombre, Usuario y Contraseña son obligatorios');
      return;
    }

    try {
      const userData = {
        nombre: manualUserForm.nombre,
        mp: manualUserForm.mp || '-',
        me: manualUserForm.me || '-',
        especialidad: manualUserForm.especialidad || 'Médico Otorrinolaringólogo',
        u: manualUserForm.u.toLowerCase().trim(),
        e: `${manualUserForm.u.toLowerCase().trim()}@coat.com.ar`,
        m: manualUserForm.mp || '-'
      };
      
      // 1. Create in Auth First to get UID
      if (manualUserForm.password.length >= 6) {
        try {
          const secondaryApp = initializeApp(firebaseConfig, "ManualCreate");
          const secondaryAuth = getAuth(secondaryApp);
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, userData.e, manualUserForm.password);
          const uid = userCredential.user.uid;
          
          await setDoc(doc(db, 'users', uid), { ...userData, role: 'médico' }, { merge: true });
          
          await signOut(secondaryAuth);
          await deleteApp(secondaryApp);
          alert('Usuario creado correctamente con acceso habilitado');
        } catch (authErr) {
          console.warn("Auth creation bypass/failure:", authErr.code);
          const userSlug = userData.e.replace(/[@.]/g, '_');
          await setDoc(doc(db, 'users', userSlug), { ...userData, role: 'médico' }, { merge: true });
          alert('Usuario creado en base de datos (Error en Auth: ' + authErr.code + ')');
        }
      } else {
        const userSlug = userData.e.replace(/[@.]/g, '_');
        await setDoc(doc(db, 'users', userSlug), { ...userData, role: 'médico' }, { merge: true });
        alert('Perfil creado (sin contraseña de acceso)');
      }

      setIsManualModalOpen(false);
      setManualUserForm({ nombre: '', mp: '', me: '', especialidad: '', u: '', password: '' });
    } catch (error) {
      alert('Error al crear usuario: ' + error.message);
    }
  };

  // Logic for Practices
  const handleSavePractice = async () => {
    if (!practiceForm.c || !practiceForm.n) {
      alert('Código y Nombre son obligatorios');
      return;
    }

    try {
      if (selectedPractice) {
        // Update Firestore
        const docRef = doc(db, 'practices', selectedPractice.id);
        await updateDoc(docRef, {
          c: practiceForm.c,
          n: practiceForm.n,
          b: practiceForm.b
        });
        setSelectedPractice(null);
      } else {
        // Create Firestore
        await addDoc(collection(db, 'practices'), {
          c: practiceForm.c,
          n: practiceForm.n,
          b: practiceForm.b
        });
      }
      setPracticeForm({ c: '', n: '', b: '' });
    } catch (err) {
      alert('Error al guardar práctica: ' + err.message);
    }
  };

  const handleEditPractice = (practice) => {
    setSelectedPractice(practice);
    setPracticeForm({ c: practice.c, n: practice.n, b: practice.b });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePractice = async (id) => {
    if (window.confirm('¿Eliminar esta práctica de la base de datos?')) {
      try {
        await deleteDoc(doc(db, 'practices', id));
        if (selectedPractice?.id === id) {
          setSelectedPractice(null);
          setPracticeForm({ c: '', n: '', b: '' });
        }
      } catch (err) {
        alert('Error al eliminar: ' + err.message);
      }
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
      // Standardize data before save
      const cleanData = {
        ...targetProf,
        nombre: targetProf.nombre || targetProf.n || 'Médico',
        email: (targetProf.email || targetProf.e || targetProf.u || '').toLowerCase(),
        especialidad: targetProf.especialidad || targetProf.esp || 'Médico Otorrinolaringólogo',
        mp: targetProf.mp || targetProf.m || '-',
        m: targetProf.mp || targetProf.m || '-', // keep m for legacy but prefer mp
      };
      
      // Remove legacy fields if they exist to keep the doc clean
      delete cleanData.esp;
      delete cleanData.n;
      delete cleanData.e;
      delete cleanData.u;

      await setDoc(doc(db, 'users', targetProf.id), cleanData, { merge: true });
      alert('Perfil del profesional actualizado correctamente');
      setIsManageProfessionalModalOpen(false);
    } catch (err) {
      console.error("Save error:", err);
      alert('Error al guardar: ' + err.message);
    } finally {
      setIsProfSaving(false);
    }
  };

  const handleManageModels = (user) => {
    setTargetUserForModels(user);
    setEditingModelId(null);
    setModelForm({ n: '', b: '', practiceId: '' });
    setIsModelsModalOpen(true);
  };

  const handleSaveModel = async () => {
    if (!targetUserForModels || !modelForm.practiceId || !modelForm.b) return;
    setIsModelsSaving(true);
    try {
      const currentModels = targetUserForModels.personalPractices || {};
      const modelId = modelForm.practiceId;
      
      const updatedModels = {
        ...currentModels,
        [modelId]: {
          ...modelForm,
          id: modelId
        }
      };

      await updateDoc(doc(db, 'users', targetUserForModels.id), {
        personalPractices: updatedModels
      });
      
      setTargetUserForModels({
        ...targetUserForModels,
        personalPractices: updatedModels
      });
      
      setEditingModelId(null);
      setModelForm({ n: '', b: '', practiceId: '' });
    } catch (err) {
      alert('Error al guardar modelo: ' + err.message);
    } finally {
      setIsModelsSaving(false);
    }
  };

  const handleDeleteModel = async (modelId) => {
    if (!targetUserForModels || !window.confirm('¿Eliminar este personalizado? Se volverá al texto base.')) return;
    try {
      const currentModels = { ...targetUserForModels.personalPractices };
      delete currentModels[modelId];

      await updateDoc(doc(db, 'users', targetUserForModels.id), {
        personalPractices: currentModels
      });

      setTargetUserForModels({
        ...targetUserForModels,
        personalPractices: currentModels
      });
    } catch (err) {
      alert('Error al eliminar personalizado');
    }
  };

  const updateTargetHeader = (type, index, value) => {
    if (!targetProf) return;
    const key = type === 'general' ? 'headerGeneral' : 'headerFibro';
    const newHeader = [...targetProf[key]];
    newHeader[index] = value;
    setTargetProf({ ...targetProf, [key]: newHeader });
  };

  const filteredUsers = users
    .map(u => ({ ...u, _std: getStandardUser(u) }))
    .filter(u => {
      // Search logic
      const search = userSearch.toLowerCase();
      const matchesSearch = 
        u._std.nombre.toLowerCase().includes(search) || 
        u._std.email.toLowerCase().includes(search) ||
        u.id.toLowerCase().includes(search);

      if (!matchesSearch) return false;

      // Deduplication logic: Hide legacy slug if an official UID version exists
      if (!u._std.isOfficial && u._std.email) {
        const hasOfficial = users.some(x => x.id.length === 28 && x.id !== u.id && (x.email || x.e || x.u || '').toLowerCase() === u._std.email);
        if (hasOfficial) return false;
      }
      return true;
    });

  const filteredPractices = practices.filter(p => 
    (p.n || '').toLowerCase().includes(practiceSearch.toLowerCase()) || 
(p.c || '').toLowerCase().includes(practiceSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-outfit">Administración</h1>
          <p className="text-gray-500">Panel de control centralizado del sistema</p>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="flex flex-wrap gap-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold transition-all ${
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

      {/* Main Content Sections */}
      <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[var(--bg-card)] p-4 rounded-3xl shadow-sm border border-[var(--border-main)] animate-fade-in">
              <div className="relative w-full md:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text"
                  placeholder="Buscar profesional por nombre o email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border-main)] focus:ring-2 focus:ring-blue-500/50 text-[var(--text-main)] outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-2 w-full md:w-auto">
                <div className="relative group">
                  <label className="flex items-center gap-2 px-4 py-2 bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 text-green-600 dark:text-green-400 rounded-xl font-bold text-sm cursor-pointer hover:bg-green-100 transition-colors">
                    <FileUp size={18} />
                    <span>Importar Excel</span>
                    <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleExcelUpload} />
                  </label>
                  <div className="absolute top-full right-0 mt-2 w-64 p-3 bg-slate-800 text-white text-[10px] rounded-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] shadow-xl border border-slate-700">
                    <p className="font-bold mb-1 border-b border-slate-700 pb-1">Columnas requeridas:</p>
                    <p>Nombre • MP • ME • Especialidad • Usuario • Contraseña</p>
                    <p className="mt-2 opacity-60 text-[9px] italic">* El sistema creará el perfil y el acceso automáticamente</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsManualModalOpen(true)}
                  className="btn-primary flex items-center gap-2 py-2"
                >
                  <Plus size={18} />
                  <span>Nuevo Usuario</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredUsers.map((user, idx) => (
                <div 
                  key={user.id} 
                  className="card p-6 group hover:border-blue-500/50 transition-all animate-fade-in"
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-2xl flex items-center justify-center font-bold text-xl">
                        {user._std.nombre.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-lg leading-tight truncate">{user._std.nombre}</h4>
                        <p className="text-sm text-gray-400 font-medium truncate">{user._std.email || 'Sin email'}</p>
                        <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{user._std.isOfficial ? 'ID Cuenta' : 'ID Provisorio'}</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button 
                        onClick={() => handleManageUser(user)}
                        className="p-2 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
                        title="Gestionar Perfil"
                      >
                        <UserCog size={18} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
                        title="Eliminar Perfil"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                      <Mail size={16} />
                      <span className="truncate">{user.u || user.e || 'Sin email'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-[var(--text-sub)]">
                      <Briefcase size={16} className="text-blue-500" />
                      <span className="bg-blue-600/10 text-blue-600 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        {user.especialidad || user.esp || 'Sin especialidad'}
                      </span>
                    </div>
                    {(user.mp || user.me) && (
                      <div className="flex items-center gap-3 text-[11px] text-gray-400 font-medium">
                        <FileText size={16} />
                        {user.mp && <span>MP: {user.mp}</span>}
                        {user.me && <span>ME: {user.me}</span>}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="card p-8 animate-fade-in space-y-6">
            <div className="flex items-center gap-3 border-b border-main pb-4">
              <Settings2 className="text-blue-500" size={32} />
              <div>
                <h3 className="text-xl font-bold">Mantenimiento de Base de Datos</h3>
                <p className="text-gray-500 text-sm">Herramientas para corregir errores de migración y duplicados</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-blue-50 dark:bg-blue-900/10 rounded-3xl border border-blue-100 dark:border-blue-900/30 space-y-4">
                <h4 className="font-bold flex items-center gap-2">
                  <ShieldCheck size={20} /> Migrar IDs de Correo a UID
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Detecta perfiles que usan el email como identificador (slugs antiguos) y los mueve al ID oficial de Firebase. 
                  Esto soluciona el error de "Perfil en Blanco" para los profesionales.
                </p>
                <button 
                  onClick={handleMigrateIds}
                  className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                >
                  Ejecutar Migración de IDs
                </button>
              </div>

              <div className="p-6 bg-red-50 dark:bg-red-900/10 rounded-3xl border border-red-100 dark:border-red-900/30 space-y-4">
                <h4 className="font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                  <Trash2 size={20} /> Limpieza Total de Usuarios
                </h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Elimina TODOS los perfiles de la base de datos de una sola vez, manteniendo únicamente la cuenta de administrador (egomez).
                  Útil para reiniciar el sistema si se borraron cuentas de acceso manualmente.
                </p>
                <button 
                  onClick={handleWipeAllExceptAdmin}
                  className="w-full py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-500/20"
                >
                  Nivelar Base de Datos (Borrar Todo)
                </button>
              </div>

            </div>
          </div>
        )}

        {activeTab === 'practices' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
            {/* Form to add/edit */}
            <div className="lg:col-span-1">
              <div className="card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-main pb-2 mb-4">
                  <h3 className="text-lg font-bold">
                    {selectedPractice ? 'Editar Práctica' : 'Nueva Práctica'}
                  </h3>
                  {selectedPractice && (
                    <button 
                      onClick={() => {
                        setSelectedPractice(null);
                        setPracticeForm({ c: '', n: '', b: '' });
                      }}
                      className="p-1 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full text-gray-400"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase opacity-60">Código</label>
                    <input 
                      type="text" 
                      placeholder="Ej: OT01" 
                      className="input-field" 
                      value={practiceForm.c}
                      onChange={e => setPracticeForm({...practiceForm, c: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase opacity-60">Nombre de la Práctica</label>
                    <input 
                      type="text" 
                      placeholder="Ej: Otomicroscopia" 
                      className="input-field" 
                      value={practiceForm.n}
                      onChange={e => setPracticeForm({...practiceForm, n: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase opacity-60">Cuerpo del Informe (Template)</label>
                    <textarea 
                      rows="10" 
                      placeholder="Contenido por defecto..." 
                      className="input-field resize-none"
                      value={practiceForm.b}
                      onChange={e => setPracticeForm({...practiceForm, b: e.target.value})}
                    ></textarea>
                  </div>
                  <button 
                    className="btn-primary w-full flex items-center justify-center gap-2"
                    onClick={handleSavePractice}
                  >
                    {selectedPractice ? <Save size={18} /> : <Plus size={18} />}
                    {selectedPractice ? 'Actualizar Práctica' : 'Guardar Práctica'}
                  </button>
                </div>
              </div>
            </div>

            {/* List of practices */}
            <div className="lg:col-span-2">
              <div className="card">
                <div className="p-4 border-b border-main flex items-center justify-between">
                  <h3 className="font-bold">Prácticas Registradas</h3>
                  <div className="relative w-48">
                    <Search size={14} className="absolute left-3 top-2.5 text-gray-400" />
                    <input 
                      type="text" 
                      placeholder="Filtrar..." 
                      className="input-field pl-8 py-1.5 text-xs" 
                      value={practiceSearch}
                      onChange={e => setPracticeSearch(e.target.value)}
                    />
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-[var(--bg-secondary)] text-[10px] uppercase font-bold tracking-widest border-b border-main text-gray-400">
                      <tr>
                        <th className="px-6 py-4">Cód.</th>
                        <th className="px-6 py-4">Nombre</th>
                        <th className="px-6 py-4 text-center">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y border-main">
                      {filteredPractices.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs">{p.c}</td>
                          <td className="px-6 py-4 text-sm font-semibold">{p.n}</td>
                          <td className="px-6 py-4">
                            <div className="flex justify-center gap-2">
                              <button 
                                className={`p-1.5 rounded-md transition-colors ${selectedPractice?.id === p.id ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                onClick={() => handleEditPractice(p)}
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                className="p-1.5 text-gray-400 hover:text-red-500 rounded-md hover:bg-red-50 transition-colors"
                                onClick={() => handleDeletePractice(p.id)}
                              >
                                <Trash2 size={14} />
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
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
            <div className="card p-6 flex flex-col">
              <div className="flex-1 space-y-4">
                <h3 className="flex items-center gap-2 text-lg font-bold border-b border-gray-100 dark:border-slate-800 pb-2 mb-4">
                  <Mail size={20} className="text-blue-500" />
                  Configuración de Email y Alertas
                </h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Email de Gestión (Informes y Recuperación)</label>
                    <input 
                      type="email" 
                      placeholder="administracion@coat.com.ar" 
                      className="input-field"
                      value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60">Webhook de Automatización (Google Apps Script)</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="https://script.google.com/macros/s/..." 
                        className="input-field flex-1"
                        value={appsScriptUrl}
                        onChange={e => setAppsScriptUrl(e.target.value)}
                      />
                      <button 
                        onClick={() => appsScriptUrl && window.open(appsScriptUrl, '_blank')}
                        className="p-2 bg-gray-100 dark:bg-slate-800 rounded-lg text-gray-400 hover:text-blue-500 transition-colors"
                      >
                        <ExternalLink size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold uppercase opacity-60 flex items-center gap-2">
                      <ShieldCheck size={12} /> Security Token (Para Webhook)
                    </label>
                    <input 
                      type="password" 
                      placeholder="Ingrese su clave secreta del webhook..." 
                      className="input-field font-mono"
                      value={token}
                      onChange={e => setToken(e.target.value)}
                    />
                  </div>
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl text-blue-700 dark:text-blue-300 text-xs flex gap-3">
                    <Mail size={32} className="opacity-50 flex-shrink-0" />
                    <div>
                      <p className="font-bold mb-1">Guia de Funcionamiento:</p>
                      <ul className="list-disc list-inside space-y-1 opacity-80">
                        <li>El <b>Email de Gestión</b> recibe copias de todos los informes generados.</li>
                        <li>El <b>Webhook</b> procesa el envío automático de correos a pacientes.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="pt-6 mt-4 border-t border-main">
                <button 
                  onClick={async () => {
                    setIsSavingSettings(true);
                    try {
                      await setDoc(doc(db, 'config', 'settings'), {
                        adminEmail,
                        appsScriptUrl,
                        token,
                        updatedAt: new Date().toISOString()
                      }, { merge: true });
                      alert('Configuración guardada correctamente');
                    } catch (err) {
                      console.error(err);
                      alert('Error al guardar la configuración');
                    } finally {
                      setIsSavingSettings(false);
                    }
                  }}
                  disabled={isSavingSettings}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  {isSavingSettings ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                  Guardar Cambios de Sistema
                </button>
              </div>
            </div>

            <div className="card p-6">
              <h3 className="flex items-center gap-2 text-lg font-bold border-b border-gray-100 dark:border-slate-800 pb-2 mb-4">
                <ShieldCheck size={20} className="text-green-500" />
                Seguridad Global
              </h3>
              <div className="space-y-4">
                <p className="text-sm text-gray-500">Opciones para forzar restablecimiento de claves masivo o cambiar políticas de acceso.</p>
                <button className="w-full py-2.5 px-4 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 font-bold border border-red-100 dark:border-red-900/30 rounded-xl transition-all">
                  Restablecer TODAS las claves
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Bulk Paste Modal */}
      <AnimatePresence>
        {isBulkModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[var(--bg-card)] border border-main w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-main flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <ClipboardList className="text-blue-500" />
                  Importación Masiva (Excel)
                </h3>
                <button onClick={() => setIsBulkModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <p className="text-sm opacity-70">
                  Copia los datos de tu Excel incluyendo las 6 columnas en este orden: <br/> 
                  <span className="font-bold text-blue-500">Nombre • MP • ME • Especialidad • Usuario • Contraseña</span>
                </p>
                <textarea 
                  className="w-full h-64 bg-[var(--bg-page)] border-2 border-dashed border-main rounded-2xl p-4 text-xs font-mono outline-none focus:border-blue-500 transition-all placeholder:opacity-30"
                  placeholder="Pega aquí los datos de Excel..."
                  value={pasteData}
                  onChange={(e) => setPasteData(e.target.value)}
                />
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-2xl flex gap-3 text-xs text-blue-700 dark:text-blue-300">
                  <div className="font-bold">Nota:</div>
                  <p>Asegúrate de que el orden de las columnas sea el mismo que en tu Excel para mayor precisión.</p>
                </div>
              </div>

              <div className="p-6 border-t border-main flex justify-end gap-3">
                <button onClick={() => setIsBulkModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold">Cancelar</button>
                <button 
                  onClick={handleBulkPasteImport}
                  disabled={!pasteData.trim()}
                  className="btn-primary px-8"
                >
                  Procesar Datos
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manual User Modal */}
      <AnimatePresence>
        {isManualModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-[var(--bg-card)] border border-main w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-main flex items-center justify-between">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <UserPlus className="text-blue-500" />
                  Nuevo Profesional
                </h3>
                <button onClick={() => setIsManualModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-bold uppercase opacity-60">Nombre Completo</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Dr. Juan Perez"
                      value={manualUserForm.nombre}
                      onChange={e => setManualUserForm({...manualUserForm, nombre: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase opacity-60">MP</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="12345"
                      value={manualUserForm.mp}
                      onChange={e => setManualUserForm({...manualUserForm, mp: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase opacity-60">ME</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="6789"
                      value={manualUserForm.me}
                      onChange={e => setManualUserForm({...manualUserForm, me: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-bold uppercase opacity-60">Especialidad</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="Médico Otorrinolaringólogo"
                      value={manualUserForm.especialidad}
                      onChange={e => setManualUserForm({...manualUserForm, especialidad: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase opacity-60">Usuario (para login)</label>
                    <input 
                      type="text" 
                      className="input-field" 
                      placeholder="juan.perez"
                      value={manualUserForm.u}
                      onChange={e => setManualUserForm({...manualUserForm, u: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase opacity-60">Contraseña</label>
                    <input 
                      type="password" 
                      className="input-field" 
                      placeholder="••••••••"
                      value={manualUserForm.password}
                      onChange={e => setManualUserForm({...manualUserForm, password: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-main flex justify-end gap-3">
                <button onClick={() => setIsManualModalOpen(false)} className="px-6 py-2 text-gray-500 font-bold">Cancelar</button>
                <button 
                  onClick={handleManualUserCreate}
                  className="btn-primary px-8"
                >
                  Crear Usuario
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Managed Professional Modal */}
      <AnimatePresence>
        {isManageProfessionalModalOpen && targetProf && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-[var(--bg-card)] border border-main w-full max-w-5xl h-[90vh] rounded-3xl shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-main flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center font-bold text-lg">
                    {targetProf.u?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold">Gestionar Profesional: {targetProf.nombre}</h3>
                    <p className="text-xs text-gray-400">Edición administrativa de perfil, membretes y firmas</p>
                  </div>
                </div>
                <button onClick={() => setIsManageProfessionalModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-8">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {/* Identidad */}
                  <div className="space-y-6">
                    <section className="space-y-4">
                      <h4 className="flex items-center gap-2 font-bold text-sm uppercase text-gray-500 tracking-wider">
                        <Briefcase size={16} /> Datos de Identidad
                      </h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase opacity-50">Nombre Completo</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            value={targetProf.nombre} 
                            onChange={e => setTargetProf({...targetProf, nombre: e.target.value})}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase opacity-50">Especialidad</label>
                          <input 
                            type="text" 
                            className="input-field" 
                            value={targetProf.especialidad || ''} 
                            onChange={e => setTargetProf({...targetProf, especialidad: e.target.value})}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase opacity-50">MP</label>
                            <input 
                              type="text" 
                              className="input-field font-mono" 
                              value={targetProf.mp} 
                              onChange={e => setTargetProf({...targetProf, mp: e.target.value})}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase opacity-50">ME</label>
                            <input 
                              type="text" 
                              className="input-field font-mono" 
                              value={targetProf.me} 
                              onChange={e => setTargetProf({...targetProf, me: e.target.value})}
                            />
                          </div>
                        </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase opacity-50">Rol de Sistema</label>
                            <select 
                              className="input-field"
                              value={targetProf.role || 'médico'}
                              onChange={e => setTargetProf({...targetProf, role: e.target.value})}
                            >
                              <option value="médico">Personal Médico</option>
                              <option value="Administrador">Administrador</option>
                            </select>
                          </div>
                      </div>
                    </section>

                    <section className="space-y-4 pt-4 border-t border-main">
                      <h4 className="flex items-center gap-2 font-bold text-sm uppercase text-gray-500 tracking-wider">
                        <Upload size={16} /> Firma Digital activa
                      </h4>
                      <div className="aspect-video bg-[var(--bg-page)] rounded-2xl border-2 border-dashed border-main flex items-center justify-center p-4">
                        {targetProf.signatureBase64 ? (
                          <img src={targetProf.signatureBase64} alt="Firma" className="max-h-full object-contain" />
                        ) : (
                          <p className="text-[10px] text-gray-400">Sin firma configurada</p>
                        )}
                      </div>
                      <p className="text-[9px] text-gray-400 text-center italic">El administrador solo puede ver o eliminar la firma. El profesional debe subirla desde su perfil.</p>
                      {targetProf.signatureBase64 && (
                        <button 
                          onClick={() => setTargetProf({...targetProf, signatureBase64: null})}
                          className="w-full py-2 text-red-500 text-xs font-bold hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg"
                        >
                          Eliminar Firma
                        </button>
                      )}
                    </section>
                  </div>

                    <div className="space-y-8">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="flex items-center gap-2 font-bold text-sm uppercase text-gray-500 tracking-wider">
                            <div className="w-3 h-3 rounded-full bg-blue-500" /> Membrete General (8 líneas)
                          </h4>
                          <button 
                            onClick={() => { setPreviewType('general'); setIsPreviewOpen(true); }}
                            className="text-[10px] font-bold text-blue-500 hover:underline"
                          >
                            VISTA PREVIA
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {(targetProf.headerGeneral || Array(8).fill('')).map((line, idx) => (
                            <input 
                              key={`mgen-${idx}`}
                              type="text" 
                              placeholder={`Línea ${idx + 1}`}
                              className="input-field py-1.5 text-xs h-9"
                              value={line}
                              onChange={e => updateTargetHeader('general', idx, e.target.value)}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Membrete Fibro */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="flex items-center gap-2 font-bold text-sm uppercase text-gray-500 tracking-wider">
                            <div className="w-3 h-3 rounded-full bg-purple-500" /> Membrete Fibroscopia
                          </h4>
                          <button 
                            onClick={() => { setPreviewType('fibro'); setIsPreviewOpen(true); }}
                            className="text-[10px] font-bold text-purple-500 hover:underline"
                          >
                            VISTA PREVIA
                          </button>
                        </div>
                        <div className="space-y-1.5">
                          {(targetProf.headerFibro || Array(8).fill('')).map((line, idx) => (
                            <input 
                              key={`mfib-${idx}`}
                              type="text" 
                              placeholder={`Línea ${idx + 1}`}
                              className="input-field py-1.5 text-xs h-9"
                              value={line}
                              onChange={e => updateTargetHeader('fibro', idx, e.target.value)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-main flex justify-end gap-3 flex-shrink-0 bg-[var(--bg-page)]/50">
                  <button 
                    onClick={() => setIsManageProfessionalModalOpen(false)} 
                    className="px-6 py-2 text-gray-500 font-bold hover:text-gray-700"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSaveManagedUser}
                    disabled={isProfSaving}
                    className="btn-primary px-10 flex items-center gap-2"
                  >
                    {isProfSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                    Guardar Perfil Profesional
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Managed Models Modal */}
        <AnimatePresence>
          {isModelsModalOpen && targetUserForModels && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[var(--bg-card)] border border-main w-full max-w-4xl max-h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="p-6 border-b border-main flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full flex items-center justify-center">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Modelos: {targetUserForModels.nombre}</h3>
                      <p className="text-xs text-gray-400">Prácticas personalizadas y textos predefinidos para este profesional</p>
                    </div>
                  </div>
                  <button onClick={() => setIsModelsModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                    <X size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Form to add/edit model */}
                  <div className="space-y-4">
                    <div className="bg-[var(--bg-page)] p-5 rounded-2xl border border-main space-y-4">
                      <h4 className="font-bold text-sm uppercase text-gray-500 tracking-wider">
                        {editingModelId ? 'Editar Personalizado' : 'Personalizar Práctica Base'}
                      </h4>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase opacity-50">Seleccionar Práctica</label>
                          <select 
                            className="input-field"
                            disabled={!!editingModelId}
                            value={modelForm.practiceId || ''}
                            onChange={e => {
                              const p = practices.find(px => px.id === e.target.value);
                              if (p) {
                                setModelForm({ 
                                  practiceId: p.id, 
                                  n: p.n, 
                                  b: targetUserForModels.personalPractices?.[p.id]?.b || p.b 
                                });
                              }
                            }}
                          >
                            <option value="">-- Eliga una práctica --</option>
                            {practices.map(p => (
                              <option key={p.id} value={p.id}>{p.n} ({p.c})</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase opacity-50">Texto Personalizado para el Informe</label>
                          <textarea 
                            className="input-field min-h-[180px] text-xs resize-none" 
                            placeholder="Ingrese el texto que este médico usará por defecto para esta práctica..."
                            value={modelForm.b}
                            onChange={e => setModelForm({...modelForm, b: e.target.value})}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={handleSaveModel}
                            disabled={isModelsSaving || !modelForm.practiceId || !modelForm.b}
                            className="btn-primary flex-1 py-2 flex items-center justify-center gap-2"
                          >
                            {isModelsSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                            {editingModelId ? 'Actualizar' : 'Guardar Personalización'}
                          </button>
                          {editingModelId && (
                            <button 
                              onClick={() => { setEditingModelId(null); setModelForm({n:'', b:'', practiceId:''}); }}
                              className="px-4 py-2 border border-main rounded-xl text-xs hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* List of models */}
                  <div className="space-y-4">
                    <h4 className="font-bold text-sm uppercase text-gray-500 tracking-wider flex items-center gap-2">
                      <BookOpen size={16} /> Modelos Activos ({Object.keys(targetUserForModels.personalPractices || {}).length})
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(targetUserForModels.personalPractices || {}).length === 0 ? (
                        <div className="p-8 text-center bg-gray-50 dark:bg-slate-800/50 rounded-2xl border border-dashed border-main">
                          <p className="text-gray-400 text-xs italic">No hay modelos personalizados cargados aún.</p>
                        </div>
                      ) : (
                        Object.entries(targetUserForModels.personalPractices).map(([id, m]) => (
                          <div key={id} className="p-4 bg-[var(--bg-card)] border border-main rounded-2xl flex items-center justify-between hover:shadow-md transition-all group">
                            <div className="flex-1 min-w-0 pr-4">
                              <h5 className="font-bold text-sm truncate">{m.n}</h5>
                              <p className="text-[10px] text-gray-400 truncate opacity-60">{m.b}</p>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => { setEditingModelId(id); setModelForm({ n: m.n, b: m.b }); }}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/10 rounded-lg"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button 
                                onClick={() => handleDeleteModel(id)}
                                className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-main bg-[var(--bg-page)]/50 flex justify-end">
                  <button 
                    onClick={() => setIsModelsModalOpen(false)}
                    className="btn-primary px-12"
                  >
                    Finalizar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
      </AnimatePresence>

      {/* MODAL DE VISTA PREVIA ADMINISTRATIVA */}
      <AnimatePresence>
        {isPreviewOpen && targetProf && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[90vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/20 text-slate-900 dark:text-slate-100"
            >
              <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${previewType === 'general' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Vista Previa Profesionales</h3>
                    <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">Simulación A4 • Profesional: {targetProf.nombre}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-8 bg-slate-100 dark:bg-slate-950 flex justify-center">
                <div className="bg-white text-slate-800 w-[210mm] min-h-[297mm] shadow-xl p-[20mm] flex flex-col font-serif relative">
                  <div className="text-center space-y-0.5 mb-16 border-b-2 border-slate-100 pb-8">
                    {(previewType === 'general' ? targetProf.headerGeneral : targetProf.headerFibro).map((line, i) => (
                      <div key={i} className={`min-h-[1.2rem] ${i === 0 ? 'text-2xl font-bold uppercase mb-2' : 'text-sm'}`}>
                        {line}
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 opacity-10">
                    <h2 className="text-xl font-bold uppercase mb-8 border-b border-slate-200 inline-block">Ejemplo de Informe</h2>
                    <div className="space-y-4">
                      <div className="h-4 bg-slate-500 rounded w-full" />
                      <div className="h-4 bg-slate-500 rounded w-[95%]" />
                      <div className="h-4 bg-slate-500 rounded w-[90%]" />
                    </div>
                  </div>

                  <div className="mt-24 self-end text-center flex flex-col items-center min-w-[200px]">
                    {targetProf.signatureBase64 ? (
                      <img src={targetProf.signatureBase64} alt="Firma" className="max-h-24 w-auto mb-2 object-contain mix-blend-multiply" />
                    ) : (
                      <div className="h-24" />
                    )}
                    <div className="border-t border-slate-400 pt-2 w-full">
                      <p className="font-bold uppercase text-sm">{targetProf.nombre}</p>
                      <p className="text-[11px] leading-tight">{targetProf.especialidad}</p>
                      <p className="text-[10px] mt-1">MP {targetProf.mp} | ME {targetProf.me}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex justify-center text-[11px] font-medium text-gray-500 italic">
                * Simulación de diseño para {previewType === 'general' ? 'Informes Generales' : 'Fibroscopias'}.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPage;
