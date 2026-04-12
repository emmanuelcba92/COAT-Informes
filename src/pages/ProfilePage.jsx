import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Save, 
  Upload, 
  Trash2, 
  FileCheck, 
  FileText, 
  User as UserIcon,
  CreditCard,
  LogOut,
  ChevronRight,
  Menu,
  Briefcase,
  Key,
  Eye,
  X as CloseIcon,
  Lock,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Search
} from 'lucide-react';
import { db, auth } from '../services/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

const ProfilePage = () => {
  const [profile, setProfile] = useState({
    nombre: '',
    especialidad: '',
    mp: '',
    me: '',
    headerGeneral: Array(8).fill(''),
    headerFibro: Array(8).fill(''),
    signatureBase64: null,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState('general'); 
  const [isSaving, setIsSaving] = useState(false);
  
  // Password Change State
  const [showPassModal, setShowPassModal] = useState(false);
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isChangingPass, setIsChangingPass] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const user = auth.currentUser;
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      try {
        const uid = user.uid;
        const email = (user.email || '').toLowerCase().trim();
        const docRef = doc(db, 'users', uid);
        let docSnap = await getDoc(docRef);
        
        let profileData = docSnap.exists() ? docSnap.data() : null;

        // Fallback Logic (same as before)
        if (!profileData && email) {
          const legacyId = email.replace(/[@.]/g, '_');
          const legacyRef = doc(db, 'users', legacyId);
          const legacySnap = await getDoc(legacyRef);
          if (legacySnap.exists()) profileData = legacySnap.data();
        }

        if (!profileData && email) {
          const usersRef = collection(db, 'users');
          const q1 = query(usersRef, where('e', '==', email), limit(1));
          const q2 = query(usersRef, where('email', '==', email), limit(1));
          const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
          const foundDoc = s1.docs[0] || s2.docs[0];
          if (foundDoc) profileData = foundDoc.data();
        }

        if (profileData) {
          const cleanProfile = {
            nombre: profileData.nombre || profileData.n || '',
            especialidad: profileData.especialidad || profileData.esp || '',
            mp: profileData.mp || profileData.m || '',
            me: profileData.me || '',
            headerGeneral: profileData.headerGeneral || Array(8).fill(''),
            headerFibro: profileData.headerFibro || Array(8).fill(''),
            signatureBase64: profileData.signatureBase64 || null,
            email: email,
            role: profileData.role || 'médico'
          };
          setProfile(cleanProfile);
          await setDoc(docRef, { ...cleanProfile, isOfficial: true }, { merge: true });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [auth.currentUser]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPass !== confirmPass) return setPassError('Las contraseñas no coinciden');
    if (newPass.length < 6) return setPassError('Mínimo 6 caracteres');
    setIsChangingPass(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPass);
      setPassSuccess('¡Contraseña actualizada!');
      setTimeout(() => setShowPassModal(false), 2000);
    } catch (err) {
      setPassError(err.code === 'auth/wrong-password' ? 'Contraseña actual incorrecta' : 'Error al actualizar');
    } finally {
      setIsChangingPass(false);
    }
  };

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const base64 = await fileToBase64(file);
      setProfile({ ...profile, signatureBase64: base64 });
    } catch (err) {
      alert('Error cargando firma');
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'users', auth.currentUser.uid), profile, { merge: true });
      alert('Perfil guardado');
    } catch (err) {
      alert('Error al guardar');
    } finally {
      setIsSaving(false);
    }
  };

  const updateHeader = (type, index, value) => {
    const key = type === 'general' ? 'headerGeneral' : 'headerFibro';
    const newHeader = [...profile[key]];
    newHeader[index] = value;
    setProfile({ ...profile, [key]: newHeader });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-4 md:p-8 animate-fade-in">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black text-[var(--text-main)] transition-colors">Mi Perfil Profesional</h1>
          <p className="text-[var(--text-sub)] mt-1">Configure sus datos de firma y membretes oficiales</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={isSaving}
          className="btn-primary flex items-center gap-2"
        >
          {isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
          {isSaving ? 'Guardando...' : 'Guardar Perfil'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left: General Data */}
        <div className="lg:col-span-2 space-y-8">
          <section className="card p-8 bg-[var(--bg-card)]">
            <h3 className="flex items-center gap-3 text-lg font-bold mb-8 border-b border-main pb-4">
              <UserIcon className="text-blue-500" />
              Datos Personales
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-gray-400 ml-1">Nombre y Apellido</label>
                <input type="text" value={profile.nombre} onChange={e => setProfile({...profile, nombre: e.target.value})} className="input-field" placeholder="Dr. Nome Apellido" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-gray-400 ml-1">Especialidad</label>
                <input type="text" value={profile.especialidad} onChange={e => setProfile({...profile, especialidad: e.target.value})} className="input-field" placeholder="Otorrinolaringología" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-gray-400 ml-1">Matrícula Provincial (MP)</label>
                <input type="text" value={profile.mp} onChange={e => setProfile({...profile, mp: e.target.value})} className="input-field" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-black uppercase text-gray-400 ml-1">Matrícula Nacional/Especialidad (ME)</label>
                <input type="text" value={profile.me} onChange={e => setProfile({...profile, me: e.target.value})} className="input-field" />
              </div>
            </div>
          </section>

          {/* headers Section */}
          <section className="card p-8">
            <h3 className="flex items-center gap-3 text-lg font-bold mb-8 border-b border-main pb-4">
              <FileText className="text-green-500" />
              Configuración de Membretes
            </h3>

            {/* General Header */}
            <div className="space-y-6 mb-12">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-blue-600 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  MEMBRETE GENERAL
                </h4>
                <button 
                  onClick={() => { setPreviewType('general'); setIsPreviewOpen(true); }}
                  className="px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 text-[10px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-200/50 flex items-center gap-2"
                >
                  <Eye size={12} />
                  Vista Previa
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.headerGeneral.map((line, i) => (
                  <input key={i} type="text" value={line} onChange={e => updateHeader('general', i, e.target.value)} className="input-field py-2 text-sm" placeholder={`Línea ${i+1}`} />
                ))}
              </div>
            </div>

            {/* Fibro Header */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-sm text-purple-600 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  MEMBRETE FIBROSCOPIA
                </h4>
                <button 
                  onClick={() => { setPreviewType('fibro'); setIsPreviewOpen(true); }}
                  className="px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-600 text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-all border border-purple-200/50 flex items-center gap-2"
                >
                  <Eye size={12} />
                  Vista Previa
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {profile.headerFibro.map((line, i) => (
                  <input key={i} type="text" value={line} onChange={e => updateHeader('fibro', i, e.target.value)} className="input-field py-2 text-sm" placeholder={`Línea ${i+1}`} />
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* Right: Signature & Security */}
        <div className="space-y-8">
          <section className="card p-8 flex flex-col items-center">
            <h3 className="font-bold text-orange-500 flex items-center gap-2 mb-6">
              <Upload size={18} /> Firma Digital
            </h3>
            {/* Signature box: Forced white background for a "paper" feel, regardless of theme */}
            <div className="w-full aspect-[4/3] bg-white rounded-2xl border-2 border-dashed border-blue-100 flex items-center justify-center p-6 relative group overflow-hidden transition-all shadow-inner">
              {profile.signatureBase64 ? (
                <img src={profile.signatureBase64} alt="Firma" className="max-h-full w-auto object-contain transition-transform group-hover:scale-110" />
              ) : (
                <div className="text-center space-y-2 text-slate-300">
                  <Upload size={32} className="mx-auto" />
                  <p className="text-[10px] font-bold">Subir Firma PNG</p>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleSignatureUpload} className="absolute inset-0 opacity-0 cursor-pointer" />
            </div>
            {profile.signatureBase64 && (
              <button 
                onClick={() => setProfile({...profile, signatureBase64: null})}
                className="mt-4 text-red-500 text-[10px] font-black uppercase tracking-widest hover:bg-red-50 px-4 py-2 rounded-xl transition-all"
              >
                Eliminar Firma
              </button>
            )}
          </section>

          <section className="card p-8 space-y-6">
            <h3 className="font-bold text-purple-600 flex items-center gap-2">
              <Lock size={18} /> Seguridad
            </h3>
            <p className="text-xs text-[var(--text-sub)]">Para cambiar su contraseña de acceso, use el botón de abajo.</p>
            <button 
              onClick={() => setShowPassModal(true)}
              className="w-full py-3 bg-[var(--bg-secondary)] hover:bg-[var(--hover-main)] rounded-2xl transition-all font-bold text-sm border border-main text-[var(--text-main)] flex items-center justify-center gap-2"
            >
              <Key size={16} />
              Cambiar Contraseña
            </button>
          </section>
        </div>
      </div>

      {/* MODAL: VISTA PREVIA (MODERNIZED) */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div 
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setIsPreviewOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-card)] w-full max-w-5xl rounded-[3rem] overflow-hidden flex flex-col h-[90vh] shadow-2xl relative border border-main"
            >
              <div className="p-8 border-b border-main flex items-center justify-between shrink-0">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${previewType === 'general' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                    <FileText />
                  </div>
                  <div>
                    <h3 className="font-black text-xl text-[var(--text-main)] transition-colors">Simulación de Reporte A4</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--text-sub)] opacity-50">Vista Previa de Impresión</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button 
                    onClick={() => setIsPreviewOpen(false)}
                    className="px-6 py-2 rounded-xl bg-[var(--bg-secondary)] hover:bg-[var(--hover-main)] font-bold text-xs transition-colors border border-main text-[var(--text-main)]"
                  >
                    Cerrar
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto bg-slate-200 p-12 flex justify-center">
                <div className="bg-white text-slate-900 w-[210mm] min-h-[297mm] shadow-2xl p-[15mm] flex flex-col relative">
                  {/* Paper simulation content */}
                  <div className="flex justify-between items-start mb-10 border-b-2 border-slate-100 pb-8">
                    <img src="/coat_logo.png" alt="COAT Logo" className="w-24 h-24 object-contain" />
                    <div className="text-right space-y-1">
                      {(previewType === 'general' ? profile.headerGeneral : profile.headerFibro).map((line, i) => (
                        <div key={i} className={`min-h-[1.2rem] ${i === 0 ? 'text-xl font-black mb-2 text-slate-900' : 'text-xs text-slate-600 font-serif'}`}>{line}</div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Dummy report content */}
                  <div className="flex-1 px-8 opacity-10 flex flex-col gap-6 mt-12 pointer-events-none">
                    <div className="h-8 bg-slate-900 rounded w-48" />
                    <div className="space-y-4">
                      <div className="h-4 bg-slate-900 rounded w-full" />
                      <div className="h-4 bg-slate-900 rounded w-[98%]" />
                      <div className="h-4 bg-slate-900 rounded w-96" />
                    </div>
                  </div>
                  {/* Professional signature on paper */}
                  <div className="mt-auto self-end flex flex-col items-center min-w-[300px] border-t-2 border-slate-100 pt-8 text-center">
                    {profile.signatureBase64 && <img src={profile.signatureBase64} alt="Firma" className="max-h-24 w-auto mb-2 mix-blend-multiply" />}
                    <p className="font-black uppercase text-sm text-slate-900">{profile.nombre}</p>
                    <p className="text-xs text-slate-700">{profile.especialidad}</p>
                    <p className="text-[10px] mt-1 text-slate-500">MP: {profile.mp} | ME: {profile.me}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: CAMBIO DE CONTRASEÑA */}
      <AnimatePresence>
        {showPassModal && (
          <div 
            className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setShowPassModal(false)}
          >
            <motion.div 
              initial={{ y: 20, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: 20, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[var(--bg-card)] w-full max-w-md rounded-[2.5rem] shadow-2xl p-8 border border-main relative"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-[var(--text-main)] transition-colors">Actualizar Contraseña</h3>
                <button onClick={() => setShowPassModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors text-[var(--text-main)]">
                  <CloseIcon size={20} />
                </button>
              </div>
              <form onSubmit={handleChangePassword} className="space-y-4">
                {passError && <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-xs font-bold">{passError}</div>}
                {passSuccess && <div className="p-4 bg-green-50 text-green-600 rounded-2xl text-xs font-bold">{passSuccess}</div>}
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-50 ml-1 text-[var(--text-sub)]">Contraseña Actual</label>
                  <input type="password" required value={currentPass} onChange={e => setCurrentPass(e.target.value)} className="input-field" placeholder="••••••" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-50 ml-1 text-[var(--text-sub)]">Nueva Contraseña</label>
                  <input type="password" required value={newPass} onChange={e => setNewPass(e.target.value)} className="input-field" placeholder="Mínimo 6 caracteres" />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-50 ml-1 text-[var(--text-sub)]">Confirmar Nueva</label>
                  <input type="password" required value={confirmPass} onChange={e => setConfirmPass(e.target.value)} className="input-field" placeholder="••••••" />
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button 
                    type="button"
                    onClick={() => setShowPassModal(false)}
                    className="py-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-2xl transition-all font-bold text-sm text-[var(--text-main)]"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    disabled={isChangingPass} 
                    className="btn-primary py-4 flex justify-center items-center gap-2"
                  >
                    {isChangingPass && <Loader2 className="animate-spin" size={20} />}
                    Cambiar
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

export default ProfilePage;
