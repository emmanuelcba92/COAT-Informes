import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

/**
 * Registra una acción en el log de auditoría.
 * @param {string} action - Tipo de acción (ej: 'DELETE_PATIENT', 'EDIT_REPORT')
 * @param {string} targetId - ID del documento afectado
 * @param {string} targetName - Nombre o descripción del documento afectado
 * @param {object} details - Información adicional (opcional)
 */
export const logAction = async (action, targetId, targetName, details = {}) => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, 'audit_logs'), {
      timestamp: serverTimestamp(),
      userId: user.uid,
      userEmail: user.email,
      userName: localStorage.getItem('audit_user_name') || user.displayName || 'Usuario sin nombre',
      action,
      targetId,
      targetName,
      details,
      clientInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform
      }
    });
  } catch (error) {
    console.error('Error recording audit log:', error);
    // No lanzamos error para no romper la experiencia del usuario si falla el log
  }
};

export const AUDIT_ACTIONS = {
  DELETE_PATIENT: 'ELIMINAR_PACIENTE',
  EDIT_PATIENT: 'EDITAR_PACIENTE',
  DELETE_REPORT: 'ELIMINAR_REPORTE',
  EDIT_REPORT: 'EDITAR_REPORTE',
  DELETE_ORDER: 'ELIMINAR_PEDIDO',
  EDIT_ORDER: 'EDITAR_PEDIDO',
  ADMIN_CHANGE_SETTINGS: 'CAMBIO_CONFIGURACION',
  AUTH_LOGIN: 'INICIO_SESION',
  CREATE_REPORT: 'CREAR_REPORTE',
  SEND_REPORT: 'ENVIAR_REPORTE',
  CREATE_ORDER: 'CREAR_PEDIDO',
  SEND_ORDER: 'ENVIAR_PEDIDO',
  UPLOAD_EXTERNAL_PDF: 'SUBIDA_PDF_EXTERNO'
};
