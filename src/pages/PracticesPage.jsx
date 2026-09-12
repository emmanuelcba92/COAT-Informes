import React, { useState, useEffect } from 'react';
import ClinicalEditor from '../components/ClinicalEditor';
import { motion } from 'framer-motion';
import { db, auth } from '../services/firebase';
import { collection, onSnapshot, doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Bookmark, 
  Search, 
  ChevronRight, 
  Save, 
  Copy, 
  Info,
  Type,
  Loader2,
  Trash2,
  RotateCcw
} from 'lucide-react';

const PracticesPage = ({ isDarkMode }) => {
  const [selectedPractice, setSelectedPractice] = useState(null);
  const [editorContent, setEditorContent] = useState('');
  const [masterPractices, setMasterPractices] = useState([]);
  const [personalPractices, setPersonalPractices] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    // Load Master Practices
    const unsub = onSnapshot(collection(db, 'practices'), (snap) => {
      setMasterPractices(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Load Personal Practice Customizations
    const fetchPersonal = async () => {
      if (!auth.currentUser) return;
      const docRef = doc(db, 'users', auth.currentUser.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setPersonalPractices(docSnap.data().personalPractices || {});
      }
      setIsLoading(false);
    };

    fetchPersonal();
    return () => unsub();
  }, []);

  const formatContent = (content) => {
    if (!content) return '';
    // Si parece texto plano y tiene saltos de línea, convertir a párrafos HTML
    if (!content.includes('<p>') && content.includes('\n')) {
      return content.split('\n').map(line => line.trim() ? `<p>${line}</p>` : '<p><br></p>').join('');
    }
    return content;
  };

  const handleSelectPractice = (practice) => {
    setSelectedPractice(practice);
    // Use personal version if exists, otherwise use master body
    const personal = personalPractices[practice.id];
    const content = personal 
      ? (typeof personal === 'string' ? personal : personal.b) 
      : (practice.b || '');
    setEditorContent(formatContent(content));
  };

  const handleSavePersonal = async () => {
    if (!auth.currentUser || !selectedPractice) return;
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const updatedPersonal = {
        ...personalPractices,
        [selectedPractice.id]: editorContent // Simplified to just string as per previous bug found
      };
      await setDoc(userRef, { personalPractices: updatedPersonal }, { merge: true });
      setPersonalPractices(updatedPersonal);
      alert('Modelo personalizado guardado con éxito.');
    } catch (err) {
      console.error("Error saving customization:", err);
      alert('Error al guardar el modelo.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPersonal = async () => {
    if (!auth.currentUser || !selectedPractice) return;
    if (!window.confirm("¿Seguro que quiere eliminar su versión personalizada y volver a la original del sistema?")) return;
    
    setIsSaving(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      const updatedPersonal = { ...personalPractices };
      delete updatedPersonal[selectedPractice.id];
      
      await setDoc(userRef, { personalPractices: updatedPersonal }, { merge: true });
      setPersonalPractices(updatedPersonal);
      
      // Update editor content immediate
      setEditorContent(selectedPractice.b || '');
      alert('Restaurada plantilla del sistema.');
    } catch (err) {
      console.error("Error resetting customization:", err);
      alert('Error al restaurar.');
    } finally {
      setIsSaving(false);
    }
  };

  const filteredPractices = masterPractices.filter(p => 
    (p.n || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.c || '').toLowerCase().includes(searchQuery.toLowerCase())
  );



  if (isLoading) return <div className="p-20 text-center opacity-50"><Loader2 className="animate-spin mx-auto mb-2" /> Cargando modelos...</div>;

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 overflow-hidden">
      {/* List of Practices */}
      <div className="w-80 flex-shrink-0 flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar modelos..." 
            className="input-field pl-10" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 overflow-auto space-y-2 pr-2">
          {filteredPractices.length > 0 ? (
            filteredPractices.map(p => (
              <motion.div
                key={p.id}
                whileHover={{ x: 5 }}
                onClick={() => handleSelectPractice(p)}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${selectedPractice?.id === p.id ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-[var(--bg-card)] border-main hover:border-blue-300'}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{p.n}</span>
                  <ChevronRight size={16} opacity={0.5} />
                </div>
                <div className="flex justify-between items-center mt-1">
                  <p className={`text-[10px] uppercase tracking-widest ${selectedPractice?.id === p.id ? 'text-blue-100' : 'text-gray-400'}`}>
                    Cód: {p.c || '--'}
                  </p>
                  {personalPractices[p.id] && (
                    <span className="text-[8px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded-full font-bold uppercase">Personalizada</span>
                  )}
                </div>
              </motion.div>
            ))
          ) : (
            <div className="p-10 text-center text-xs text-gray-400 italic">No se encontraron modelos.</div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-[var(--bg-card)] rounded-3xl shadow-sm border border-main overflow-hidden">
        {selectedPractice ? (
          <>
            <div className="p-6 border-b border-main flex items-center justify-between bg-[var(--bg-page)]/50">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDarkMode ? 'bg-blue-900/30 text-blue-400' : 'bg-blue-100 text-blue-600'}`}>
                  <Type size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg">{selectedPractice.n}</h3>
                  <p className="text-xs text-gray-400">Personalizando modelo de informe</p>
                </div>
              </div>
              <div className="flex gap-2">
                {personalPractices[selectedPractice.id] && (
                  <button 
                    onClick={handleResetPersonal}
                    disabled={isSaving}
                    className="flex items-center gap-2 text-xs px-4 py-2 border border-red-100 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 transition-all font-bold"
                  >
                    <RotateCcw size={14} />
                    Restaurar Modelo Original
                  </button>
                )}
                <button 
                  onClick={handleSavePersonal}
                  disabled={isSaving}
                  className="btn-primary flex items-center gap-2 text-sm px-4"
                >
                  {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Guardar Modelo
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden p-6 flex flex-col gap-4">
              <div className={`flex items-start gap-2 p-3 border rounded-xl text-xs ${isDarkMode ? 'bg-blue-900/10 border-blue-900/20 text-blue-400' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                <Info size={16} className="mt-0.5 flex-shrink-0" />
                <p>Usted puede editar el contenido de este modelo. Lo que guarde aquí será lo que aparezca por defecto al seleccionar esta práctica en la sección de generación de informes.</p>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                <ClinicalEditor 
                  value={editorContent} 
                  onChange={setEditorContent}
                  minHeight="380px"
                />
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-10 space-y-4">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-gray-300 ${isDarkMode ? 'bg-slate-800' : 'bg-gray-50'}`}>
              <Bookmark size={40} />
            </div>
            <div>
              <h3 className="text-xl font-bold">Mis Modelos de Informe</h3>
              <p className="text-gray-400 max-w-xs mx-auto">Elija una práctica para personalizar el modelo que se cargará automáticamente en sus informes.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PracticesPage;
