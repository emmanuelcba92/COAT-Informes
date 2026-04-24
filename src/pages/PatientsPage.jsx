import React, { useState, useEffect } from 'react';
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
  AlertCircle
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
  where
} from 'firebase/firestore';

export default function PatientsPage({ isAdmin = false, isSecretaria = false }) {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState(10);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Usamos 'name' que es el campo real en la base de datos de pacientes
    const q = query(collection(db, 'patients'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setPatients(docs);
      setLoading(false);
    }, (err) => {
      console.error("Firestore Error:", err);
      // Fallback si falla el ordenamiento
      const fallbackQ = query(collection(db, 'patients'));
      onSnapshot(fallbackQ, (snapshot) => {
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setPatients(docs);
        setLoading(false);
      });
    });

    return () => unsubscribe();
  }, []);

  const filteredPatients = patients.filter(p => 
    (p.name || p.nombre)?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.dni?.toString().includes(searchTerm)
  );

  // Pagination logic
  const displayedPatients = filteredPatients.slice(0, visibleCount);

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

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in p-4 pb-20">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-main">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">Pacientes</h1>
          <p className="text-slate-500 font-medium">Gestión y registro centralizado de la institución</p>
        </div>
        
        <div className="relative w-full md:w-96 group">
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
              <p className="text-[10px] font-black text-[var(--text-sub)] uppercase tracking-widest">Total Pacientes</p>
              <h3 className="text-2xl font-black text-[var(--text-main)]">
                {loading ? <Loader2 className="animate-spin text-blue-600" size={20} /> : patients.length}
              </h3>
            </div>
          </div>
        </motion.div>
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
        ) : filteredPatients.length === 0 ? (
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
                {displayedPatients.map((patient, idx) => (
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
                        {patient.telefono && (
                          <div className="flex items-center gap-1.5 text-xs text-[var(--text-main)]">
                            <Phone size={12} className="text-[var(--text-sub)]" />
                            {patient.telefono}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className={`flex items-center justify-end gap-2 ${isAdmin ? 'opacity-0 group-hover:opacity-100' : 'hidden'} transition-opacity`}>
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

      {filteredPatients.length > visibleCount && (
        <div className="flex justify-center pt-4">
          <button
            onClick={() => setVisibleCount(prev => prev + 10)}
            className="flex items-center gap-2 px-8 py-3 bg-white dark:bg-slate-800 border-2 border-blue-500 text-blue-600 dark:text-blue-400 font-black rounded-2xl hover:bg-blue-50 transition-all active:scale-95 shadow-lg shadow-blue-500/10 uppercase tracking-widest text-xs"
          >
            <Plus size={18} />
            Cargar más pacientes
          </button>
        </div>
      )}

      <div className="flex items-center justify-center gap-2 py-4">
        <p className="text-[10px] font-black text-[var(--text-sub)] uppercase tracking-widest">
          Mostrando {displayedPatients.length} de {filteredPatients.length} pacientes {searchTerm && `(filtrados de ${patients.length} totales)`}
        </p>
      </div>
    </div>
  );
}
