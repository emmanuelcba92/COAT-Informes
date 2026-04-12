import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth.currentUser) return;
      try {
        const docRef = doc(db, 'users', auth.currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          setProfile({
            ...data,
            headerGeneral: data.headerGeneral || Array(8).fill(''),
            headerFibro: data.headerFibro || Array(8).fill(''),
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
      await setDoc(userRef, profile, { merge: true });
      alert('Perfil guardado con éxito');
    } catch (err) {
      console.error("Error saving profile:", err);
      alert('Error al guardar perfil');
    } finally {
      setIsSaving(false);
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
            
            <div className="space-y-8">
              <div>
                <h4 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  Membrete General
                </h4>
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
                <h4 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500" />
                  Membrete Fibroscopia
                </h4>
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
            <button className="w-full py-2 px-4 bg-[var(--bg-page)] hover:bg-gray-200 dark:hover:bg-slate-700 text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
              <Key size={16} />
              Cambiar Contraseña
            </button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
