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
  Key
} from 'lucide-react';
import { db, auth } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Eye, X as CloseIcon } from 'lucide-react';

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
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState('general'); // 'general' o 'fibro'

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const uid = auth.currentUser.uid;
        const email = auth.currentUser.email || '';
        const docRef = doc(db, 'users', uid);
        let docSnap = await getDoc(docRef);
        
        let profileData = docSnap.exists() ? docSnap.data() : null;

        // CHECK FOR LEGACY DATA even if official doc exists
        // This ensures admin updates to legacy slugs are pulled into the official UID
        if (email) {
          const legacyId = email.replace(/[@.]/g, '_');
          const legacyRef = doc(db, 'users', legacyId);
          const legacySnap = await getDoc(legacyRef);
          
          if (legacySnap.exists()) {
            const legacyData = legacySnap.data();
            console.log("Found legacy/admin data for", email, "- Merging...");
            
            // Standardize legacy data
            const standardizedLegacy = {
              nombre: legacyData.nombre || legacyData.n || '',
              especialidad: legacyData.especialidad || legacyData.esp || '',
              mp: legacyData.mp || legacyData.m || '',
              me: legacyData.me || '',
              headerGeneral: legacyData.headerGeneral || Array(8).fill(''),
              headerFibro: legacyData.headerFibro || Array(8).fill(''),
              signatureBase64: legacyData.signatureBase64 || null,
              role: legacyData.role || 'médico'
            };

            // Merge: Prefer standard data but fill gaps with legacy if official is empty
            if (!profileData) {
              profileData = standardizedLegacy;
            } else {
              // Only overwrite if official data is missing or if legacy looks "newer/fuller"
              // For simplicity, we merge fields that are empty in official
              profileData = {
                ...standardizedLegacy, // Start with legacy (newest admin updates)
                ...profileData,      // Overwrite with existing official
                // Force overwrite identity fields if they are missing in official
                nombre: profileData.nombre || standardizedLegacy.nombre,
                especialidad: profileData.especialidad || standardizedLegacy.especialidad,
                mp: profileData.mp || standardizedLegacy.mp,
                me: profileData.me || standardizedLegacy.me,
              };
            }
            
            // Save the merged version to the official location
            await setDoc(docRef, profileData, { merge: true });
          }
        }

        if (profileData) {
          setProfile({
            ...profileData,
            nombre: profileData.nombre || '',
            especialidad: profileData.especialidad || '',
            mp: profileData.mp || '',
            me: profileData.me || '',
            headerGeneral: profileData.headerGeneral || Array(8).fill(''),
            headerFibro: profileData.headerFibro || Array(8).fill(''),
            signatureBase64: profileData.signatureBase64 || null,
          });
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 500000) { 
        alert("La imagen es muy pesada. Use una de menos de 500KB.");
        return;
      }
      try {
        const base64 = await fileToBase64(file);
        setProfile({ ...profile, signatureBase64: base64 });
      } catch (err) {
        console.error("Error converting file:", err);
      }
    }
  };

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const cleanProfile = {
        ...profile,
        email: auth.currentUser.email,
        nombre: profile.nombre || 'Médico',
        updatedAt: new Date().toISOString()
      };
      // Ensure we don't save legacy single-letter fields if they somehow got in
      delete cleanProfile.n;
      delete cleanProfile.e;
      delete cleanProfile.u;
      delete cleanProfile.esp;
      delete cleanProfile.m;

      await setDoc(userRef, cleanProfile, { merge: true });
      alert('Perfil guardado con éxito');
    } catch (err) {
      console.error("Error saving profile:", err);
      alert('Error al guardar perfil: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!auth.currentUser?.email) return;
    if (window.confirm(`Se enviará un correo para restablecer tu contraseña a: ${auth.currentUser.email}. ¿Continuar?`)) {
      try {
        await sendPasswordResetEmail(auth, auth.currentUser.email);
        alert("¡Correo enviado! Revisa tu bandeja de entrada o spam.");
      } catch (err) {
        alert("Error al enviar correo: " + err.message);
      }
    }
  };

  const updateHeader = (type, index, value) => {
    const newHeader = [...(type === 'general' ? profile.headerGeneral : profile.headerFibro)];
    newHeader[index] = value;
    setProfile({...profile, [type === 'general' ? 'headerGeneral' : 'headerFibro']: newHeader});
  };

  if (isLoading) return <div className="p-20 text-center opacity-50">Cargando perfil...</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-outfit">Mi Perfil</h1>
          <p className="text-gray-500 dark:text-gray-400">Administre su información profesional y configuración de membretes</p>
        </div>
        <button 
          onClick={handleSave}
          className="btn-primary flex items-center gap-2"
          disabled={isSaving}
        >
          <Save size={18} />
          {isSaving ? 'Guardando...' : 'Guardar Cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Left Column: Personal Data */}
        <div className="md:col-span-2 space-y-6">
          <section className="card p-6 space-y-4">
            <h3 className="flex items-center gap-2 text-lg font-semibold border-b border-main pb-2 mb-4">
              <UserIcon size={20} className="text-blue-500" />
              Datos del Profesional
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase opacity-60">Nombre Completo</label>
                <input 
                  type="text" 
                  value={profile.nombre}
                  onChange={e => setProfile({...profile, nombre: e.target.value})}
                  className="input-field" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase opacity-60">Especialidad</label>
                <input 
                  type="text" 
                  value={profile.especialidad}
                  onChange={e => setProfile({...profile, especialidad: e.target.value})}
                  className="input-field" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase opacity-60">Matrícula Provincial (MP)</label>
                <input 
                  type="text" 
                  value={profile.mp}
                  onChange={e => setProfile({...profile, mp: e.target.value})}
                  className="input-field" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase opacity-60">Matrícula Especialidad (ME)</label>
                <input 
                  type="text" 
                  value={profile.me}
                  onChange={e => setProfile({...profile, me: e.target.value})}
                  className="input-field" 
                />
              </div>
            </div>
          </section>

          <section className="card p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold border-b border-main pb-2 mb-4">
              <FileCheck size={20} className="text-green-500" />
              Configuración de Membretes (8 líneas c/u)
            </h3>
            
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-2 font-bold text-sm uppercase text-gray-500 tracking-wider">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Membrete General (8 líneas)
                  </h4>
                  <button 
                    onClick={() => { setPreviewType('general'); setIsPreviewOpen(true); }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded-lg hover:bg-blue-100 transition-colors border border-blue-200 dark:border-blue-900/30"
                  >
                    <Eye size={14} /> VISTA PREVIA
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {profile.headerGeneral.map((line, idx) => (
                    <input 
                      key={`gen-${idx}`}
                      type="text"
                      placeholder={`Línea ${idx + 1}`}
                      value={line}
                      onChange={e => updateHeader('general', idx, e.target.value)}
                      className="input-field py-2 text-sm"
                    />
                  ))}
                </div>
                <p className="mt-2 text-[10px] text-gray-400">Si deja todas las líneas vacías, solo se mostrará el logo de COAT en el PDF.</p>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="flex items-center gap-2 font-bold text-sm uppercase text-gray-500 tracking-wider">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    Membrete Fibroscopia
                  </h4>
                  <button 
                    onClick={() => { setPreviewType('fibro'); setIsPreviewOpen(true); }}
                    className="flex items-center gap-1.5 px-3 py-1 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 text-[10px] font-bold rounded-lg hover:bg-purple-100 transition-colors border border-purple-200 dark:border-purple-900/30"
                  >
                    <Eye size={14} /> VISTA PREVIA
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {profile.headerFibro.map((line, idx) => (
                    <input 
                      key={`fib-${idx}`}
                      type="text"
                      placeholder={`Línea ${idx + 1}`}
                      value={line}
                      onChange={e => updateHeader('fibro', idx, e.target.value)}
                      className="input-field py-2 text-sm"
                    />
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column: Signature & Security */}
        <div className="space-y-6">
          <section className="card p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold border-b border-gray-100 dark:border-slate-800 pb-2 mb-4">
              <Upload size={20} className="text-orange-500" />
              Firma Digital
            </h3>
            
            <div className="space-y-4">
              <label 
                className="aspect-video bg-[var(--bg-page)] rounded-xl border-2 border-dashed border-main flex flex-col items-center justify-center p-4 text-center cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors overflow-hidden"
              >
                {profile.signatureBase64 ? (
                  <img src={profile.signatureBase64} alt="Firma" className="max-h-full object-contain" />
                ) : (
                  <>
                    <div className="w-12 h-12 bg-white dark:bg-slate-700 rounded-full shadow-sm flex items-center justify-center text-blue-500 mb-2">
                      <Upload size={24} />
                    </div>
                    <p className="text-xs font-semibold">Subir Firma PNG</p>
                    <p className="text-[10px] text-gray-400 mt-1">Fondo transparente recomendado</p>
                  </>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={handleSignatureUpload}
                />
              </label>
              
              <div className="flex gap-2">
                <button 
                  onClick={() => setProfile({...profile, signatureBase64: null})}
                  className="w-full p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-2 text-xs font-bold"
                >
                  <Trash2 size={16} />
                  ELIMINAR FIRMA
                </button>
              </div>
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

              <div className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 flex justify-center text-[11px] font-medium text-gray-500 italic">
                * Esta es una representación visual del informe PDF final. El diseño puede variar levemente al imprimir.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ProfilePage;
