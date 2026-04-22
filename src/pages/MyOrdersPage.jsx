import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Search, 
  User, 
  Calendar, 
  Printer, 
  Trash2, 
  RefreshCw,
  ChevronDown,
  Database,
  Loader2,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  deleteDoc, 
  doc, 
  limit,
  startAfter,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import { generateOrderPDF } from '../utils/orderPdfGenerator';

const MyOrdersPage = ({ userProfile, isSecretaria = false }) => {
  const toTitleCase = (str) => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [professionals, setProfessionals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [lastVisible, setLastVisible] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [deleteModal, setDeleteModal] = useState({ show: false, order: null });
  const PAGE_SIZE = 20;

  const isAdmin = userProfile?.role?.toLowerCase().includes('admin');
  const canSelectProfessional = isAdmin || isSecretaria;
  const [selectedProfId, setSelectedProfId] = useState('all');

  useEffect(() => {
    if (userProfile) {
      if (canSelectProfessional) {
        setSelectedProfId('all');
      } else {
        setSelectedProfId(auth.currentUser?.uid);
      }
    }
  }, [userProfile, canSelectProfessional]);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 4000);
  };

  useEffect(() => {
    const fetchProfs = async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), orderBy('nombre', 'asc')));
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          .filter(u => (u.role || u.rol || '').toLowerCase().includes('medico') || (u.role || u.rol || '').toLowerCase().includes('fono'));
        setProfessionals(list);
      } catch (err) {}
    };
    if (canSelectProfessional) fetchProfs();
  }, [canSelectProfessional]);

  useEffect(() => {
    fetchOrders(selectedProfId, true);
  }, [selectedProfId]);

  const fetchOrders = async (profId, reset = false) => {
    setLoading(true);
    if (reset) {
      setOrders([]);
      setLastVisible(null);
    }
    
    try {
      let q;
      const constraints = [orderBy('createdAt', 'desc'), limit(PAGE_SIZE)];
      if (reset === false && lastVisible) constraints.splice(1, 0, startAfter(lastVisible));

      if (profId && profId !== 'all') {
        q = query(collection(db, 'orders'), where('profesionalId', '==', profId), ...constraints);
      } else {
        q = query(collection(db, 'orders'), ...constraints);
      }

      const snap = await getDocs(q);
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      setOrders(prev => reset ? list : [...prev, ...list]);
      setLastVisible(snap.docs[snap.docs.length - 1]);
      setHasMore(list.length === PAGE_SIZE);
    } catch (err) {
      showToast("Error al cargar pedidos.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = async (order) => {
    showToast("Generando PDF...");
    try {
      // Re-fetch professional profile to get signature if not in order data
      let profProfile = {};
      const profSnap = await getDoc(doc(db, 'users', order.profesionalId));
      if (profSnap.exists()) profProfile = profSnap.data();
      
      await generateOrderPDF(order, profProfile, 'print');
    } catch (err) {
      showToast("Error al visualizar pedido", "error");
    }
  };

  const confirmDelete = async () => {
    const order = deleteModal.order;
    if (!order) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'orders', order.id));
      showToast('Pedido eliminado.');
      fetchOrders(selectedProfId, true);
    } catch (err) {
      showToast('Error al borrar.', 'error');
    } finally {
      setLoading(false);
      setDeleteModal({ show: false, order: null });
    }
  };

  const filteredOrders = orders.filter(o => 
    o.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    o.dni?.includes(searchTerm)
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-blue-600 p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-500/20">
          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Pedidos en Lista</p>
          <h2 className="text-4xl font-black mt-2">{orders.length}</h2>
          <div className="mt-4 flex items-center text-[10px] opacity-80 gap-1 font-bold">
            <CheckCircle2 size={14} /> PERSISTENCIA ACTIVA
          </div>
        </div>

        <div className="md:col-span-3 bg-[var(--bg-card)] p-4 rounded-[2.5rem] border border-main flex items-center gap-4 shadow-sm">
          {canSelectProfessional && (
            <div className="flex items-center gap-2 bg-[var(--bg-secondary)] px-4 py-3 rounded-2xl border border-main min-w-[200px]">
              <User size={16} className="text-blue-500" />
              <select 
                className="bg-transparent border-none outline-none font-bold text-[10px] text-[var(--text-main)] uppercase w-full"
                value={selectedProfId}
                onChange={(e) => setSelectedProfId(e.target.value)}
              >
                <option value="all">TODOS LOS PROFESIONALES</option>
                {professionals.map(p => <option key={p.id} value={p.id}>{p.nombre || p.n}</option>)}
              </select>
            </div>
          )}
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input 
              type="text" 
              placeholder="Buscar por paciente o DNI..."
              className="w-full pl-12 pr-4 py-4 bg-[var(--bg-secondary)] border-none rounded-2xl font-medium outline-none text-[var(--text-main)]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => fetchOrders(selectedProfId, true)} className="p-4 bg-[var(--bg-secondary)] text-[var(--text-main)] rounded-2xl hover:brightness-110 transition-all">
            <RefreshCw size={24} className={loading ? 'animate-spin text-blue-600' : 'opacity-60'} />
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-card)] rounded-[3rem] border border-main overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          {loading && orders.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center gap-4"><Loader2 className="animate-spin text-blue-600" size={40} /><p className="text-gray-500 font-bold">Cargando historial...</p></div>
          ) : filteredOrders.length === 0 ? (
            <div className="py-20 text-center"><FileText size={40} className="mx-auto text-gray-300 mb-4" /><h4 className="font-bold text-[var(--text-main)]">No hay pedidos registrados</h4></div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-secondary)]/50 text-[10px] uppercase font-black tracking-widest text-gray-400">
                  <th className="px-8 py-4">Fecha</th>
                  <th className="px-8 py-4">Paciente</th>
                  <th className="px-8 py-4">Profesional</th>
                  <th className="px-8 py-4">Prácticas</th>
                  <th className="px-8 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y border-main">
                {filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-[var(--bg-secondary)]/50 transition-colors">
                    <td className="px-8 py-6">
                       <span className="font-bold text-sm text-[var(--text-main)]">{new Date(order.date).toLocaleDateString()}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-[var(--text-main)]">{toTitleCase(order.name)}</span>
                        <span className="text-[10px] text-gray-400">DNI: {order.dni}</span>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-[10px] font-bold text-blue-600 uppercase bg-blue-50 px-2 py-1 rounded-md">{order.profesionalName}</span>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-wrap gap-1">
                        {order.practices?.slice(0, 2).map((p, i) => (
                          <span key={i} className="text-[9px] font-bold bg-[var(--bg-secondary)] border border-main px-2 py-1 rounded-full text-[var(--text-main)]">{p}</span>
                        ))}
                        {order.practices?.length > 2 && <span className="text-[9px] font-bold text-gray-400">+{order.practices.length - 2} más</span>}
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleViewOrder(order)} className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 border border-amber-100 shadow-sm transition-all" title="Ver PDF"><Printer size={18} /></button>
                        {(isAdmin || (!isSecretaria && auth.currentUser?.uid === order.profesionalId)) && (
                          <button onClick={() => setDeleteModal({ show: true, order })} className="p-2 bg-red-50 text-red-600 rounded-xl hover:bg-red-100 border border-red-100 shadow-sm transition-all" title="Eliminar"><Trash2 size={18} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {hasMore && (
          <div className="p-8 border-t border-main bg-[var(--bg-secondary)]/30 flex justify-center">
            <button onClick={() => fetchOrders(selectedProfId, false)} className="px-8 py-3 bg-[var(--bg-card)] border border-main rounded-2xl font-bold text-xs uppercase hover:bg-[var(--bg-secondary)] transition-all flex items-center gap-2 text-[var(--text-main)]">
              <ChevronDown size={16} /> Cargar más
            </button>
          </div>
        )}
      </div>

      <AnimatePresence>
        {deleteModal.show && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-[var(--bg-card)] rounded-[2.5rem] p-8 max-w-md w-full border border-main shadow-2xl text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6"><Trash2 size={32} /></div>
              <h3 className="text-xl font-bold mb-2 text-[var(--text-main)]">¿Eliminar Pedido?</h3>
              <p className="text-sm text-gray-500 mb-8">Esta acción borrará el registro de {deleteModal.order?.name} permanentemente.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteModal({ show: false, order: null })} className="flex-1 py-3 bg-[var(--bg-secondary)] rounded-xl font-bold text-[var(--text-main)]">Cancelar</button>
                <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20">Eliminar</button>
              </div>
            </motion.div>
          </div>
        )}
        {toast.show && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className={`fixed bottom-8 right-8 z-[110] px-6 py-4 rounded-2xl shadow-2xl ${toast.type === 'success' ? 'bg-blue-600' : 'bg-red-600'} text-white font-bold`}>
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyOrdersPage;
