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
  FileText,
  Mail,
  PenLine,
  X,
  Download
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
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
import { logAction, AUDIT_ACTIONS } from '../services/auditService';

const MyOrdersPage = ({ userProfile, isAdmin, isSecretaria = false, isSuperSecretaria = false }) => {
  const navigate = useNavigate();
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
  const [config, setConfig] = useState({ adminEmail: '', appsScriptUrl: '', token: '' });
  const [isResending, setIsResending] = useState(null); // ID del pedido que se está reenviando
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedOrderForPreview, setSelectedOrderForPreview] = useState(null);
  const PAGE_SIZE = 15;

  // isAdmin is now received as a prop
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

    const fetchConfig = async () => {
      try {
        const snap = await getDoc(doc(db, 'config', 'settings'));
        if (snap.exists()) setConfig(snap.data());
      } catch (err) { console.error("Config fetch error:", err); }
    };
    fetchConfig();
  }, [canSelectProfessional]);

  useEffect(() => {
    fetchOrders(selectedProfId, true);
  }, [selectedProfId]);

  const isFirstRender = React.useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchOrders(selectedProfId, true);
    }, 600);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchOrders = async (profId, reset = false) => {
    setLoading(true);
    if (reset) {
      setOrders([]);
      setLastVisible(null);
    }
    
    try {
      let q;
      const cleanSearch = searchTerm.trim();

      if (cleanSearch.length > 0) {
        // Modo Búsqueda
        const isNumeric = /^\d+$/.test(cleanSearch);
        const searchUpper = cleanSearch.toUpperCase();

        if (isNumeric) {
          if (cleanSearch.length >= 7) {
            q = query(
              collection(db, 'orders'),
              where('dni', '==', cleanSearch),
              limit(100)
            );
          } else {
            q = query(
              collection(db, 'orders'),
              where('dni', '>=', cleanSearch),
              where('dni', '<=', cleanSearch + '\uf8ff'),
              limit(100)
            );
          }
        } else {
          q = query(
            collection(db, 'orders'),
            where('name', '>=', searchUpper),
            where('name', '<=', searchUpper + '\uf8ff'),
            limit(100)
          );
        }

        try {
          const snap = await getDocs(q);
          let list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

          // Filtrar por profesional en memoria
          if (profId && profId !== 'all') {
            list = list.filter(o => o.profesionalId === profId);
          }

          // Ordenar por fecha descendente en memoria
          list.sort((a, b) => {
            const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.createdAt || 0);
            const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.createdAt || 0);
            return dateB - dateA;
          });

          setOrders(list);
          setLastVisible(null);
          setHasMore(false);
        } catch (innerErr) {
          console.error("Error in orders search query:", innerErr);
          showToast("Error al realizar la búsqueda en servidor.", "error");
        }
      } else {
        // Modo Paginación Normal
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
      }
    } catch (err) {
      showToast("Error al cargar pedidos.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleViewOrder = async (order) => {
    showToast("Generando vista previa...");
    try {
      let profProfile = {};
      const profSnap = await getDoc(doc(db, 'users', order.profesionalId));
      if (profSnap.exists()) profProfile = profSnap.data();
      
      const result = await generateOrderPDF(order, profProfile, 'instance');
      const url = result.output('bloburl');
      setPreviewUrl(url);
      setSelectedOrderForPreview({ ...order, profProfile });
    } catch (err) {
      console.error("Error viewing order:", err);
      showToast("Error al visualizar pedido", "error");
    }
  };
  
  const handleResendEmail = async (order) => {
    if (!order.patientEmail) {
      showToast('El pedido no cuenta con un email de paciente registrado.', 'error');
      return;
    }
    if (!config.appsScriptUrl) {
      showToast('Apps Script no configurado.', 'error');
      return;
    }

    setIsResending(order.id);
    showToast("Reenviando pedido...");

    try {
      // 1. Fetch professional profile for signature
      let profProfile = {};
      const profSnap = await getDoc(doc(db, 'users', order.profesionalId));
      if (profSnap.exists()) profProfile = profSnap.data();

      // 2. Generate PDF instance
      const pdfDoc = await generateOrderPDF(order, profProfile, 'instance');
      const pdfBase64 = pdfDoc.output('datauristring').split(',')[1];

      const formatDateForEmail = (dateStr) => {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}-${m}-${y}`;
      };

      const emailFooter = `
        <div style="margin-top: 30px; border-top: 2px solid #2563eb; padding-top: 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="font-family: sans-serif;">
            <tr>
              <td style="vertical-align: top; width: 100px;">
                <img src="https://informescoat.web.app/coat_logo.png" alt="COAT" width="80" style="display: block;">
              </td>
              <td style="vertical-align: top; padding-left: 15px;">
                <h3 style="margin: 0; color: #1e3a8a; font-size: 16px;">COAT</h3>
                <p style="margin: 3px 0; color: #555; font-size: 12px;">📍 Urquiza 401 - Alberdi</p>
                <p style="margin: 3px 0; color: #555; font-size: 12px;">📞 Tel: (0351) 423-0530 / 423-9428</p>
                <p style="margin: 3px 0; color: #555; font-size: 12px;">📱 WhatsApp: <a href="https://wa.me/5493543579794" style="color: #25d366; text-decoration: none; font-weight: bold;">3543579794</a></p>
                <p style="margin: 3px 0; color: #555; font-size: 12px;">📧 Email: <a href="mailto:info@coat.com.ar" style="color: #2563eb; text-decoration: none;">info@coat.com.ar</a></p>
                <div style="margin-top: 10px;">
                  <a href="https://www.facebook.com/coatcordoba" style="text-decoration: none; display: inline-block; margin-right: 15px;">
                    <img src="https://img.icons8.com/color/24/facebook-new.png" width="24" height="24" alt="Facebook" style="vertical-align: middle; border: 0;">
                  </a>
                  <a href="https://www.instagram.com/coatcordoba/" style="text-decoration: none; display: inline-block;">
                    <img src="https://img.icons8.com/color/24/instagram-new.png" width="24" height="24" alt="Instagram" style="vertical-align: middle; border: 0;">
                  </a>
                </div>
              </td>
            </tr>
          </table>
        </div>
      `;

      const displayTitle = order.practices?.join(', ') || 'Pedido Médico';

      const emailBody = `
        <div style="font-family: sans-serif; line-height: 1.6; color: #333; max-width: 600px;">
          <p>Estimado/a <strong>${order.name}</strong>,</p>
          <p>Esperamos que se encuentre bien.</p>
          <p>Le informamos que ya está disponible su <strong>pedido médico</strong> generado en COAT. Adjunto a este correo encontrará el documento en formato PDF.</p>
          
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Detalles del pedido:</strong></p>
            <ul style="list-style: none; padding-left: 0; margin: 10px 0 0 0;">
              <li><strong>Paciente:</strong> ${order.name}</li>
              <li><strong>Estudio/Prácticas:</strong> ${displayTitle}</li>
              <li><strong>Fecha:</strong> ${formatDateForEmail(order.date)}</li>
              <li><strong>Profesional Responsable:</strong> ${order.profesionalName}</li>
            </ul>
          </div>

          <p>Si tiene alguna duda respecto al contenido del pedido, por favor no dude en contactarse con nosotros.</p>
          
          <p>Atentamente,<br/><strong>Equipo de COAT.</strong></p>
          
          ${emailFooter}
          
          <p style="font-size: 11px; color: #999; margin-top: 30px;">
            Este es un mensaje automático, por favor no responda a esta dirección de correo.
          </p>
        </div>
      `;

      const emailPromises = [];
      // Admin copy (ONLY if not sent before)
      if (config.adminEmail && !order.sentToAdmin) {
        emailPromises.push(fetch(config.appsScriptUrl, {
          method: 'POST', mode: 'no-cors',
          body: JSON.stringify({
            token: config.token, pdfBase64,
            recipientEmails: [config.adminEmail],
            subject: `Reenvío Pedido Médico: ${order.name}`,

            message: emailBody,
            fileName: `Pedido_${order.name.replace(/\s/g, '_')}.pdf`
          })
        }));
      }
      // Patient
      emailPromises.push(fetch(config.appsScriptUrl, {
        method: 'POST', mode: 'no-cors',
        body: JSON.stringify({
          token: config.token, pdfBase64,
          recipientEmails: [order.patientEmail],
          subject: `COAT - Reenvío de Pedido Médico: ${order.name}`,
          message: emailBody,
          fileName: `Pedido_${order.name.replace(/\s/g, '_')}.pdf`
        })
      }));

      await Promise.all(emailPromises);
      
      // Update record if it was the first time sending to admin
      if (!order.sentToAdmin) {
        const { updateDoc, doc: fireDoc } = await import('firebase/firestore');
        await updateDoc(fireDoc(db, 'orders', order.id), { sentToAdmin: true });
      }

      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.SEND_ORDER,
        order.id,
        `Pedido reenviado: ${order.name} (${order.practices?.join(', ') || 'Sin prácticas'})`,
        { recipient: order.patientEmail }
      );

      showToast('¡Pedido reenviado con éxito!');
    } catch (err) {
      console.error(err);
      showToast('Error al reenviar email.', 'error');
    } finally {
      setIsResending(null);
    }
  };

  const handleEditOrder = (orderId) => {
    navigate(`/orders/new?edit=${orderId}`);
  };

  const confirmDelete = async () => {
    const order = deleteModal.order;
    if (!order) return;
    setLoading(true);
    try {
      await deleteDoc(doc(db, 'orders', order.id));
      
      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.DELETE_ORDER, 
        order.id, 
        `Pedido eliminado: ${order.name} (${order.practices?.join(', ') || 'Sin prácticas'})`
      );

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

        <div className="md:col-span-3 bg-[var(--bg-card)] p-4 rounded-[2.5rem] border-2 border-slate-200 dark:border-main flex items-center gap-4 shadow-xl shadow-slate-200/50 dark:shadow-none">
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
                      <div className="flex flex-col">
                        <span className="font-bold text-sm text-[var(--text-main)]">
                          {(() => {
                            const [y, m, d] = order.date.split('-').map(Number);
                            const dateStr = new Date(y, m - 1, d).toLocaleDateString('es-AR');
                            const timeStr = order.createdAt 
                              ? ` - ${new Date(order.createdAt.seconds ? order.createdAt.seconds * 1000 : order.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`
                              : '';
                            return `${dateStr}${timeStr}`;
                          })()}
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1">ID: {order.id.substring(0,8)}</span>
                      </div>
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
                        {/* Imprimir / Vista Previa */}
                        <button 
                          onClick={() => handleViewOrder(order)} 
                          className="p-2 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 border border-amber-100 shadow-sm transition-all" 
                          title="Ver PDF / Imprimir"
                        >
                          <Printer size={18} />
                        </button>
                        
                        {/* Reenviar Email */}
                        <button 
                          disabled={isResending === order.id}
                          onClick={() => handleResendEmail(order)} 
                          className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 border border-blue-100 shadow-sm transition-all disabled:opacity-50" 
                          title="Reenviar por Email"
                        >
                          {isResending === order.id ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                        </button>

                        {/* Editar */}
                        {(!isSecretaria || isSuperSecretaria) && (
                          <button 
                            onClick={() => handleEditOrder(order.id)}
                            className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 border border-indigo-100 shadow-sm transition-all"
                            title="Editar Pedido"
                          >
                            <PenLine size={18} />
                          </button>
                        )}

                        {/* Eliminar */}
                        {(isAdmin || isSuperSecretaria || (!isSecretaria && auth.currentUser?.uid === order.profesionalId)) && (
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
      {/* Preview Overlay */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/95 flex flex-col"
          >
            {/* Overlay Header */}
            <div className="h-16 bg-white border-b flex items-center justify-between px-6 shadow-sm shrink-0">
              <div className="flex items-center gap-4">
                <h2 className="text-lg font-black tracking-tight text-slate-800">Vista Previa Pedido</h2>
                <div className="h-6 w-[1px] bg-slate-200"></div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{selectedOrderForPreview?.name}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={async () => await generateOrderPDF(selectedOrderForPreview, selectedOrderForPreview.profProfile, 'save')}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
                >
                  <Download size={16} />
                  Descargar
                </button>
                {selectedOrderForPreview?.patientEmail && (
                  <button 
                    disabled={isResending === selectedOrderForPreview.id}
                    onClick={() => handleResendEmail(selectedOrderForPreview)}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
                  >
                    {isResending === selectedOrderForPreview.id ? <Loader2 className="animate-spin" size={16} /> : <FileText size={16} />}
                    Reenviar al Paciente
                  </button>
                )}
                <button 
                  onClick={async () => await generateOrderPDF(selectedOrderForPreview, selectedOrderForPreview.profProfile, 'print')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95 shadow-lg shadow-blue-500/20"
                >
                  <Printer size={16} />
                  Imprimir
                </button>
                <div className="w-[1px] h-6 bg-slate-200 mx-2"></div>
                <button 
                  onClick={() => {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                    setSelectedOrderForPreview(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black uppercase tracking-tight transition-all active:scale-95"
                >
                  <X size={16} />
                  Cerrar
                </button>
              </div>
            </div>

            {/* Preview Content */}
            <div className="flex-1 overflow-auto p-4 md:p-8 flex justify-center bg-slate-800/50">
              <div className="w-full max-w-5xl h-full bg-white rounded-2xl shadow-2xl overflow-hidden border border-white/10">
                <iframe 
                  src={previewUrl}
                  className="w-full h-full border-none"
                  title="PDF Preview"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MyOrdersPage;
