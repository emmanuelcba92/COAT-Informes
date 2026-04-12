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
  CheckCircle2
} from 'lucide-react';
import { db, auth } from '../services/firebase';
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, sendPasswordResetEmail } from 'firebase/auth';

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
  const [previewType, setPreviewType] = useState('general'); // 'general' o 'fibro'
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

        // Fallback 1: Manual Slug (Slug logic)
        if (!profileData && email) {
          const legacyId = email.replace(/[@.]/g, '_');
          const legacyRef = doc(db, 'users', legacyId);
          const legacySnap = await getDoc(legacyRef);
          if (legacySnap.exists()) {
            profileData = legacySnap.data();
          }
        }

        // Fallback 2: Query by email field ('e' or 'email')
        if (!profileData && email) {
          const usersRef = collection(db, 'users');
          // Try both field names used in different import versions
          const q1 = query(usersRef, where('e', '==', email), limit(1));
          const q2 = query(usersRef, where('email', '==', email), limit(1));
          
          const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
          const foundDoc = s1.docs[0] || s2.docs[0];
          
          if (foundDoc) {
            profileData = foundDoc.data();
            console.log("Found profile via email query");
          }
        }

        if (profileData) {
          // Standardize
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
          
          // MIGRATION: Auto-save to official UID if it's currently stored elsewhere
          await setDoc(docRef, { ...cleanProfile, isOfficial: true }, { merge: true });
          setProfile({ ...cleanProfile, isOfficial: true });
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, [auth.currentUser]);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');
    
    if (newPass !== confirmPass) {
      setPassError('Las nuevas contraseñas no coinciden');
      return;
    }
    
    if (newPass.length < 6) {
      setPassError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setIsChangingPass(true);
    try {
      const user = auth.currentUser;
      const credential = EmailAuthProvider.credential(user.email, currentPass);
      
      // Re-autenticar
      await reauthenticateWithCredential(user, credential);
      
      // Cambiar contraseña
      await updatePassword(user, newPass);
      
      setPassSuccess('¡Contraseña actualizada con éxito!');
      setCurrentPass('');
      setNewPass('');
      setConfirmPass('');
      
      // Cerrar modal tras 2 segundos
      setTimeout(() => setShowPassModal(false), 2000);
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/wrong-password') {
        setPassError('La contraseña actual es incorrecta');
      } else {
        setPassError('Error al cambiar la contraseña. Reintente más tarde.');
      }
    } finally {
      setIsChangingPass(false);
    }
  };

  const handlePasswordReset = () => {
    setShowPassModal(true);
    setPassError('');
    setPassSuccess('');
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
      console.error(err);
      alert('Error cargando la firma');
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const uid = auth.currentUser.uid;
      await setDoc(doc(db, 'users', uid), { 
        ...profile, 
        email: auth.currentUser.email,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      alert('Perfil guardado correctamente');
    } catch (err) {
      console.error(err);
      alert('Error guardando perfil');
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
      <div className="flex items-center justify-center h-full">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 animate-fade-in p-2 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2 border-b border-main">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Mi Perfil</h1>
          <p className="text-gray-500 font-medium">Administre su información profesional y configuración de membretes</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={isSaving}
          className="btn-primary flex items-center gap-2 px-8 py-3 h-fit whitespace-nowrap"
        >
          {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={20} />}
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* COLUMNA IZQUIERDA - DATOS Y MEMBRETES */}
        <div className="lg:col-span-2 space-y-8">
          <section className="card p-8 bg-gradient-to-br from-white to-blue-50/30 dark:from-slate-900 dark:to-blue-900/5">
            <h3 className="flex items-center gap-3 text-xl font-bold mb-6 text-blue-600">
              <UserIcon size={24} className="bg-blue-100 dark:bg-blue-900/40 p-1 rounded-lg" />
              Datos del Profesional
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 pl-1">Nombre Completo</label>
                <input 
                  type="text"
                  value={profile.nombre}
                  onChange={(e) => setProfile({ ...profile, nombre: e.target.value })}
                  placeholder="Ej: DR. JUAN PEREZ"
                  className="input-field"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 pl-1">Especialidad</label>
                <input 
                  type="text"
                  value={profile.especialidad}
                  onChange={(e) => setProfile({ ...profile, especialidad: e.target.value })}
                  placeholder="Ej: OTORRINOLARINGOLOGÍA"
                  className="input-field"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 pl-1">Matrícula Provincial (MP)</label>
                <input 
                  type="text"
                  value={profile.mp}
                  onChange={(e) => setProfile({ ...profile, mp: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-gray-400 pl-1">Matrícula Especialidad (ME)</label>
                <input 
                  type="text"
                  value={profile.me}
                  onChange={(e) => setProfile({ ...profile, me: e.target.value })}
                  className="input-field"
                />
              </div>
            </div>
          </section>

          <section className="card p-8">
            <div className="flex items-center justify-between mb-8 border-b border-main pb-4">
              <h3 className="flex items-center gap-3 text-xl font-bold text-green-600">
                <FileText size={24} className="bg-green-100 dark:bg-green-900/40 p-1 rounded-lg" />
                Configuración de Membretes (8 líneas c/u)
              </h3>
            </div>

            {/* MEMBRETE GENERAL */}
            <div className="mb-10 p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-main">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  MEMBRETE GENERAL (8 LÍNEAS)
                </h4>
                <button 
                  onClick={() => { setPreviewType('general'); setIsPreviewOpen(true); }}
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full hover:bg-blue-200 transition-colors font-bold uppercase"
                >
                  <Eye size={12} />
                  Vista Previa
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {profile.headerGeneral.map((line, i) => (
                  <input 
                    key={i}
                    type="text"
                    value={line}
                    onChange={(e) => updateHeader('general', i, e.target.value)}
                    placeholder={`Línea ${i + 1}`}
                    className="w-full px-4 py-2 text-sm bg-white dark:bg-slate-900 border border-main rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                ))}
              </div>
            </div>

            {/* MEMBRETE FIBRO */}
            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-main">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-bold flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  MEMBRETE FIBROSCOPIA
                </h4>
                <button 
                  onClick={() => { setPreviewType('fibro'); setIsPreviewOpen(true); }}
                  className="text-xs flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 dark:bg-purple-900/30 text-purple-600 rounded-full hover:bg-purple-200 transition-colors font-bold uppercase"
                >
                  <Eye size={12} />
                  Vista Previa
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {profile.headerFibro.map((line, i) => (
                  <input 
                    key={i}
                    type="text"
                    value={line}
                    onChange={(e) => updateHeader('fibro', i, e.target.value)}
                    placeholder={`Línea ${i + 1}`}
                    className="w-full px-4 py-2 text-sm bg-white dark:bg-slate-900 border border-main rounded-xl focus:ring-2 focus:ring-purple-500/20 outline-none"
                  />
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* COLUMNA DERECHA - FIRMA Y OTROS */}
        <div className="space-y-8">
          <section className="card p-8 border-dashed border-2 flex flex-col items-center text-center">
            <h3 className="flex items-center gap-2 text-lg font-bold mb-6 text-orange-500">
              <Upload size={20} />
              Firma Digital
            </h3>
            
            <div className="relative group w-full max-w-[240px]">
              <div className="aspect-[4/3] bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-main flex flex-col items-center justify-center p-4 overflow-hidden relative transition-all group-hover:border-blue-500/50">
                {profile.signatureBase64 ? (
                  <img src={profile.signatureBase64} alt="Firma" className="max-h-full w-auto object-contain mix-blend-multiply dark:mix-blend-normal brightness-110" />
                ) : (
                  <>
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-full flex items-center justify-center mb-2">
                      <Upload size={24} />
                    </div>
                    <p className="text-xs font-bold text-gray-500">Subir Firma PNG</p>
                    <p className="text-[10px] text-gray-400 mt-1">Fondo transparente recomendado</p>
                  </>
                )}
                <input 
                  type="file"
                  accept="image/png, image/jpeg"
                  onChange={handleSignatureUpload}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </div>
              
              {profile.signatureBase64 && (
                <button 
                  onClick={() => setProfile({ ...profile, signatureBase64: null })}
                  className="mt-4 flex items-center gap-1 text-red-500 text-[10px] font-bold uppercase hover:bg-red-50 px-3 py-1.5 rounded-full transition-all mx-auto"
                >
                  <Trash2 size={12} />
                  Eliminar Firma
                </button>
              )}
            </div>
          </section>

          <section className="card p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold border-b border-main pb-2 mb-4">
              <Key size={20} className="text-purple-500" />
              Seguridad
            </h3>
            <button 
              onClick={handlePasswordReset}
              className="w-full py-2 px-4 bg-[var(--bg-page)] hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Key size={16} />
              Cambiar Contraseña
            </button>
          </section>
        </div>
      </div>

      {/* MODAL DE VISTA PREVIA */}
      <AnimatePresence>
        {isPreviewOpen && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-slate-900 w-full max-w-4xl max-h-[95vh] rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/20"
            >
              <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${previewType === 'general' ? 'bg-blue-100 text-blue-600' : 'bg-purple-100 text-purple-600'}`}>
                    <FileText size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Vista Previa de Impresión</h3>
                    <p className="text-[10px] opacity-50 uppercase tracking-widest font-bold">Documento A4 • Membrete {previewType === 'general' ? 'General' : 'Fibroscopia'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <CloseIcon size={24} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-12 bg-slate-100 dark:bg-slate-950 flex justify-center">
                {/* REPRESENTACIÓN DE HOJA A4 */}
                <div className="bg-white text-slate-800 w-[210mm] min-h-[297mm] shadow-xl p-[20mm] flex flex-col font-serif relative">
                  
                  {/* MEMBRETE */}
                  <div className="text-center space-y-0.5 mb-16 border-b-2 border-slate-100 pb-8">
                    {(previewType === 'general' ? profile.headerGeneral : profile.headerFibro).map((line, i) => (
                      <div key={i} className={`min-h-[1.2rem] ${i === 0 ? 'text-2xl font-bold uppercase mb-2' : 'text-sm'}`}>
                        {line}
                      </div>
                    ))}
                  </div>

                  {/* CUERPO SIMULADO */}
                  <div className="flex-1">
                    <div className="text-right mb-12">
                      <p className="italic opacity-50">Ciudad, Fecha de 202X</p>
                    </div>
                    <h2 className="text-xl font-bold uppercase mb-8 border-b border-slate-200 inline-block">Informe Médico</h2>
                    <div className="space-y-4 opacity-30">
                      <div className="h-4 bg-slate-200 rounded w-full" />
                      <div className="h-4 bg-slate-200 rounded w-[95%]" />
                      <div className="h-4 bg-slate-200 rounded w-[98%]" />
                      <div className="h-4 bg-slate-200 rounded w-[90%]" />
                      <div className="h-4 bg-slate-200 rounded w-full" />
                      <div className="h-4 bg-slate-200 rounded w-[40%] mt-8" />
                    </div>
                  </div>

                  {/* FIRMA Y PIE */}
                  <div className="mt-24 self-end text-center flex flex-col items-center min-w-[200px]">
                    {profile.signatureBase64 ? (
                      <img src={profile.signatureBase64} alt="Firma" className="max-h-24 w-auto mb-2 object-contain mix-blend-multiply" />
                    ) : (
                      <div className="h-24" />
                    )}
                    <div className="border-t border-slate-400 pt-2 w-full">
                      <p className="font-bold uppercase text-sm">{profile.nombre || 'Nombre del Profesional'}</p>
                      <p className="text-[11px] leading-tight">{profile.especialidad}</p>
                      <div className="flex gap-2 justify-center text-[10px] mt-1">
                        {profile.mp && <span>MP {profile.mp}</span>}
                        {profile.me && <span>ME {profile.me}</span>}
                      </div>
                    </div>
                  </div>

                  {/* MARCA DE AGUA INFERIOR */}
                  <div className="absolute bottom-8 left-0 right-0 text-center opacity-20 text-[9px]">
                    <p>Informes Digitales COAT - Centro Otorrinolaringológico Audiológico Trenque Lauquen</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE CAMBIO DE CONTRASEÑA */}
      <AnimatePresence>
        {showPassModal && (
          <div className="fixed inset-0 z-[210] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-white/10"
            >
              <div className="p-6 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-900/30 text-purple-600 flex items-center justify-center">
                    <Lock size={20} />
                  </div>
                  <h3 className="font-bold text-lg">Cambiar Contraseña</h3>
                </div>
                <button 
                  onClick={() => setShowPassModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                {passError && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-center gap-2 animate-shake">
                    <AlertCircle size={16} />
                    {passError}
                  </div>
                )}
                {passSuccess && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900/30 text-green-600 dark:text-green-400 text-sm rounded-xl flex items-center gap-2">
                    <CheckCircle2 size={16} />
                    {passSuccess}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-1">Contraseña Actual</label>
                  <input 
                    type="password"
                    required
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-1">Nueva Contraseña</label>
                  <input 
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                    placeholder="Mínimo 6 caracteres"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400 pl-1">Confirmar Nueva Contraseña</label>
                  <input 
                    type="password"
                    required
                    value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl focus:ring-2 focus:ring-purple-500/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isChangingPass || passSuccess}
                  className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl transition-all active:scale-95 shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 mt-4"
                >
                  {isChangingPass ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <ShieldCheck size={20} />
                      Actualizar Contraseña
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default ProfilePage;
