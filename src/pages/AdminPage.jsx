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
  Search as SearchIcon
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
  limit
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
      
      // Deduplicate by email/user to avoid double entries during migration
      const uniqueUsers = {};
      list.forEach(u => {
        // Try to find a common identifier (email or username)
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
          
          // Prioritize record with name
          if (currentHasName && !existingHasName) {
            uniqueUsers[key] = u;
          } 
          // If both have name or both don't, prioritize Official (UID length 28)
          else if (currentHasName === existingHasName && u.id.length === 28) {
            uniqueUsers[key] = u;
          }
        }
      });
      setUsers(Object.values(uniqueUsers).filter(u => u.nombre || u.n || u.email || u.e || u.u));
      setLoading(false);
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
    { id: 'settings', label: 'Configuración', icon: <ShieldCheck size={20} /> },
    { id: 'maintenance', label: 'Mantenimiento', icon: <Settings2 size={20} /> },
  ];

  // Helper to get standardized user data
  const getStandardUser = (u) => {
    return {
      nombre: u.nombre || u.n || 'Sin nombre',
      email: (u.email || u.e || u.u || '').toLowerCase().trim(),
      especialidad: u.especialidad || u.esp || 'Otorrinolaringólogo',
      mp: u.mp || u.m || '-',
      me: u.me || '-',
      id: u.id,
      role: u.role || 'médico',
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
      setPracticeForm({ c: '', n: '', b: '' });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditPractice = (p) => {
    setSelectedPractice(p);
    setPracticeForm({ c: p.c, n: p.n, b: p.b });
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
        role: 'médico'
      }, { merge: true });

      await signOut(secondaryAuth);
      setIsManualModalOpen(false);
      setManualUserForm({ nombre: '', mp: '', me: '', especialidad: '', u: '', password: '' });
      alert('Usuario creado con éxito');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  const updateTargetHeader = (type, index, value) => {
    const key = type === 'general' ? 'headerGeneral' : 'headerFibro';
    const newHeader = [...targetProf[key]];
    newHeader[index] = value;
    setTargetProf({ ...targetProf, [key]: newHeader });
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
                            <span className="text-[9px] font-mono text-gray-400">MP: {user._std.mp}</span>
                            <span className="text-[9px] font-mono text-gray-400">ME: {user._std.me}</span>
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

        {/* Similar cleanup for other tabs (practices, settings, maintenance) ... */}
        {/* Keeping current functionality intact in the background while updating UI */}
        
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
          <div className="card p-10 space-y-8 max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800">
            <div className="text-center space-y-2">
              <h3 className="text-2xl font-black text-white">Herramientas de Mantenimiento</h3>
              <p className="text-slate-400">Acciones críticas de base de datos y migración</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-8 bg-blue-500/5 rounded-[2rem] border border-blue-500/20 space-y-4">
                <ShieldCheck size={40} className="text-blue-500" />
                <h4 className="text-lg font-bold text-white">Migración de IDs</h4>
                <p className="text-xs text-slate-400 leading-relaxed italic">Convierte perfiles temporales basados en slugs de email a IDs definitivos de Firebase Auth.</p>
                <button className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-600/20">Ejecutar Migración</button>
              </div>
              
              <div className="p-8 bg-red-500/5 rounded-[2rem] border border-red-500/20 space-y-4">
                <Trash2 size={40} className="text-red-500" />
                <h4 className="text-lg font-bold text-white">Nivela Base de Datos</h4>
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
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--bg-card)] w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[var(--border-main)] flex flex-col"
            >
              <div className="p-6 border-b border-main flex items-center justify-between bg-[var(--bg-card)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-xl flex items-center justify-center">
                    <UserCog size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Configurar Perfil: {targetProf.nombre}</h3>
                    <p className="text-xs text-gray-500">Ajuste de membretes y datos oficiales</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsPreviewOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 text-[var(--text-main)] rounded-xl font-bold text-xs hover:bg-slate-200 transition-colors"
                  >
                    <FileText size={16} /> Vista Previa
                  </button>
                  <button onClick={() => setIsManageProfessionalModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full text-gray-500">
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
                      value={targetProf.role || 'médico'} 
                      onChange={e => setTargetProf({...targetProf, role: e.target.value})}
                      className="input-field appearance-none cursor-pointer"
                    >
                      <option value="médico">Médico (Solo sus informes)</option>
                      <option value="fonoaudiología">Fonoaudiología (Solo sus informes)</option>
                      <option value="secretaría">Secretaría (Ve todo, no crea/edita)</option>
                      <option value="admin">Administrador (Control Total)</option>
                    </select>
                  </div>
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

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--bg-card)] p-6 rounded-3xl border border-main">
                      {Array(8).fill(0).map((_, i) => (
                        <div key={i} className="space-y-1">
                          <label className="text-[9px] font-bold text-gray-400 ml-1">Línea {i+1} {i === 0 ? '(Principal)' : (i < 3 ? '(Secundaria)' : '(Pie)')}</label>
                          <input 
                            type="text" 
                            className="input-field text-sm" 
                            value={previewType === 'general' ? targetProf.headerGeneral[i] : targetProf.headerFibro[i]}
                            onChange={(e) => updateTargetHeader(previewType, i, e.target.value)}
                            placeholder={`Línea ${i+1}...`}
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
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-[210mm] h-[60mm] shadow-2xl overflow-hidden relative border border-gray-200 rounded-lg flex"
            >
              {/* Logo Area (Approx PDF coords 10,8) */}
              <div className="w-[45mm] h-full flex items-center justify-center p-4 relative">
                 {targetProf.logoBase64 ? (
                   <img src={targetProf.logoBase64} className="max-w-full max-h-full object-contain" alt="logo" />
                 ) : (
                   <div className="w-full h-full border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 font-bold">LOGO</div>
                 )}
              </div>

              {/* Text Area (Aligned with PDF logic) */}
              <div className="flex-1 p-6 flex flex-col justify-start">
                  {(previewType === 'general' ? targetProf.headerGeneral : targetProf.headerFibro).map((line, i) => {
                    if (!line) return <div key={i} style={{ height: (i < 3 ? '1.2rem' : '0.9rem') }}></div>;
                    
                    let fontSize = '7.5pt';
                    let fontWeight = 'normal';
                    if (i === 0) { fontSize = '11pt'; fontWeight = 'bold'; }
                    else if (i < 3) { fontSize = '10pt'; }

                    return (
                      <p key={i} style={{ 
                        fontSize, 
                        fontWeight, 
                        textAlign: 'center', 
                        lineHeight: '1.2',
                        margin: 0,
                        color: '#000'
                      }}>
                        {line}
                      </p>
                    );
                  })}
              </div>

              <button 
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 p-2 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors"
              >
                <X size={20} />
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
                </div>
                <button onClick={handleManualUserCreate} className="btn-primary w-full py-4 mt-4 font-black">CREAR CUENTA</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AdminPage;
