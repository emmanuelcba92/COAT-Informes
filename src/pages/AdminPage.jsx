import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ClinicalEditor from '../components/ClinicalEditor';
import {
  Activity,
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
  Search as SearchIcon,
  CheckCircle2,
  Loader2,
  Save,
  UserCog,
  Upload,
  Briefcase,
  FileText,
  BookOpen,
  User as UserIcon,
  Database,
  RefreshCw,
  History,
  FileSearch,
  ShieldAlert,
  Clock,
  Send,
  ChevronDown
} from "lucide-react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import * as XLSX from "xlsx";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { db } from "../services/firebase";
import { AUDIT_ACTIONS, logAction } from "../services/auditService";
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
  limit,
  getCountFromServer,
  writeBatch,
} from "firebase/firestore";
import { supabase } from '../services/supabase';
import { formatDisplayName } from '../utils/userNormalization';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const AdminPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("users");
  const [appsScriptUrl, setAppsScriptUrl] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [token, setToken] = useState("");
  const [driveFolderId, setDriveFolderId] = useState("");
  const [ordersFolderId, setOrdersFolderId] = useState("");
  const [autoSaveToDrive, setAutoSaveToDrive] = useState(false);
  const [showPrivacyToggle, setShowPrivacyToggle] = useState(true);
  const [showSendButton, setShowSendButton] = useState(true);
  // Full config/settings object — used for report required-fields toggles
  const [config, setConfig] = useState({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [driveQuota, setDriveQuota] = useState(null);
  const [driveError, setDriveError] = useState(false);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [pasteData, setPasteData] = useState("");
  const [manualUserForm, setManualUserForm] = useState({
    nombre: "",
    mp: "",
    me: "",
    especialidad: "Otorrinolaringología",
    u: "",
    password: "",
    role: "orl",
    prefix: "",
  });
  const [loading, setLoading] = useState(true);

  // State for Users
  const [users, setUsers] = useState([]);
  const [loadingResetId, setLoadingResetId] = useState(null);
  const [userSearch, setUserSearch] = useState("");

  // State for Practices
  const [practices, setPractices] = useState([]);
  const [practiceSearch, setPracticeSearch] = useState("");
  const [practiceForm, setPracticeForm] = useState({
    c: "",
    n: "",
    b: "",
    st: true,
  });
  const [selectedPractice, setSelectedPractice] = useState(null);

  // State for Managing Professional Profile
  const [isManageProfessionalModalOpen, setIsManageProfessionalModalOpen] =
    useState(false);
  const [targetProf, setTargetProf] = useState(null);
  const [isProfSaving, setIsProfSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewType, setPreviewType] = useState("general"); // 'general' or 'fibro'
  const [isUploadingSignature, setIsUploadingSignature] = useState(false);

  // State for Managing Professional MODELS (Personal Practices)
  const [isModelsModalOpen, setIsModelsModalOpen] = useState(false);
  const [targetUserForModels, setTargetUserForModels] = useState(null);
  const [isModelsSaving, setIsModelsSaving] = useState(false);
  const [editingModelId, setEditingModelId] = useState(null);
  const [modelForm, setModelForm] = useState({ n: "", b: "", practiceId: "" });

  // State for Order Settings (DYNAMIC CATEGORIES)
  const [orderSettings, setOrderSettings] = useState({
    categories: [],
    practicesByType: {},
    patientEmailRequired: false,
    ordersEnabled: true,
    autoCleanDays: 0,
  });
  const [isSavingOrderSettings, setIsSavingOrderSettings] = useState(false);
  const [selectedOrderCategory, setSelectedOrderCategory] = useState(null);
  const [newCategoryForm, setNewCategoryForm] = useState({
    id: "",
    label: "",
    icon: "Clipboard",
  });
  const [newPracticeForm, setNewPracticeForm] = useState({ n: "", c: "", allowedRoles: [] });
  const [editingOrderPracticeIdx, setEditingOrderPracticeIdx] = useState(null);
  const [editOrderPracticeForm, setEditOrderPracticeForm] = useState({ n: "", c: "", allowedRoles: [] });

  // State for Audit Logs
  const [auditLogs, setAuditLogs] = useState([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [auditLimit, setAuditLimit] = useState(100);
  const [hasMoreAudit, setHasMoreAudit] = useState(true);
  const [lastAuditDoc, setLastAuditDoc] = useState(null);



  const autoCleanPerformed = useRef(false);

  // Auto-cleanup trigger
  useEffect(() => {
    if (orderSettings.autoCleanDays > 0 && !autoCleanPerformed.current) {
      autoCleanPerformed.current = true;
      runAutoCleanup(orderSettings.autoCleanDays);
    }
  }, [orderSettings.autoCleanDays]);

  // Security Check
  useEffect(() => {
    const checkAuth = async () => {
      const user = getAuth().currentUser;
      if (!user) {
        navigate("/login");
        return;
      }

      const email = user.email?.toLowerCase();
      const whiteList = ["egomez@coat.com.ar"];

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const profile = docSnap.data();
          const role = profile.role?.toLowerCase() || "";

          const medicalRoles = ['cabeza y cuello', 'cx plástica', 'electrografías', 'orl', 'vestibular', 'fonoaudiología', 'directora_medica'];
          const isMedicalRole = medicalRoles.includes(role) || role.includes('médico') || role.includes('fonoaudiología');

          const isAuthorized = role === "admin" || whiteList.includes(email);

          if (!isAuthorized) {
            console.warn(
              "Acceso denegado a Administración para:",
              email,
              "Rol:",
              role,
            );
            navigate("/");
          }
        } else if (!whiteList.includes(email)) {
          navigate("/");
        }
      } catch (err) {
        console.error("Error verificando permisos:", err);
        if (!whiteList.includes(email)) navigate("/");
      }
    };
    checkAuth();
  }, [navigate]);

  // Real-time synchronization
  useEffect(() => {
    setLoading(true);

    // Sync Practices
    const qPractices = query(collection(db, "practices"), orderBy("n", "asc"));
    const unsubscribePractices = onSnapshot(qPractices, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPractices(list);
    });

    // Sync Users
    const qUsers = query(collection(db, "users"));
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const uniqueUsers = {};
      list.forEach((u) => {
        const email = (
          u.email ||
          u.e ||
          (typeof u.id === "string" && u.id.includes("@") ? u.id : "")
        )
          .toLowerCase()
          .trim();
        const username = (u.u || "").toLowerCase().trim();
        const key = email || username || u.id;

        if (!key) return;

        if (!uniqueUsers[key]) {
          uniqueUsers[key] = u;
        } else {
          const existing = uniqueUsers[key];
          const currentHasName = !!(u.nombre || u.n);
          const existingHasName = !!(existing.nombre || existing.n);

          if (currentHasName && !existingHasName) {
            uniqueUsers[key] = u;
          }
          if (u.id.length === 28 && existing.id.length !== 28) {
            uniqueUsers[key] = u;
          }
        }
      });
      setUsers(Object.values(uniqueUsers));
      setLoading(false);
    });

    // fetchStorageStats(); // Removed from here, moved to dedicated effect
    fetchGlobalStats();

    // Sync Settings
    const unsubscribeSettings = onSnapshot(
      doc(db, "config", "settings"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setAppsScriptUrl(data.appsScriptUrl || "");
          setAdminEmail(data.adminEmail || "");
          setToken(data.token || "");
          setDriveFolderId(data.driveFolderId || "");
          setOrdersFolderId(data.ordersFolderId || "");
          setAutoSaveToDrive(data.autoSaveToDrive || false);
          setShowPrivacyToggle(data.showPrivacyToggle !== false);
          setShowSendButton(data.showSendButton !== false);
          setConfig(data); // full config object for feature toggles
        }
      },
    );

    // Sync Order Settings
    const unsubscribeOrderSettings = onSnapshot(
      doc(db, "config", "order_settings"),
      (docSnap) => {
        if (docSnap.exists()) {
          setOrderSettings(docSnap.data());
        }
      },
    );

    return () => {
      unsubscribePractices();
      unsubscribeUsers();
      unsubscribeSettings();
      unsubscribeOrderSettings();
    };
  }, []);

  // Dedicated effect for Drive Quota - ensures it fetches when URL is ready
  useEffect(() => {
    if (appsScriptUrl) {
      const fetchDriveQuota = async () => {
        setDriveError(false);
        try {
          const res = await fetch(appsScriptUrl);
          if (res.ok) {
            const data = await res.json();
            setDriveQuota(data);
          } else {
            setDriveError(true);
          }
        } catch (e) {
          console.error("Error fetching drive quota:", e);
          setDriveError(true);
        }
      };
      fetchDriveQuota();
    }
  }, [appsScriptUrl]);

  // Dedicated effect for Storage Stats - triggered when entering Stats tab or on mount
  useEffect(() => {
    if (activeTab === "stats") {
      fetchStorageStats();
    }
  }, [activeTab]);

  // ESTADOS PARA MANTENIMIENTO Y ALMACENAMIENTO
  const [storageStats, setStorageStats] = useState({
    fbCount: 0,
    fbSize: 0,
    sbCount: 0,
    sbSize: 0,
    loading: true,
  });
  const [globalStats, setGlobalStats] = useState({
    patients: 0,
    reports: 0,
    orders: 0,
    loading: true,
  });
  const [cleanRange, setCleanRange] = useState({ start: "", end: "" });
  const [cleanOptions, setCleanOptions] = useState({
    pdfs: true,
    records: false,
    target: "reports", // "reports", "orders", "both"
  });
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanSummary, setCleanSummary] = useState(null);

  const fetchGlobalStats = async () => {
    setGlobalStats((prev) => ({ ...prev, loading: true }));
    try {
      const [patientsCount, reportsCount, ordersCount] = await Promise.all([
        getCountFromServer(collection(db, "patients")),
        getCountFromServer(collection(db, "reports")),
        getCountFromServer(collection(db, "orders")),
      ]);

      setGlobalStats({
        patients: patientsCount.data().count,
        reports: reportsCount.data().count,
        orders: ordersCount.data().count,
        loading: false,
      });


    } catch (err) {
      console.error("Error fetching global stats:", err);
      setGlobalStats((prev) => ({ ...prev, loading: false }));
    }
  };

  const fetchStorageStats = async () => {
    setStorageStats((prev) => ({ ...prev, loading: true }));
    try {
      // 1. Firebase Stats (Optimized: Using Count instead of full fetch)
      const [reportsCount, ordersCount, patientsCount] = await Promise.all([
        getCountFromServer(collection(db, "reports")),
        getCountFromServer(collection(db, "orders")),
        getCountFromServer(collection(db, "patients")),
      ]);

      const fbCount = reportsCount.data().count + ordersCount.data().count + patientsCount.data().count;

      // Estimación de peso para evitar descargar miles de documentos (1KB por doc prom)
      const reportsBytes = reportsCount.data().count * 1024;
      const ordersBytes = ordersCount.data().count * 800;
      const patientsBytes = patientsCount.data().count * 500;

      const totalBytes = reportsBytes + ordersBytes + patientsBytes;

      // 2. Supabase (Files)
      const { data: files } = await supabase.storage
        .from("informescoat")
        .list("", { limit: 1000 });

      let sbSize = 0;
      let sbCount = 0;
      if (files) {
        const realFiles = files.filter(
          (f) => f.name !== ".emptyFolderPlaceholder",
        );
        sbCount = realFiles.length;
        sbSize = realFiles.reduce(
          (acc, file) => acc + (file.metadata?.size || 0),
          0,
        );
      }

      // 3. Google Drive (Quota) - Logic moved to dedicated useEffect for reactivity
      // But we still call it here if manually refreshing
      if (appsScriptUrl) {
        try {
          const res = await fetch(appsScriptUrl);
          if (res.ok) {
            const data = await res.json();
            setDriveQuota(data);
          }
        } catch (e) {
          console.error("Error fetching drive quota:", e);
        }
      }

      setStorageStats({
        fbCount,
        fbSize: (totalBytes / 1024).toFixed(2),
        reportsSize: (reportsBytes / 1024).toFixed(2),
        ordersSize: (ordersBytes / 1024).toFixed(2),
        patientsSize: (patientsBytes / 1024).toFixed(2),
        sbCount,
        sbSize: (sbSize / (1024 * 1024)).toFixed(2),
        loading: false,
      });
    } catch (err) {
      console.error("Error fetching stats:", err);
      setStorageStats((prev) => ({ ...prev, loading: false }));
    }
  };

  const handleAnalyzeCleanup = async () => {
    if (!cleanRange.start || !cleanRange.end) {
      alert("Por favor seleccione un rango de fechas válido.");
      return;
    }
    setIsCleaning(true);
    setCleanSummary(null);

    try {
      const collectionsToClean =
        cleanOptions.target === "both"
          ? ["reports", "orders"]
          : [cleanOptions.target];
      
      let allDocs = [];
      
      for (const collName of collectionsToClean) {
        // En orders la fecha se guarda en 'date', en reports en 'fecha'
        const dateField = collName === "orders" ? "date" : "fecha";
        const q = query(
          collection(db, collName),
          where(dateField, ">=", cleanRange.start),
          where(dateField, "<=", cleanRange.end),
        );
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => ({ id: d.id, coll: collName, ...d.data() }));
        allDocs = [...allDocs, ...docs];
      }

      const withFiles = allDocs.filter(
        (d) => d.storagePath || d.pdfUrl?.includes("supabase"),
      );

      setCleanSummary({
        total: allDocs.length,
        withFiles: withFiles.length,
        estimatedSize: (withFiles.length * 0.5).toFixed(1),
        docs: allDocs,
      });
    } catch (err) {
      console.error("Error analyzing:", err);
      alert("Error al analizar los datos.");
    } finally {
      setIsCleaning(false);
    }
  };

  const handleExecuteCleanup = async () => {
    if (!cleanSummary) return;
    
    const targetLabel = 
      cleanOptions.target === 'both' ? 'INFORMES Y PEDIDOS' :
      cleanOptions.target === 'orders' ? 'PEDIDOS' : 'INFORMES';

    if (
      !window.confirm(
        `¿ESTÁ SEGURO? Esta acción es irreversible.\nSe eliminarán ${cleanOptions.records ? "REGISTROS Y ARCHIVOS" : "SOLO ARCHIVOS"} de ${cleanSummary.total} ${targetLabel.toLowerCase()}.`,
      )
    )
      return;

    setIsCleaning(true);
    try {
      let filesDeleted = 0;
      let recordsDeleted = 0;

      if (cleanOptions.pdfs) {
        for (const docData of cleanSummary.docs) {
          const path = docData.storagePath;
          if (path) {
            const { error } = await supabase.storage
              .from("informescoat")
              .remove([path]);
            if (!error) filesDeleted++;
          }
        }
      }

      const batch = writeBatch(db);
      if (cleanOptions.records) {
        cleanSummary.docs.forEach((d) => {
          batch.delete(doc(db, d.coll, d.id));
          recordsDeleted++;
        });
      } else if (cleanOptions.pdfs) {
        cleanSummary.docs.forEach((d) => {
          if (d.storagePath) {
            batch.update(doc(db, d.coll, d.id), {
              pdfUrl: null,
              storagePath: null,
              notaMantenimiento: `Archivo eliminado por limpieza el ${new Date().toLocaleDateString()}`,
            });
          }
        });
      }
      
      if (cleanOptions.records || cleanOptions.pdfs) {
        await batch.commit();
      }

      alert(
        `Limpieza completada:\n- Archivos borrados: ${filesDeleted}\n- Registros borrados: ${recordsDeleted}`,
      );
      setCleanSummary(null);
      fetchStorageStats();
    } catch (err) {
      console.error("Error in cleanup:", err);
      alert("Ocurrió un error parcial durante la limpieza.");
    } finally {
      setIsCleaning(false);
    }
  };

  const runAutoCleanup = async (days) => {
    console.log(`Iniciando auto-limpieza de pedidos (Antigüedad: ${days} días)`);
    const limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);
    const dateStr = limitDate.toLocaleDateString('en-CA');

    try {
      const q = query(
        collection(db, "orders"),
        where("date", "<", dateStr)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        console.log("Auto-limpieza: No hay pedidos antiguos para procesar.");
        return;
      }

      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log(`Auto-limpieza: Encontrados ${docs.length} pedidos para borrar.`);

      // 1. Borrar archivos en Supabase
      const pathsToDelete = docs.map(d => d.storagePath).filter(Boolean);
      if (pathsToDelete.length > 0) {
        // Supabase remove acepta un array
        await supabase.storage.from("informescoat").remove(pathsToDelete);
      }

      // 2. Borrar registros en Firestore
      const batch = writeBatch(db);
      docs.forEach(d => {
        batch.delete(doc(db, "orders", d.id));
      });
      await batch.commit();
      
      console.log("Auto-limpieza de pedidos completada con éxito.");
      fetchStorageStats();
    } catch (err) {
      console.error("Error en auto-limpieza:", err);
    }
  };

  const handleCleanOrphans = async () => {
    if (
      !window.confirm(
        "¿Desea eliminar los archivos de ALMACENAMIENTO que NO tienen un informe asociado? (Esto NO borrará firmas)",
      )
    )
      return;
    setIsCleaning(true);
    try {
      // 1. Obtener todos los archivos de Supabase (Raíz)
      const { data: files } = await supabase.storage
        .from("informescoat")
        .list("", { limit: 1000 });
      if (!files || files.length === 0) {
        alert("No hay archivos en la raíz de Supabase.");
        return;
      }

      // 2. Obtener todos los storagePaths de Firebase (Informes)
      const fbSnap = await getDocs(collection(db, "reports"));
      const activePaths = new Set(
        fbSnap.docs.map((doc) => doc.data().storagePath).filter(Boolean),
      );

      // 3. Obtener todas las firmas activas de Usuarios (Para protegerlas)
      const usersSnap = await getDocs(collection(db, "users"));
      const signatureUrls = usersSnap.docs
        .map((doc) => doc.data().signatureBase64)
        .filter(Boolean);

      // 4. Identificar huérfanos con PROTECCIÓN
      const orphanedPaths = files
        .filter((f) => {
          const name = f.name;
          // PROTECCIÓN 1: No borrar carpetas (metadata null en list suele ser carpeta)
          if (!f.metadata) return false;
          // PROTECCIÓN 2: No borrar la carpeta de firmas ni archivos dentro de ella (aunque list root no debería traerlos)
          if (name === "firmas" || name === ".emptyFolderPlaceholder")
            return false;
          // PROTECCIÓN 3: Si es un reporte activo, ignorar
          if (activePaths.has(name)) return false;
          // PROTECCIÓN 4: Si por alguna razón la URL de una firma coincide con el nombre del archivo, proteger
          const isASignature = signatureUrls.some((url) => url.includes(name));
          if (isASignature) return false;

          return true; // Es un huérfano real en la raíz
        })
        .map((f) => f.name);

      if (orphanedPaths.length === 0) {
        alert("No se encontraron archivos huérfanos en la raíz.");
      } else {
        const { error } = await supabase.storage
          .from("informescoat")
          .remove(orphanedPaths);
        if (error) {
          alert("Error de Supabase: " + error.message);
        } else {
          alert(
            `Limpieza protegida finalizada. Se borraron ${orphanedPaths.length} archivos huérfanos.`,
          );
        }
      }

      setTimeout(() => fetchStorageStats(), 1500);
    } catch (err) {
      alert("Error crítico limpiando huérfanos: " + err.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const tabs = [
    { id: "users", icon: <Users size={18} />, label: "Usuarios" },
    { id: "stats", icon: <Activity size={18} />, label: "Métricas" },
    { id: "practices", icon: <FileText size={18} />, label: "Modelos" },
    { id: "orders", icon: <ClipboardList size={18} />, label: "Gestión Pedidos" },
    { id: "settings", icon: <Settings2 size={18} />, label: "Configuración" },
    { id: "audit", icon: <History size={18} />, label: "Auditoría" },
  ];

  const handleResetPassword = async (user) => {
    const std = getStandardUser(user);
    if (!std.email) return alert("El usuario no tiene un email válido.");
    if (!appsScriptUrl) return alert("Configure la URL de Apps Script en la pestaña Configuración.");

    if (!window.confirm(`¿Está seguro de restablecer la contraseña para ${std.nombre}? Se enviará un correo con la nueva clave temporal.`)) return;

    setLoadingResetId(user.id);
    try {
      const response = await fetch(appsScriptUrl, {
        method: "POST",
        mode: "no-cors", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "resetPassword",
          email: std.email,
          token: token
        }),
      });

      alert(`Petición enviada. Si el correo existe en el sistema, recibirá un mail en breve.`);
      
      await logAction(
        AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS,
        user.id,
        `Reseteo de contraseña solicitado para: ${std.nombre} (${std.email})`
      );
    } catch (err) {
      console.error("Error resetting password:", err);
      alert("Error al enviar solicitud: " + err.message);
    } finally {
      setLoadingResetId(null);
    }
  };

  // Helper to get standardized user data
  const getStandardUser = (u) => {
    let rawRole = (u.role || u.rol || "").toLowerCase().trim();
    // Migración automática de rol legacy
    if (!rawRole || rawRole === 'médico' || rawRole === 'medico') {
      rawRole = 'orl';
    }
    
    // Función para Title Case + Limpieza
    const formatName = (str) => {
      if (!str) return "";
      // Limpiar títulos previos
      const clean = str
        .replace(/(DR|DRA|LIC|PROF|BIOQ|FON)\s*\.?\s*/gi, '')
        .replace(/^[.\s,]+/, '')
        .trim();
      
      return clean.toLowerCase().split(' ').map(word => {
        return word.charAt(0).toUpperCase() + word.slice(1);
      }).join(' ');
    };

    const isStaff = rawRole === "admin" || rawRole === "secretaria" || rawRole === "secre" || rawRole === "secretaría";
    return {
      nombre: formatName(u.nombre || u.n || u.u || "Profesional"),
      prefix: u.prefix || "",
      email: (u.email || u.e || u.u || "").toLowerCase().trim(),
      especialidad: isStaff
        ? ""
        : u.especialidad || u.esp || "Otorrinolaringólogo",
      mp: isStaff ? "" : u.mp || u.m || "-",
      me: isStaff ? "" : u.me || "-",
      id: u.id,
      role: rawRole,
      isOfficial: u.id.length === 28,
      lastLogin: u.lastLogin || null,
    };
  };

  const handleUpdateUserPrefix = async (userId, newPrefix) => {
    try {
      const userRef = doc(db, "users", userId);
      const targetUser = users.find(u => u.id === userId);
      
      // Al actualizar el prefijo, también limpiamos el nombre por si acaso
      const rawName = targetUser.nombre || targetUser.n || targetUser.u || "";
      const cleanName = rawName
        .replace(/(DR|DRA|LIC|PROF(\.\sDR)?)\s*\.?\s*/gi, '')
        .replace(/^[.\s,]+/, '')
        .trim()
        .toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

      await updateDoc(userRef, { 
        prefix: newPrefix,
        nombre: cleanName
      });
      
      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS,
        userId,
        `Actualizado prefijo de ${cleanName} a: ${newPrefix || 'Ninguno'}`,
        { targetUserId: userId, newPrefix, cleanName }
      );
    } catch (err) {
      console.error("Error actualizando prefijo:", err);
      alert("Error al actualizar prefijo: " + err.message);
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      const userRef = doc(db, "users", userId);
      const targetUser = users.find(u => u.id === userId);
      const userName = targetUser ? (targetUser.nombre || targetUser.u) : userId;

      // También aprovechamos para limpiar el nombre si existe
      const updateData = { role: newRole, rol: newRole };
      if (targetUser && (targetUser.nombre || targetUser.n)) {
        const rawName = targetUser.nombre || targetUser.n;
        updateData.nombre = rawName
          .replace(/(DR|DRA|LIC|PROF|BIOQ|FON)\s*\.?\s*/gi, '')
          .replace(/^[.\s,]+/, '')
          .trim()
          .toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      }

      await updateDoc(userRef, updateData);
      
      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS,
        userId,
        `Cambio de rol de ${userName} a: ${newRole} (Nombre normalizado)`,
        { targetUserId: userId, newRole, userName }
      );
    } catch (err) {
      console.error("Error actualizando rol:", err);
      alert("Error al actualizar rol: " + err.message);
    }
  };

  const handleGlobalNameCleanup = async () => {
    if (!window.confirm("¿Desea normalizar TODOS los nombres de usuario? (Pasará a Mayúscula/Minúscula y quitará prefijos incrustados)")) return;
    
    setLoading(true);
    let count = 0;
    try {
      const batch = writeBatch(db);
      users.forEach(u => {
        const rawName = u.nombre || u.n || u.u || "";
        // Detectar si tiene prefijo incrustado para extraerlo si el usuario no tiene prefijo aún
        let detectedPrefix = u.prefix || "";
        if (!detectedPrefix) {
          const match = rawName.match(/^(DR|DRA|LIC|PROF|BIOQ|FON)\s*\.?\s*/i);
          if (match) {
            detectedPrefix = match[0].trim().replace(/\.?$/, '.') ;
            // Normalizar el prefijo detectado
            if (detectedPrefix.toUpperCase().startsWith("DR.")) detectedPrefix = "Dr.";
            if (detectedPrefix.toUpperCase().startsWith("DRA.")) detectedPrefix = "Dra.";
            if (detectedPrefix.toUpperCase().startsWith("LIC.")) detectedPrefix = "Lic.";
          }
        }

        const cleanName = rawName
          .replace(/(DR|DRA|LIC|PROF|BIOQ|FON)\s*\.?\s*/gi, '')
          .replace(/^[.\s,]+/, '')
          .trim()
          .toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
        
        if (cleanName) {
          batch.update(doc(db, "users", u.id), {
            nombre: cleanName,
            prefix: detectedPrefix
          });
          count++;
        }
      });
      await batch.commit();
      alert(`Se han normalizado ${count} usuarios con éxito.`);
    } catch (err) {
      console.error("Error en limpieza global:", err);
      alert("Error en limpieza: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async (id) => {
    if (
      window.confirm(
        "¿Eliminar este perfil profesional? (No elimina su cuenta de acceso de Firebase Auth)",
      )
    ) {
      try {
        const targetUser = users.find(u => u.id === id);
        const userName = targetUser ? (targetUser.nombre || targetUser.u) : id;

        await deleteDoc(doc(db, "users", id));
        // LOG AUDIT
        await logAction(
          AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS,
          id,
          `Perfil profesional eliminado: ${userName}`
        );
      } catch (err) {
        alert("Error: " + err.message);
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
        const wb = XLSX.read(bstr, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws);

        const secondaryApp = initializeApp(firebaseConfig, "SecondaryExcel");
        const secondaryAuth = getAuth(secondaryApp);

        for (const item of data) {
          const userData = {
            nombre: (
              item.Profesional ||
              item.Nombre ||
              item.nombre ||
              "Profesional"
            ).trim(),
            mp: item.MP || item.mp || "-",
            me: item.ME || item.me || "-",
            especialidad: item.Especialidad || item.especialidad || "ORL",
            u: (item.Usuario || item.usuario || "user").toLowerCase().trim(),
            email: `${(item.Usuario || item.usuario || "user").toLowerCase().trim()}@coat.com.ar`,
          };
          const password = (
            item.Contraseña ||
            item.contraseña ||
            "123456"
          ).toString();

          try {
            const userCredential = await createUserWithEmailAndPassword(
              secondaryAuth,
              userData.email,
              password,
            );
            await setDoc(
              doc(db, "users", userCredential.user.uid),
              { ...userData, isOfficial: true },
              { merge: true },
            );
            await signOut(secondaryAuth);
          } catch (authErr) {
            const userSlug = userData.email.replace(/[@.]/g, "_");
            await setDoc(doc(db, "users", userSlug), userData, { merge: true });
          }
        }
        await deleteApp(secondaryApp);
        alert("Carga masiva finalizada");
      } catch (error) {
        alert("Error en Excel");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleSavePractice = async () => {
    if (!practiceForm.c || !practiceForm.n) return alert("Campos obligatorios");
    try {
      const dataToSave = {
        ...practiceForm,
        allowedRoles: practiceForm.allowedRoles || []
      };
      
      if (selectedPractice) {
        await updateDoc(
          doc(db, "practices", selectedPractice.id),
          dataToSave,
        );
        setSelectedPractice(null);

        // LOG AUDIT
        await logAction(
          AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS,
          selectedPractice.id,
          `Modelo de informe editado: ${dataToSave.n}`
        );
      } else {
        const docRef = await addDoc(collection(db, "practices"), dataToSave);
        
        // LOG AUDIT
        await logAction(
          AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS,
          docRef.id,
          `Nuevo modelo de informe creado: ${dataToSave.n}`
        );
      }
      setPracticeForm({ c: "", n: "", b: "", st: true, allowedRoles: [] });
    } catch (err) {
      alert(err.message);
    }
  };

  const handleEditPractice = (p) => {
    console.log("Editing Practice:", p);
    setSelectedPractice(p);
    const newData = {
      c: p.c || "",
      n: p.n || "",
      b: p.b || "",
      st: p.st !== undefined ? p.st : true,
      allowedRoles: p.allowedRoles || [],
    };
    console.log("Setting practiceForm to:", newData);
    setPracticeForm(newData);
  };

  const handleDeletePractice = async (id) => {
    if (window.confirm("¿Eliminar modelo de informe?")) {
      const targetPractice = practices.find(p => p.id === id);
      const practiceName = targetPractice ? targetPractice.n : id;

      await deleteDoc(doc(db, "practices", id));
      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS, 
        id, 
        `Modelo de informe eliminado: ${practiceName}`
      );
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, "config", "settings"), {
        appsScriptUrl,
        adminEmail,
        token,
        driveFolderId,
        ordersFolderId,
        autoSaveToDrive,
        showPrivacyToggle,
        showSendButton
      }, { merge: true });

      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS, 
        "global_settings", 
        "Configuración general del sistema"
      );

      alert("Configuración guardada correctamente");
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Generic config/settings saver (merge) — used by report required-fields panel
  const handleSaveConfig = async (newConfigData) => {
    try {
      await setDoc(doc(db, "config", "settings"), newConfigData, { merge: true });
      setConfig(newConfigData);

      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS, 
        "field_requirements", 
        "Requerimientos de campos en informes"
      );
    } catch (err) {
      alert("Error al guardar configuración: " + err.message);
    }
  };

  const handleSaveOrderSettings = async (newData, customLogMsg) => {
    setIsSavingOrderSettings(true);
    try {
      await setDoc(doc(db, "config", "order_settings"), newData);
      
      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS,
        "order_settings",
        customLogMsg || "Configuración de gestión de pedidos"
      );
    } catch (err) {
      alert("Error al guardar gestión de pedidos: " + err.message);
    } finally {
      setIsSavingOrderSettings(false);
    }
  };

  const handleAddOrderCategory = async () => {
    if (!newCategoryForm.id || !newCategoryForm.label)
      return alert("Complete los datos de la categoría");
    const updated = {
      ...orderSettings,
      categories: [...orderSettings.categories, newCategoryForm],
      practicesByType: {
        ...orderSettings.practicesByType,
        [newCategoryForm.id]: [],
      },
    };
    await handleSaveOrderSettings(updated, `Nueva categoría añadida: ${newCategoryForm.label}`);
    setNewCategoryForm({ id: "", label: "", icon: "Clipboard" });
  };

  const handleDeleteOrderCategory = async (catId) => {
    if (!window.confirm("¿Eliminar categoría y todas sus prácticas?"))
      return;
    const targetCat = orderSettings.categories.find(c => c.id === catId);
    const catLabel = targetCat ? targetCat.label : catId;

    const updated = {
      ...orderSettings,
      categories: orderSettings.categories.filter((c) => c.id !== catId),
      practicesByType: { ...orderSettings.practicesByType },
    };
    delete updated.practicesByType[catId];
    await handleSaveOrderSettings(updated, `Categoría eliminada: ${catLabel}`);
    if (selectedOrderCategory === catId) setSelectedOrderCategory(null);
  };

  const handleAddOrderPractice = async () => {
    if (!selectedOrderCategory || !newPracticeForm.n)
      return alert("Complete nombre de la práctica");
    const currentList =
      orderSettings.practicesByType[selectedOrderCategory] || [];
    const updated = {
      ...orderSettings,
      practicesByType: {
        ...orderSettings.practicesByType,
        [selectedOrderCategory]: [...currentList, newPracticeForm],
      },
    };
    await handleSaveOrderSettings(updated, `Nueva práctica añadida a ${selectedOrderCategory}: ${newPracticeForm.n}`);
    setNewPracticeForm({ n: "", c: "" });
  };

  const handleStartEditOrderPractice = (idx, p) => {
    setEditingOrderPracticeIdx(idx);
    setEditOrderPracticeForm({ n: p.n, c: p.c || "", allowedRoles: p.allowedRoles || [] });
  };

  const handleSaveEditOrderPractice = async (idx) => {
    if (!editOrderPracticeForm.n) return alert("El nombre es obligatorio");
    const currentList = [
      ...(orderSettings.practicesByType[selectedOrderCategory] || []),
    ];
    currentList[idx] = editOrderPracticeForm;

    const updated = {
      ...orderSettings,
      practicesByType: {
        ...orderSettings.practicesByType,
        [selectedOrderCategory]: currentList,
      },
    };
    await handleSaveOrderSettings(updated, `Práctica editada en ${selectedOrderCategory}: ${editOrderPracticeForm.n}`);
    setEditingOrderPracticeIdx(null);
  };

  const handleReorderOrderPractices = (newList) => {
    const updated = {
      ...orderSettings,
      practicesByType: {
        ...orderSettings.practicesByType,
        [selectedOrderCategory]: newList,
      },
    };
    // Update local state immediately for smoothness
    setOrderSettings(updated);
    // Then persist
    handleSaveOrderSettings(updated);
  };

  const handleDeleteOrderPractice = async (pIdx) => {
    const currentList = [
      ...(orderSettings.practicesByType[selectedOrderCategory] || []),
    ];
    const targetPractice = currentList[pIdx];
    const practiceName = targetPractice ? targetPractice.n : "desconocida";

    currentList.splice(pIdx, 1);
    const updated = {
      ...orderSettings,
      practicesByType: {
        ...orderSettings.practicesByType,
        [selectedOrderCategory]: currentList,
      },
    };

    const catObj = orderSettings.categories.find(c => c.id === selectedOrderCategory);
    const catLabel = catObj ? catObj.label : selectedOrderCategory;

    await handleSaveOrderSettings(updated, `Práctica "${practiceName}" eliminada de ${catLabel}`);
  };

  const handleManageUser = (user) => {
    setTargetProf({
      ...user,
      headerGeneral: user.headerGeneral || Array(8).fill(""),
      headerFibro: user.headerFibro || Array(8).fill(""),
      signatureBase64: user.signatureBase64 || null,
      hasLetterhead: user.hasLetterhead || false,
      canCustomizeModels: user.canCustomizeModels || user.role === 'directora_medica' || false,
    });
    setIsManageProfessionalModalOpen(true);
  };

  const fetchAuditLogs = async (isLoadMore = false, manualLimit = null) => {
    setIsLoadingAudit(true);
    const effectiveLimit = manualLimit || auditLimit;
    try {
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      let q = query(
        collection(db, "audit_logs"),
        where("timestamp", ">=", ninetyDaysAgo),
        orderBy("timestamp", "desc"),
        limit(effectiveLimit)
      );

      if (isLoadMore && lastAuditDoc) {
        q = query(
          collection(db, "audit_logs"),
          where("timestamp", ">=", ninetyDaysAgo),
          orderBy("timestamp", "desc"),
          startAfter(lastAuditDoc),
          limit(effectiveLimit)
        );
      }

      const snap = await getDocs(q);
      const logs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      if (isLoadMore) {
        setAuditLogs(prev => [...prev, ...logs]);
      } else {
        setAuditLogs(logs);
      }

      setLastAuditDoc(snap.docs[snap.docs.length - 1] || null);
      setHasMoreAudit(snap.docs.length === effectiveLimit);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setIsLoadingAudit(false);
    }
  };

  useEffect(() => {
    if (activeTab === "audit" && auditLogs.length === 0) {
      fetchAuditLogs();
    }
  }, [activeTab]);

  const handleSaveManagedUser = async () => {
    if (!targetProf) return;
    setIsProfSaving(true);
    try {
      await setDoc(doc(db, "users", targetProf.id), targetProf, {
        merge: true,
      });

      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS, 
        targetProf.id, 
        `Perfil de usuario actualizado: ${targetProf.nombre}`
      );

      setIsManageProfessionalModalOpen(false);
      alert("Perfil actualizado");
    } catch (err) {
      alert(err.message);
    } finally {
      setIsProfSaving(false);
    }
  };

  const handleManualUserCreate = async () => {
    if (
      !manualUserForm.nombre ||
      !manualUserForm.u ||
      !manualUserForm.password
    ) {
      return alert("Completa nombre, usuario y contraseña");
    }

    const secondaryApp = initializeApp(firebaseConfig, "SecondaryManual");
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const email = `${manualUserForm.u.toLowerCase().trim()}@coat.com.ar`;
      const res = await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        manualUserForm.password,
      );

      await setDoc(
        doc(db, "users", res.user.uid),
        {
          nombre: manualUserForm.nombre
            .replace(/(DR|DRA|LIC|PROF|BIOQ|FON)\s*\.?\s*/gi, '')
            .trim()
            .toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          prefix: manualUserForm.prefix || "",
          u: manualUserForm.u.toLowerCase().trim(),
          email: email,
          especialidad: manualUserForm.especialidad || "Otorrinolaringología",
          mp: "-",
          me: "-",
          isOfficial: true,
          role: manualUserForm.role || "orl",
          hasLetterhead: ["directora_medica", "admin"].includes(manualUserForm.role) ? true : false,
          canCustomizeModels: ["directora_medica", "admin"].includes(manualUserForm.role) ? true : false,
        },
        { merge: true },
      );

      await signOut(secondaryAuth);
      setIsManualModalOpen(false);
      // setManualUserForm({ nombre: "", mp: "", me: "", especialidad: "", u: "", password: "", role: "medico" });
      alert("Usuario creado con éxito");

      // LOG AUDIT
      await logAction(
        AUDIT_ACTIONS.ADMIN_CHANGE_SETTINGS,
        res.user.uid,
        `Nuevo usuario creado manualmente: ${manualUserForm.u}`
      );
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      await deleteApp(secondaryApp);
    }
  };

  const updateHeader = (key, i, value) => {
    const newHeader = [...targetProf[key]];
    newHeader[i] = value;
    setTargetProf({ ...targetProf, [key]: newHeader });
  };

  const handleSignatureUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !targetProf) return;

    if (!file.type.startsWith("image/")) {
      alert("Por favor, selecciona una imagen válida.");
      return;
    }

    setIsUploadingSignature(true);
    try {
      const uid = targetProf.id || targetProf.uid; // targetProf has id or uid
      if (!uid) throw new Error("ID de profesional no encontrado");

      const fileExt = file.name.split(".").pop();
      const fileName = `firmas/${uid}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("informescoat")
        .upload(fileName, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from("informescoat").getPublicUrl(fileName);

      setTargetProf({ ...targetProf, signatureBase64: publicUrl });
    } catch (err) {
      console.error("Error uploading signature (admin):", err);
      alert("Error cargando firma: " + err.message);
    } finally {
      setIsUploadingSignature(false);
    }
  };

  const filteredUsers = users
    .map((u) => ({ ...u, _std: getStandardUser(u) }))
    .filter((u) => {
      const search = userSearch.toLowerCase();
      return (
        u._std.nombre.toLowerCase().includes(search) ||
        u._std.email.toLowerCase().includes(search)
      );
    })
    .sort((a, b) => a._std.nombre.localeCompare(b._std.nombre, 'es', { sensitivity: 'base' }));


  const filteredPractices = practices.filter(
    (p) =>
      (p.n || "").toLowerCase().includes(practiceSearch.toLowerCase()) ||
      (p.c || "").toLowerCase().includes(practiceSearch.toLowerCase()),
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in p-4 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-main">
        <div>
          <h1 className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            Administración
          </h1>
          <p className="text-gray-500 font-medium">
            Control centralizado de usuarios e informes
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl font-bold transition-all text-sm ${
                activeTab === tab.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                  : "bg-[var(--bg-card)] text-[var(--text-sub)] hover:bg-[var(--hover-main)] border border-[var(--border-main)]"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="animate-slide-up">
        {activeTab === "stats" && (
          <div className="space-y-8">
            {/* Main Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-6 border-none bg-[var(--bg-card)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-125" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">
                      Pacientes Totales
                    </p>
                    <h3 className="text-4xl font-black text-[var(--text-main)]">
                      {globalStats.loading ? (
                        <Loader2
                          className="animate-spin text-blue-600"
                          size={32}
                        />
                      ) : (
                        globalStats.patients
                      )}
                    </h3>
                  </div>
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/30">
                    <UserIcon size={32} />
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 w-full opacity-20" />
                  </div>
                  <p className="text-[9px] text-[var(--text-sub)] font-bold uppercase whitespace-nowrap">
                    Base centralizada
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="card p-6 border-none bg-[var(--bg-card)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-125" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em] mb-1">
                      Informes Médicos
                    </p>
                    <h3 className="text-4xl font-black text-[var(--text-main)]">
                      {globalStats.loading ? (
                        <Loader2
                          className="animate-spin text-indigo-600"
                          size={32}
                        />
                      ) : (
                        globalStats.reports
                      )}
                    </h3>
                  </div>
                  <div className="w-16 h-16 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
                    <FileText size={32} />
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-full opacity-20" />
                  </div>
                  <p className="text-[9px] text-[var(--text-sub)] font-bold uppercase whitespace-nowrap">
                    Registros clínicos
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="card p-6 border-none bg-[var(--bg-card)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full -mr-16 -mt-16 transition-transform group-hover:scale-125" />
                <div className="flex items-center justify-between relative z-10">
                  <div>
                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-[0.2em] mb-1">
                      Pedidos Generados
                    </p>
                    <h3 className="text-4xl font-black text-[var(--text-main)]">
                      {globalStats.loading ? (
                        <Loader2
                          className="animate-spin text-purple-600"
                          size={32}
                        />
                      ) : (
                        globalStats.orders
                      )}
                    </h3>
                  </div>
                  <div className="w-16 h-16 bg-purple-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30">
                    <ClipboardList size={32} />
                  </div>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <div className="h-1.5 flex-1 bg-[var(--bg-secondary)] rounded-full overflow-hidden">
                    <div className="h-full bg-purple-600 w-full opacity-20" />
                  </div>
                  <p className="text-[9px] text-[var(--text-sub)] font-bold uppercase whitespace-nowrap">
                    Historial dinámico
                  </p>
                </div>
              </motion.div>
            </div>



            {/* Storage Detailed Info */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-[var(--bg-card)] p-8 rounded-[2.5rem] border border-[var(--border-main)] shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-orange-100 dark:bg-orange-900/20 text-orange-600 rounded-xl">
                    <Database size={24} />
                  </div>
                  <h3 className="text-xl font-bold">
                    Almacenamiento de Datos (Firestore)
                  </h3>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-[var(--bg-secondary)] rounded-3xl border border-main">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-3xl font-black text-[var(--text-main)]">
                          {storageStats.fbSize}{" "}
                          <span className="text-sm font-medium text-[var(--text-sub)]">
                            KB
                          </span>
                        </p>
                        <p className="text-[10px] font-black text-[var(--text-sub)] uppercase tracking-widest mt-1">
                          Total en Base de Datos
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-3 mt-4 pt-4 border-t border-main/10">
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-indigo-500 uppercase">Informes</span>
                        <span className="text-[var(--text-main)]">{storageStats.reportsSize} KB</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-purple-500 uppercase">Pedidos</span>
                        <span className="text-[var(--text-main)]">{storageStats.ordersSize} KB</span>
                      </div>
                      <div className="flex justify-between items-center text-[10px] font-bold">
                        <span className="text-blue-500 uppercase">Pacientes</span>
                        <span className="text-[var(--text-main)]">{storageStats.patientsSize} KB</span>
                      </div>
                    </div>

                    <div className="w-full h-2 bg-white/20 dark:bg-black/20 rounded-full overflow-hidden mt-6">
                      <div
                        className="h-full bg-blue-600 transition-all duration-1000 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                        style={{
                          width: `${Math.min((storageStats.fbSize / 1024) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    La base de datos Firestore separa los informes, pacientes y pedidos. 
                    Mantenemos este consumo optimizado mediante el almacenamiento de archivos pesados en Drive y Supabase.
                  </p>
                </div>
              </div>

              <div className="bg-[var(--bg-card)] p-8 rounded-[2.5rem] border border-[var(--border-main)] shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/20 text-emerald-600 rounded-xl">
                    <Upload size={24} />
                  </div>
                  <h3 className="text-xl font-bold">
                    Archivos (Supabase)
                  </h3>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-[var(--bg-secondary)] rounded-3xl border border-main">
                    <div className="flex justify-between items-end mb-4">
                      <div>
                        <p className="text-3xl font-black text-[var(--text-main)]">
                          {storageStats.sbSize}{" "}
                          <span className="text-sm font-medium text-[var(--text-sub)]">
                            MB
                          </span>
                        </p>
                        <p className="text-[10px] font-black text-[var(--text-sub)] uppercase tracking-widest mt-1">
                          Capacidad Usada
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-emerald-600">
                          {storageStats.sbCount}
                        </p>
                        <p className="text-[10px] font-bold text-[var(--text-sub)] uppercase">
                          Archivos
                        </p>
                      </div>
                    </div>
                    <div className="w-full h-2.5 bg-white/20 dark:bg-black/20 rounded-full overflow-hidden border border-main/10">
                      <div
                        className="h-full bg-emerald-600 transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                        style={{
                          width: `${Math.min((storageStats.sbSize / 100) * 100, 100)}%`,
                        }}
                      ></div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Aloja firmas y PDFs de informes. Límite de 1GB en plan gratuito.
                  </p>
                </div>
              </div>

              <div className="bg-[var(--bg-card)] p-8 rounded-[2.5rem] border border-[var(--border-main)] shadow-sm lg:col-span-2">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-blue-100 dark:bg-blue-900/20 text-blue-600 rounded-xl">
                    <Database size={24} />
                  </div>
                  <h3 className="text-xl font-bold">
                    Respaldo en Nube (Google Drive)
                  </h3>
                </div>

                <div className="space-y-6">
                  <div className="p-6 bg-[var(--bg-secondary)] rounded-3xl border border-main">
                    {driveQuota ? (
                      <>
                        <div className="flex justify-between items-end mb-4">
                          <div>
                            <p className="text-3xl font-black text-[var(--text-main)]">
                              {driveQuota.usedGB}{" "}
                              <span className="text-sm font-medium text-[var(--text-sub)]">
                                GB
                              </span>
                            </p>
                            <p className="text-[10px] font-black text-[var(--text-sub)] uppercase tracking-widest mt-1">
                              Uso de Cuota Personal
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xl font-bold ${parseFloat(driveQuota.percent) > 90 ? 'text-red-500' : 'text-blue-600'}`}>
                              {driveQuota.percent}%
                            </p>
                            <p className="text-[10px] font-bold text-[var(--text-sub)] uppercase">
                              Ocupado
                            </p>
                          </div>
                        </div>
                        <div className="w-full h-2.5 bg-white/20 dark:bg-black/20 rounded-full overflow-hidden border border-main/10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${driveQuota.percent}%` }}
                            className={`h-full transition-all duration-1000 shadow-[0_0_10px_rgba(37,99,235,0.5)] ${parseFloat(driveQuota.percent) > 90 ? 'bg-red-500' : 'bg-blue-600'}`}
                          ></motion.div>
                        </div>
                      </>
                    ) : driveError ? (
                      <div className="py-10 text-center">
                        <ShieldAlert className="mx-auto text-amber-500" size={32} />
                        <p className="text-xs text-amber-600 mt-2 uppercase font-black">Error al sincronizar cuota</p>
                        <p className="text-[10px] text-gray-400 mt-1">Verifica la URL del Apps Script en Configuración</p>
                      </div>
                    ) : (
                      <div className="py-10 text-center">
                        <Loader2 className="animate-spin mx-auto text-gray-300" size={32} />
                        <p className="text-xs text-gray-400 mt-2 uppercase font-black">Cargando cuota de Drive...</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">
                    Google Drive actúa como almacenamiento secundario. Tienes un límite de 15GB gratuitos compartidos con tu cuenta de Google.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => {
                  fetchGlobalStats();
                  fetchStorageStats();
                }}
                className="flex items-center gap-2 px-6 py-3 bg-[var(--bg-card)] border border-[var(--border-main)] text-[var(--text-sub)] rounded-2xl font-bold hover:bg-[var(--hover-main)] transition-all shadow-sm"
              >
                <RefreshCw
                  size={20}
                  className={globalStats.loading ? "animate-spin" : ""}
                />
                Actualizar Métricas
              </button>
            </div>

          </div>
        )}

        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-[var(--bg-card)] p-4 rounded-3xl shadow-sm border border-[var(--border-main)]">
              <div className="relative w-full md:w-96">
                <SearchIcon
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
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
                  <input
                    type="file"
                    className="hidden"
                    accept=".xlsx, .xls"
                    onChange={handleExcelUpload}
                  />
                </label>
                <button
                  onClick={handleGlobalNameCleanup}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-100 dark:bg-amber-900/20 text-amber-600 rounded-2xl font-bold text-sm hover:bg-amber-200 transition-colors"
                  title="Limpiar y Normalizar todos los nombres"
                >
                  <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                  <span>Limpieza Global</span>
                </button>
                <button
                  onClick={() => setIsManualModalOpen(true)}
                  className="btn-primary flex items-center gap-2 py-2.5"
                >
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
                    <tr className="bg-[var(--bg-secondary)] border-b border-main">
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Profesional
                      </th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Especialidad
                      </th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        Rol de Acceso
                      </th>
                      <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 text-right">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, idx) => (
                      <tr
                        key={user.id}
                        className="border-b border-main/50 hover:bg-[var(--bg-secondary)]/50 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-100/30 text-blue-600 rounded-xl flex items-center justify-center font-black text-lg border border-main shadow-sm">
                              {user._std.nombre.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <select
                                  value={user._std.prefix}
                                  onChange={(e) => handleUpdateUserPrefix(user.id, e.target.value)}
                                  className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded text-[9px] font-bold border-none outline-none focus:ring-1 focus:ring-blue-500/50"
                                >
                                  <option value="">-</option>
                                  <option value="Dr.">Dr.</option>
                                  <option value="Dra.">Dra.</option>
                                  <option value="Lic.">Lic.</option>
                                  <option value="Prof. Dr.">Prof. Dr.</option>
                                </select>
                                <p className="font-bold text-[var(--text-main)] truncate">
                                  {user._std.nombre}
                                </p>
                              </div>
                              <p className="text-xs text-gray-400 truncate">
                                {user._std.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs font-medium text-[var(--text-sub)]">
                            {user._std.especialidad}
                          </span>
                          <div className="flex gap-2 mt-1">
                            {user._std.mp && (
                              <span className="text-[9px] font-mono text-gray-400">
                                MP: {user._std.mp}
                              </span>
                            )}
                            {user._std.me && (
                              <span className="text-[9px] font-mono text-gray-400">
                                ME: {user._std.me}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={user._std.role}
                            onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                            className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter cursor-pointer border-none focus:ring-2 focus:ring-blue-500/20 transition-all ${
                              user._std.role === 'admin'
                                ? "bg-red-100 text-red-600"
                                : user._std.role === 'directora_medica'
                                ? "bg-purple-100 text-purple-600"
                                : user._std.role === 'super_secretaria'
                                ? "bg-indigo-100 text-indigo-600"
                                : user._std.role === 'secretaria'
                                ? "bg-amber-100 text-amber-600"
                                : "bg-blue-100 text-blue-600"
                            }`}
                          >
                            <optgroup label="Administración">
                              <option value="admin">Administrador</option>
                              <option value="directora_medica">Directora Médica</option>
                              <option value="super_secretaria">Super Secretaria</option>
                              <option value="secretaria">Secretaría</option>
                            </optgroup>
                            <optgroup label="Especialidades">
                              <option value="cabeza y cuello">Cabeza y cuello</option>
                              <option value="cx plástica">CX Plástica</option>
                              <option value="electrografías">Electrografías</option>
                              <option value="orl">ORL</option>
                              <option value="vestibular">Vestibular</option>
                              <option value="fonoaudiología">Fonoaudiología</option>
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleResetPassword(user)}
                              disabled={loadingResetId === user.id}
                              className={`p-2 text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-xl transition-colors ${loadingResetId === user.id ? 'animate-pulse' : ''}`}
                              title="Restablecer Contraseña"
                            >
                              {loadingResetId === user.id ? <Loader2 size={18} className="animate-spin" /> : <Key size={18} />}
                            </button>
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

        {activeTab === "practices" && (
          <>
          <div className="flex h-[calc(100vh-280px)] gap-6 overflow-hidden">
            {/* Left Sidebar: List of Models */}
            <div className="w-80 flex-shrink-0 flex flex-col gap-4">
              <div className="relative">
                <SearchIcon size={18} className="absolute left-3 top-2.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar modelos..."
                  className="input-field pl-10"
                  value={practiceSearch}
                  onChange={(e) => setPracticeSearch(e.target.value)}
                />
              </div>

              <div className="flex-1 overflow-auto space-y-2 pr-2 custom-scrollbar">
                {filteredPractices.length > 0 ? (
                  filteredPractices.map((p) => (
                    <motion.div
                      key={p.id}
                      whileHover={{ x: 5 }}
                      onClick={() => handleEditPractice(p)}
                      className={`p-4 rounded-2xl cursor-pointer border transition-all ${
                        selectedPractice?.id === p.id 
                          ? 'bg-blue-600 border-blue-600 text-white shadow-lg' 
                          : 'bg-[var(--bg-card)] border-main hover:border-blue-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm truncate pr-2">{p.n}</span>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePractice(p.id);
                            }}
                            className={`p-1.5 rounded-lg transition-colors ${
                              selectedPractice?.id === p.id 
                                ? 'hover:bg-white/20 text-white/80' 
                                : 'hover:bg-red-50 text-red-500'
                            }`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p className={`text-[10px] uppercase font-black tracking-widest ${
                          selectedPractice?.id === p.id ? 'text-blue-100' : 'text-gray-400'
                        }`}>
                          Cód: {p.c || '--'}
                        </p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="p-10 text-center text-xs text-gray-400 italic bg-[var(--bg-card)] rounded-2xl border border-dashed border-main">
                    No se encontraron modelos.
                  </div>
                )}
                
                {/* Add New Button at bottom of list */}
                <button 
                  onClick={() => {
                    setSelectedPractice(null);
                    setPracticeForm({ c: "", n: "", b: "", st: true });
                  }}
                  className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-200 hover:border-blue-400 hover:bg-blue-50/30 text-gray-400 hover:text-blue-600 transition-all flex flex-col items-center gap-1 group"
                >
                  <Plus size={20} className="group-hover:scale-110 transition-transform" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Nuevo Modelo</span>
                </button>
              </div>
            </div>

            {/* Right Side: Editor and Configuration */}
            <div className="flex-1 flex flex-col bg-[var(--bg-card)] rounded-[2.5rem] shadow-sm border border-main overflow-hidden">
              <div className="p-6 border-b border-main bg-[var(--bg-page)]/30">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${
                      selectedPractice ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {selectedPractice ? <Edit2 size={24} /> : <Plus size={24} />}
                    </div>
                    <div>
                      <h3 className="font-black text-xl tracking-tight">
                        {selectedPractice ? "Editar Modelo" : "Crear Nuevo Modelo"}
                      </h3>
                      <p className="text-xs text-gray-400 font-medium">
                        {selectedPractice ? `Modificando: ${selectedPractice.n}` : "Define una nueva plantilla base para informes"}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    {selectedPractice && (
                      <button 
                        onClick={() => {
                          setSelectedPractice(null);
                          setPracticeForm({ c: "", n: "", b: "", st: true });
                        }}
                        className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                      >
                        Cancelar
                      </button>
                    )}
                    <button 
                      onClick={handleSavePractice}
                      className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-blue-600/20"
                    >
                      {selectedPractice ? "Guardar Cambios" : "Crear Modelo"}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-blue-600/70 tracking-widest ml-2">
                      Código de Práctica
                    </label>
                    <input
                      type="text"
                      value={practiceForm.c}
                      onChange={(e) => setPracticeForm({ ...practiceForm, c: e.target.value.toUpperCase() })}
                      className="w-full px-5 py-3 bg-white border border-blue-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-bold text-blue-700 placeholder:text-blue-200"
                      placeholder="Ej: 310124"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-2">
                      Nombre del Modelo
                    </label>
                    <input
                      type="text"
                      value={practiceForm.n}
                      onChange={(e) => setPracticeForm({ ...practiceForm, n: e.target.value })}
                      className="w-full px-5 py-3 bg-white border border-main rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none font-bold placeholder:text-gray-200"
                      placeholder="Ej: Rinofaringolaringofibroscopia"
                    />
                  </div>
                </div>

                {/* Specialty Selection for Model */}
                <div className="mt-4 space-y-2">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-2">
                    Especialidades con acceso a este modelo
                  </label>
                  <div className="flex flex-wrap gap-2 px-2">
                    {[
                      { id: "cabeza y cuello", label: "Cabeza y cuello" },
                      { id: "cx plástica", label: "CX plástica" },
                      { id: "electrografías", label: "Electrografías" },
                      { id: "orl", label: "ORL" },
                      { id: "vestibular", label: "Vestibular" },
                      { id: "fonoaudiología", label: "Fonoaudiología" },
                      { id: "directora_medica", label: "Directora Médica" }
                    ].map(roleObj => (
                      <button
                        key={roleObj.id}
                        onClick={() => {
                          const currentRoles = practiceForm.allowedRoles || [];
                          const nextRoles = currentRoles.includes(roleObj.id)
                            ? currentRoles.filter(r => r !== roleObj.id)
                            : [...currentRoles, roleObj.id];
                          setPracticeForm({ ...practiceForm, allowedRoles: nextRoles });
                        }}
                        className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-tight transition-all border ${
                          (practiceForm.allowedRoles || []).includes(roleObj.id)
                            ? 'bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-main text-gray-400 hover:border-blue-300'
                        }`}
                      >
                        {roleObj.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-auto p-8 custom-scrollbar">

                <div className="space-y-2 mb-8">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-widest ml-2">
                    Informe Base (Plantilla HTML)
                  </label>
                  <div className="rounded-3xl overflow-hidden min-h-[380px]">
                    <ClinicalEditor
                      value={practiceForm.b}
                      onChange={(val) => setPracticeForm(prev => ({ ...prev, b: val }))}
                      minHeight="380px"
                      placeholder="Escribe el contenido base del informe..."
                    />
                  </div>
                </div>

                <label className="flex items-center gap-4 p-6 bg-blue-50/50 rounded-3xl border border-blue-100 cursor-pointer group hover:bg-blue-50 transition-colors">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    practiceForm.st ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-blue-200'
                  }`}>
                    {practiceForm.st && <Check size={14} />}
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={practiceForm.st}
                      onChange={(e) => setPracticeForm({ ...practiceForm, st: e.target.checked })}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-blue-900">Incluir título automático</span>
                    <span className="text-xs text-blue-700/60 font-medium">El sistema generará el título "INFORME DE [NOMBRE]" al inicio del PDF</span>
                  </div>
                </label>
              </div>
            </div>
          </div>


          {/* Required Fields Config for Reports */}
          <div className="card p-6 bg-[var(--bg-card)] border border-main rounded-3xl shadow-sm mt-8">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-[var(--text-main)]">
              <Settings2 size={20} className="text-green-600" /> Campos Obligatorios
              <span className="text-xs font-normal text-gray-400 ml-1">(Informes)</span>
            </h3>
            {[
              { key: 'reportRequiredPatient',    label: 'Nombre del Paciente',  defaultOn: true },
              { key: 'reportRequiredDate',       label: 'Fecha',                defaultOn: true },
              { key: 'reportRequiredSocialWork', label: 'Obra Social',          defaultOn: true },
              { key: 'reportRequiredAffiliate',  label: 'Nro. Afiliado',        defaultOn: false },
              { key: 'reportRequiredDni',        label: 'DNI',                  defaultOn: false },
              { key: 'reportRequiredRequester',  label: 'Solicitante',          defaultOn: false },
              { key: 'reportRequiredReason',     label: 'Motivo / Descripción', defaultOn: false },
              { key: 'reportRequiredEmail',      label: 'Email del Paciente',   defaultOn: false },
            ].map(field => {
              const isOn = field.key in config
                ? config[field.key]
                : field.defaultOn;
              return (
                <label key={field.key} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-2xl cursor-pointer hover:bg-[var(--hover-main)] transition-all mt-2 first:mt-0">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--text-main)]">{field.label}</span>
                    <span className={`text-[10px] uppercase font-black ${isOn ? 'text-green-500' : 'text-gray-400'}`}>
                      {isOn ? 'Obligatorio' : 'Opcional'}
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={!!isOn}
                      onChange={(e) => {
                        const newVal = e.target.checked;
                        const action = newVal ? 'obligatorio' : 'opcional';
                        if (window.confirm(`¿Confirma que desea marcar "${field.label}" como ${action} en los informes?`)) {
                          handleSaveConfig({ ...config, [field.key]: newVal });
                        }
                      }}
                    />
                    <div className={`w-10 h-5 rounded-full transition-all ${isOn ? 'bg-green-600' : 'bg-gray-300'}`}>
                      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all ${isOn ? 'translate-x-5' : ''}`} />
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          </>
        )}

        {activeTab === "orders" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="card p-6 bg-[var(--bg-card)] border border-main rounded-3xl shadow-sm">
                <h3 className="text-xl font-bold mb-4 flex items-center gap-2 text-[var(--text-main)]">
                  <Settings2 size={20} className="text-blue-600" /> Parámetros
                  de Pedidos
                </h3>
                {/* Required Fields Config */}
                {[
                  { key: 'requiredDni',             label: 'DNI / Pasaporte',     defaultOn: true },
                  { key: 'requiredName',            label: 'Nombre Completo',     defaultOn: true },
                  { key: 'requiredInsurance',       label: 'Obra Social',         defaultOn: true },
                  { key: 'requiredAffiliateNumber', label: 'Nro. Afiliado',       defaultOn: true },
                  { key: 'requiredDiagnosis',       label: 'Diagnóstico',         defaultOn: true },
                  { key: 'patientEmailRequired',    label: 'Email del Paciente',  defaultOn: false },
                ].map(field => {
                  const isOn = field.key === 'patientEmailRequired'
                    ? (orderSettings.patientEmailRequired || false)
                    : (orderSettings[field.key] !== false ? field.defaultOn : false);

                  return (
                    <label key={field.key} className="flex items-center justify-between p-3 bg-[var(--bg-secondary)] rounded-2xl cursor-pointer hover:bg-[var(--hover-main)] transition-all mt-2 first:mt-0">
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-[var(--text-main)]">{field.label}</span>
                        <span className={`text-[10px] uppercase font-black ${isOn ? 'text-blue-500' : 'text-gray-400'}`}>
                          {isOn ? 'Obligatorio' : 'Opcional'}
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isOn}
                          onChange={(e) => {
                            const newVal = e.target.checked;
                            const action = newVal ? 'obligatorio' : 'opcional';
                            if (window.confirm(`¿Confirma que desea marcar "${field.label}" como ${action}?`)) {
                              handleSaveOrderSettings({ ...orderSettings, [field.key]: newVal });
                            }
                          }}
                        />
                        <div className={`w-10 h-5 rounded-full transition-all ${isOn ? 'bg-blue-600' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all ${isOn ? 'translate-x-5' : ''}`} />
                        </div>
                      </div>
                    </label>
                  );
                })}
                <label className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-2xl cursor-pointer hover:bg-[var(--hover-main)] transition-all mt-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--text-main)]">
                      Habilitar Módulo Pedidos
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase font-black">
                      Si se apaga, solo admins lo ven
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={orderSettings.ordersEnabled ?? true}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        const action = newValue ? "habilitar" : "deshabilitar";
                        if (
                          window.confirm(
                            `¿Está seguro que desea ${action} el módulo de pedidos para todos los usuarios?`,
                          )
                        ) {
                          handleSaveOrderSettings({
                            ...orderSettings,
                            ordersEnabled: newValue,
                          });
                        }
                      }}
                    />
                    <div
                      className={`w-10 h-5 rounded-full transition-all ${orderSettings.ordersEnabled !== false ? "bg-green-600" : "bg-gray-300"}`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all ${orderSettings.ordersEnabled !== false ? "translate-x-5" : ""}`}
                      />
                    </div>
                  </div>
                </label>

                <label className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-2xl cursor-pointer hover:bg-[var(--hover-main)] transition-all mt-4">
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-[var(--text-main)]">
                      Habilitar Pedidos para Fonoaudiología
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase font-black">
                      Si se apaga, usuarios con rol Fonoaudiología no tendrán acceso
                    </span>
                  </div>
                  <div className="relative">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={orderSettings.fonoaudiologiaOrdersEnabled ?? false}
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        const action = newValue ? "habilitar" : "deshabilitar";
                        if (
                          window.confirm(
                            `¿Está seguro que desea ${action} el módulo de pedidos para usuarios de Fonoaudiología?`,
                          )
                        ) {
                          handleSaveOrderSettings({
                            ...orderSettings,
                            fonoaudiologiaOrdersEnabled: newValue,
                          });
                        }
                      }}
                    />
                    <div
                      className={`w-10 h-5 rounded-full transition-all ${orderSettings.fonoaudiologiaOrdersEnabled === true ? "bg-green-600" : "bg-gray-300"}`}
                    >
                      <div
                        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-all ${orderSettings.fonoaudiologiaOrdersEnabled === true ? "translate-x-5" : ""}`}
                      />
                    </div>
                  </div>
                </label>
              </div>

              <div className="card p-6 bg-[var(--bg-card)] border border-main rounded-3xl shadow-sm space-y-6">
                <div>
                  <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                    <RefreshCw size={20} className="text-blue-600" /> Auto-Limpieza
                  </h3>
                  <p className="text-[10px] text-gray-400 uppercase font-black">
                    Borrado automático de pedidos antiguos
                  </p>
                </div>
                
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase ml-1">
                    Días de antigüedad para borrar
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      className="input-field w-24 text-center font-bold"
                      value={orderSettings.autoCleanDays || 0}
                      onChange={(e) => handleSaveOrderSettings({
                        ...orderSettings,
                        autoCleanDays: parseInt(e.target.value) || 0
                      })}
                      min="0"
                    />
                    <span className="text-xs font-bold text-gray-500 uppercase">Días</span>
                  </div>
                  <p className="text-[9px] text-orange-400 font-bold uppercase mt-1 italic">
                    * 0 = Desactivado. Se borran registros y PDFs.
                  </p>
                </div>
              </div>

              <div className="card p-6 bg-[var(--bg-card)] border border-main rounded-3xl shadow-sm">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                  <Plus size={20} className="text-blue-600" /> Nueva Categoría
                </h3>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">
                      ID Único
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={newCategoryForm.id}
                      onChange={(e) =>
                        setNewCategoryForm({
                          ...newCategoryForm,
                          id: e.target.value.toLowerCase().replace(/\s/g, "_"),
                        })
                      }
                      placeholder="ID..."
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">
                      Etiqueta Visible
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      value={newCategoryForm.label}
                      onChange={(e) =>
                        setNewCategoryForm({
                          ...newCategoryForm,
                          label: e.target.value,
                        })
                      }
                      placeholder="Nombre de categoría"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-gray-400 uppercase ml-1">
                      Icono
                    </label>
                    <select
                      className="input-field cursor-pointer"
                      value={newCategoryForm.icon}
                      onChange={(e) =>
                        setNewCategoryForm({
                          ...newCategoryForm,
                          icon: e.target.value,
                        })
                      }
                    >
                      <option value="Clipboard">Portapapeles</option>
                      <option value="Stethoscope">Estetoscopio</option>
                      <option value="Activity">Actividad/Onda</option>
                      <option value="Search">Lupa</option>
                      <option value="Eye">Ojo</option>
                      <option value="Heart">Corazón</option>
                    </select>
                  </div>
                  <button
                    onClick={handleAddOrderCategory}
                    className="btn-primary w-full py-3 mt-2 flex items-center justify-center gap-2"
                  >
                    {isSavingOrderSettings ? (
                      <Loader2 className="animate-spin" size={18} />
                    ) : (
                      <Plus size={18} />
                    )}{" "}
                    AGREGAR CATEGORÍA
                  </button>
                </div>
              </div>

              <div className="card p-6 bg-[var(--bg-card)] border border-main rounded-3xl shadow-sm overflow-hidden">
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2 text-[var(--text-main)]">
                  <ClipboardList size={20} className="text-blue-600" />{" "}
                  Categorías Activas
                </h3>
                <div className="space-y-2">
                  {orderSettings.categories.map((cat) => (
                    <div
                      key={cat.id}
                      onClick={() => setSelectedOrderCategory(cat.id)}
                      className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${selectedOrderCategory === cat.id ? "bg-blue-600 border-blue-600 text-white shadow-lg" : "bg-[var(--bg-secondary)] border-transparent hover:border-blue-300"}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black uppercase tracking-tighter">
                          {cat.label}
                        </span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteOrderCategory(cat.id);
                        }}
                        className={`p-2 rounded-xl transition-all ${selectedOrderCategory === cat.id ? "hover:bg-blue-700 text-white" : "hover:bg-red-50 text-red-400"}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                  {orderSettings.categories.length === 0 && (
                    <p className="text-center py-8 text-gray-400 text-sm italic">
                      No hay categorías configuradas.
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {selectedOrderCategory ? (
                <div className="card bg-[var(--bg-card)] border border-main rounded-[2.5rem] shadow-sm overflow-hidden flex flex-col h-full">
                  <div className="p-8 border-b border-main bg-[var(--bg-secondary)]/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-2xl font-black text-[var(--text-main)]">
                        Estudios:{" "}
                        {
                          orderSettings.categories.find(
                            (c) => c.id === selectedOrderCategory,
                          )?.label
                        }
                      </h3>
                      <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-1">
                        Gestionar lista de estudios para esta categoría
                      </p>
                    </div>
                  </div>

                  <div className="p-8 border-b border-main bg-[var(--bg-card)]">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">
                          Nombre del Estudio
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          value={newPracticeForm.n}
                          onChange={(e) =>
                            setNewPracticeForm({
                              ...newPracticeForm,
                              n: e.target.value,
                            })
                          }
                          placeholder="Estudio..."
                        />
                      </div>
                      <div className="md:col-span-1 space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">
                          Código
                        </label>
                        <input
                          type="text"
                          className="input-field"
                          value={newPracticeForm.c}
                          onChange={(e) =>
                            setNewPracticeForm({
                              ...newPracticeForm,
                              c: e.target.value,
                            })
                          }
                          placeholder="Código..."
                        />
                      </div>
                      <div className="md:col-span-3 space-y-2">
                        <label className="text-[10px] font-black uppercase text-gray-400 ml-1">
                          Especialidades con acceso (Vacío = Todos)
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {[
                            { id: "cabeza y cuello", label: "Cabeza y cuello" },
                            { id: "cx plástica", label: "CX plástica" },
                            { id: "electrografías", label: "Electrografías" },
                            { id: "orl", label: "ORL" },
                            { id: "vestibular", label: "Vestibular" },
                            { id: "fonoaudiología", label: "Fonoaudiología" }
                          ].map(roleObj => (
                            <button
                              key={roleObj.id}
                              onClick={() => {
                                const current = newPracticeForm.allowedRoles || [];
                                const updated = current.includes(roleObj.id)
                                  ? current.filter(r => r !== roleObj.id)
                                  : [...current, roleObj.id];
                                setNewPracticeForm({ ...newPracticeForm, allowedRoles: updated });
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all border ${
                                (newPracticeForm.allowedRoles || []).includes(roleObj.id)
                                  ? "bg-blue-600 border-blue-600 text-white"
                                  : "bg-[var(--bg-secondary)] border-main text-gray-400"
                              }`}
                            >
                              {roleObj.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="md:col-span-1 flex items-end">
                        <button
                          onClick={handleAddOrderPractice}
                          className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                        >
                          <Plus size={18} /> AGREGAR
                        </button>
                      </div>
                    </div>
                  </div>

                  <Reorder.Group
                    axis="y"
                    values={
                      orderSettings.practicesByType[selectedOrderCategory] || []
                    }
                    onReorder={handleReorderOrderPractices}
                    className="flex-1 p-8 space-y-3 overflow-y-auto max-h-[600px] custom-scrollbar"
                  >
                    {(
                      orderSettings.practicesByType[selectedOrderCategory] || []
                    ).map((p, idx) => (
                      <Reorder.Item
                        key={p.n + idx}
                        value={p}
                        whileDrag={{
                          scale: 1.02,
                          boxShadow:
                            "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
                        }}
                        className="flex items-center justify-between p-4 bg-[var(--bg-secondary)] rounded-2xl border border-transparent hover:border-blue-400 transition-all group shadow-sm cursor-grab active:cursor-grabbing"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          <div className="flex items-center gap-2">
                            <GripVertical
                              className="text-gray-300 group-hover:text-blue-400 transition-colors"
                              size={20}
                            />
                            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold">
                              {idx + 1}
                            </div>
                          </div>

                          {editingOrderPracticeIdx === idx ? (
                            <div className="flex-1 space-y-3 pr-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  className="input-field py-1.5 text-sm"
                                  value={editOrderPracticeForm.n}
                                  onChange={(e) =>
                                    setEditOrderPracticeForm({
                                      ...editOrderPracticeForm,
                                      n: e.target.value,
                                    })
                                  }
                                  autoFocus
                                />
                                <input
                                  type="text"
                                  className="input-field py-1.5 text-xs font-mono"
                                  value={editOrderPracticeForm.c}
                                  onChange={(e) =>
                                    setEditOrderPracticeForm({
                                      ...editOrderPracticeForm,
                                      c: e.target.value.toUpperCase(),
                                    })
                                  }
                                  placeholder="Cód."
                                />
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {[
                                  { id: "cabeza y cuello", label: "Cabeza y cuello" },
                                  { id: "cx plástica", label: "CX plástica" },
                                  { id: "electrografías", label: "Electrografías" },
                                  { id: "orl", label: "ORL" },
                                  { id: "vestibular", label: "Vestibular" },
                                  { id: "fonoaudiología", label: "Fonoaudiología" },
                                  { id: "directora_medica", label: "Directora Médica" }
                                ].map(roleObj => (
                                  <button
                                    key={roleObj.id}
                                    onClick={() => {
                                      const current = editOrderPracticeForm.allowedRoles || [];
                                      const updated = current.includes(roleObj.id)
                                        ? current.filter(r => r !== roleObj.id)
                                        : [...current, roleObj.id];
                                      setEditOrderPracticeForm({ ...editOrderPracticeForm, allowedRoles: updated });
                                    }}
                                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all border ${
                                      (editOrderPracticeForm.allowedRoles || []).includes(roleObj.id)
                                        ? "bg-blue-500 border-blue-500 text-white"
                                        : "bg-white dark:bg-slate-800 border-gray-200 text-gray-400"
                                    }`}
                                  >
                                    {roleObj.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex-1">
                              <p className="font-bold text-sm text-[var(--text-main)]">
                                {p.n}
                              </p>
                              <p className="text-[10px] font-black text-gray-400 uppercase">
                                CÓDIGO: {p.c || "--"}
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {editingOrderPracticeIdx === idx ? (
                            <>
                              <button
                                onClick={() => handleSaveEditOrderPractice(idx)}
                                className="p-2 text-green-500 hover:bg-green-50 rounded-xl transition-all"
                                title="Guardar"
                              >
                                <Check size={18} />
                              </button>
                              <button
                                onClick={() => setEditingOrderPracticeIdx(null)}
                                className="p-2 text-gray-400 hover:bg-gray-100 rounded-xl transition-all"
                                title="Cancelar"
                              >
                                <X size={18} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  handleStartEditOrderPractice(idx, p)
                                }
                                className="p-2 opacity-0 group-hover:opacity-100 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
                                title="Editar"
                              >
                                <Edit2 size={18} />
                              </button>
                              <button
                                onClick={() => handleDeleteOrderPractice(idx)}
                                className="p-2 opacity-0 group-hover:opacity-100 text-red-400 hover:bg-red-50 rounded-xl transition-all"
                                title="Eliminar"
                              >
                                <Trash2 size={18} />
                              </button>
                            </>
                          )}
                        </div>
                      </Reorder.Item>
                    ))}
                    {(
                      orderSettings.practicesByType[selectedOrderCategory] || []
                    ).length === 0 && (
                      <div className="text-center py-20 text-gray-400">
                        <Database
                          size={48}
                          className="mx-auto mb-4 opacity-10"
                        />
                        <p className="text-sm font-bold uppercase tracking-widest">
                          Sin estudios registrados
                        </p>
                      </div>
                    )}
                  </Reorder.Group>
                </div>
              ) : (
                <div className="card bg-[var(--bg-card)] border border-main rounded-[2.5rem] border-dashed flex flex-col items-center justify-center p-20 text-center space-y-6">
                  <div className="w-24 h-24 bg-blue-50 dark:bg-blue-900/10 rounded-full flex items-center justify-center text-blue-400">
                    <ClipboardList size={48} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-[var(--text-main)]">
                      Seleccione una Categoría
                    </h3>
                    <p className="text-gray-400 max-w-xs mx-auto mt-2">
                      Elija una categoría de la izquierda para gestionar sus
                      estudios asociados o agregue una nueva.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}


        {activeTab === "settings" && (
          <div className="max-w-3xl mx-auto">
            <div className="card p-10 bg-[var(--bg-card)] border-main shadow-lg space-y-8">
              <div className="flex items-center gap-4 border-b border-main pb-6">
                <div className="w-14 h-14 rounded-2xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                  <Mail size={28} />
                </div>
                <div>
                  <h3 className="text-2xl font-bold">
                    Configuración del Sistema
                  </h3>
                  <p className="text-gray-400">
                    Parámetros globales de correo y servicios externos
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase text-gray-400 ml-1 flex items-center gap-2">
                    <ExternalLink size={14} /> URL de Google Apps Script (Envío
                    de Mails)
                  </label>
                  <input
                    type="text"
                    value={appsScriptUrl}
                    onChange={(e) => setAppsScriptUrl(e.target.value)}
                    className="input-field font-mono text-sm"
                    placeholder="https://script.google.com/macros/s/.../exec"
                  />
                  <p className="text-[10px] text-gray-400 ml-1">
                    Este enlace comunica la app con el servidor de correos de
                    Google.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase text-gray-400 ml-1 flex items-center gap-2">
                    <Mail size={14} /> Email para Copias (Destinatario)
                  </label>
                  <input
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    className="input-field"
                    placeholder="consultas@coat.com.ar"
                  />
                  <p className="text-[10px] text-gray-400 ml-1">
                    Aquí llegará una copia automática de cada informe enviado
                    por los médicos.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold uppercase text-gray-400 ml-1 flex items-center gap-2">
                    <Key size={14} /> Token de Seguridad
                  </label>
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    className="input-field"
                    placeholder="••••••••"
                  />
                </div>

                <div className="border-t border-main pt-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center">
                      <ShieldCheck size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold">Privacidad de Pacientes</h4>
                      <p className="text-[10px] text-gray-400">Mostrar botón de "Privacidad Activada" en informes</p>
                    </div>
                    <div className="ml-auto">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={showPrivacyToggle}
                          onChange={(e) => setShowPrivacyToggle(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-500"></div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center">
                      <Database size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold">Google Drive Storage</h4>
                      <p className="text-[10px] text-gray-400">Respaldo automático de PDFs en la nube</p>
                    </div>
                    <div className="ml-auto">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={autoSaveToDrive}
                          onChange={(e) => setAutoSaveToDrive(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-orange-500"></div>
                      </label>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 flex items-center justify-center">
                      <Send size={24} />
                    </div>
                    <div>
                      <h4 className="font-bold">Botón de Envío</h4>
                      <p className="text-[10px] text-gray-400">Mostrar botón "Enviar Informe" en la edición</p>
                    </div>
                    <div className="ml-auto">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer"
                          checked={showSendButton}
                          onChange={(e) => setShowSendButton(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase text-gray-400 ml-1 flex items-center gap-2">
                      ID de Carpeta para Informes
                    </label>
                    <input
                      type="text"
                      value={driveFolderId}
                      onChange={(e) => setDriveFolderId(e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="ID de la carpeta de Informes"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-bold uppercase text-gray-400 ml-1 flex items-center gap-2">
                      ID de Carpeta para Pedidos
                    </label>
                    <input
                      type="text"
                      value={ordersFolderId}
                      onChange={(e) => setOrdersFolderId(e.target.value)}
                      className="input-field font-mono text-sm"
                      placeholder="ID de la carpeta de Pedidos"
                    />
                    <p className="text-[10px] text-gray-400 ml-1">
                      El ID se encuentra al final de la URL de tu carpeta de Drive.
                    </p>
                  </div>

                  {/* Monitor de Almacenamiento */}
                  <div className="mt-4 p-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl border border-main">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Database size={16} className="text-blue-500" />
                        <span className="text-xs font-bold uppercase text-gray-500">Espacio en Drive</span>
                      </div>
                      <button 
                        onClick={async () => {
                          try {
                            const res = await fetch(appsScriptUrl, {
                              method: 'POST',
                              body: JSON.stringify({ token, action: 'getQuota' })
                            });
                            const data = await res.json();
                            setDriveQuota(data);
                          } catch (e) {
                            console.error("Error al obtener cuota:", e);
                          }
                        }}
                        className="text-[10px] bg-blue-100 text-blue-600 px-2 py-1 rounded-md hover:bg-blue-200 transition-colors"
                      >
                        Actualizar
                      </button>
                    </div>

                    {driveQuota ? (
                      <div className="space-y-2">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span>{driveQuota.usedGB} GB</span>
                          <span className="font-bold text-blue-600">{driveQuota.percent}%</span>
                          <span>{driveQuota.limitGB} GB</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${driveQuota.percent}%` }}
                            className={`h-full ${parseFloat(driveQuota.percent) > 90 ? 'bg-red-500' : 'bg-blue-500'}`}
                          />
                        </div>
                      </div>
                    ) : (
                      <p className="text-[10px] text-center text-gray-400 py-2">Click en actualizar para cargar estado</p>
                    )}
                  </div>
                </div>
                <div className="pt-6">
                  <button
                    onClick={handleSaveSettings}
                    disabled={isSavingSettings}
                    className="btn-primary w-full py-5 flex items-center justify-center gap-3 shadow-xl shadow-blue-500/30"
                  >
                    {isSavingSettings ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <Save size={20} />
                    )}
                    <span className="text-base uppercase tracking-widest">
                      Guardar Cambios
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "audit" && (
          <div className="space-y-6">
            <div className="bg-[var(--bg-card)] p-8 rounded-[2.5rem] border border-[var(--border-main)] shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-[var(--text-main)] flex items-center gap-2">
                    <History className="text-blue-500" /> Historial de Auditoría
                  </h3>
                  <p className="text-sm text-gray-400">Registros de acciones críticas de los últimos 90 días (Inmutable)</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="relative group flex-1 md:min-w-[400px]">
                    <SearchIcon
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 transition-colors group-focus-within:text-blue-500"
                      size={18}
                    />
                    <input
                      type="text"
                      placeholder="Buscar por paciente, usuario o acción específica..."
                      className="w-full pl-11 pr-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-main)] rounded-2xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center gap-2 bg-[var(--bg-secondary)] p-1 rounded-2xl border border-main">
                    {[50, 100, 300].map(val => (
                      <button
                        key={val}
                        onClick={() => { 
                          setAuditLimit(val); 
                          setAuditLogs([]); 
                          fetchAuditLogs(false, val);
                        }}
                        className={`px-4 py-2 rounded-xl text-[10px] font-black transition-all ${
                          auditLimit === val 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'text-gray-500 hover:bg-main'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => fetchAuditLogs(false)}
                    disabled={isLoadingAudit}
                    className="p-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-2xl hover:bg-blue-100 transition-all"
                    title="Refrescar logs"
                  >
                    <RefreshCw size={20} className={isLoadingAudit ? "animate-spin" : ""} />
                  </button>
                </div>
              </div>

              {isLoadingAudit ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                  <Loader2 size={40} className="animate-spin text-blue-500" />
                  <p className="text-xs font-black uppercase tracking-widest text-gray-400">Cargando registros...</p>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-20 text-center bg-[var(--bg-secondary)] rounded-3xl border-2 border-dashed border-main">
                  <ShieldCheck size={48} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-400 font-medium">No se han encontrado registros de actividad reciente.</p>
                </div>
              ) : (
                <>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[var(--bg-secondary)] border-b border-main">
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Fecha y Hora</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Usuario</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Acción</th>
                        <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Documento/Destino</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-main/50">
                      {auditLogs
                        .filter(log => 
                          log.userEmail?.toLowerCase().includes(auditSearch.toLowerCase()) ||
                          log.userName?.toLowerCase().includes(auditSearch.toLowerCase()) ||
                          log.action?.toLowerCase().includes(auditSearch.toLowerCase()) ||
                          log.targetName?.toLowerCase().includes(auditSearch.toLowerCase())
                        )
                        .map((log) => (
                        <tr key={log.id} className="hover:bg-blue-50/30 dark:hover:bg-blue-900/5 transition-colors group">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-[var(--text-main)]">
                                {log.timestamp?.seconds 
                                  ? new Date(log.timestamp.seconds * 1000).toLocaleString('es-AR')
                                  : 'Recién registrado'}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono">
                                {log.id.substring(0, 8)}...
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                                {log.userName === 'Usuario sin nombre' 
                                  ? (users.find(u => u.id === log.userId)?.nombre || log.userName)
                                  : log.userName}
                              </span>
                              <span className="text-[10px] text-gray-400">{log.userEmail}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                              log.action?.includes('ELIMINAR') 
                                ? 'bg-red-100 text-red-600' 
                                : log.action?.includes('CAMBIO')
                                ? 'bg-amber-100 text-amber-600'
                                : 'bg-blue-100 text-blue-600'
                            }`}>
                              {log.action?.replace(/_/g, ' ') || 'ACCIÓN DESCONOCIDA'}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-[var(--text-sub)] break-words">{log.targetName}</span>
                              {log.details?.type && (
                                <span className="text-[9px] text-gray-400 uppercase tracking-tighter">{log.details.type}</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {hasMoreAudit && auditLogs.length > 0 && (
                  <div className="p-8 flex justify-center border-t border-main bg-[var(--bg-secondary)]/10">
                    <button 
                      onClick={() => fetchAuditLogs(true)}
                      disabled={isLoadingAudit}
                      className="px-10 py-3 bg-[var(--bg-card)] border border-main rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-[var(--bg-secondary)] transition-all flex items-center gap-3 text-[var(--text-main)] shadow-sm hover:shadow-md disabled:opacity-50"
                    >
                      {isLoadingAudit ? <Loader2 size={16} className="animate-spin" /> : <ChevronDown size={16} />}
                      Cargar más registros
                    </button>
                  </div>
                )}
              </>
              )}
            </div>
          </div>
        )}

      </div>      {/* MODAL: MANAGE PROFESSIONAL PROFILE */}
      <AnimatePresence>
        {isManageProfessionalModalOpen && targetProf && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-hidden">
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="bg-[var(--bg-card)] w-full max-w-5xl h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[var(--border-main)] flex flex-col"
            >
              <div className="p-6 border-b border-main flex items-center justify-between bg-[var(--bg-card)]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <UserCog size={24} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg text-[var(--text-main)]">
                      Configurar Perfil: {targetProf.nombre}
                    </h3>
                    <p className="text-xs text-gray-500">
                      Ajuste de membretes y datos oficiales
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsPreviewOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                  >
                    <FileText size={16} /> Ver Vista Previa
                  </button>
                  <button
                    onClick={() => setIsManageProfessionalModalOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-full text-gray-500"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">
                      Prefijo
                    </label>
                    <select
                      value={targetProf.prefix || ""}
                      onChange={(e) => setTargetProf({ ...targetProf, prefix: e.target.value })}
                      className="input-field"
                    >
                      <option value="">Ninguno</option>
                      <option value="Dr.">Dr.</option>
                      <option value="Dra.">Dra.</option>
                      <option value="Lic.">Lic.</option>
                      <option value="Prof. Dr.">Prof. Dr.</option>
                    </select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">
                      Nombre
                    </label>
                    <input
                      type="text"
                      value={targetProf.nombre}
                      onChange={(e) =>
                        setTargetProf({ ...targetProf, nombre: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">
                      Especialidad
                    </label>
                    <input
                      type="text"
                      value={targetProf.especialidad}
                      onChange={(e) =>
                        setTargetProf({
                          ...targetProf,
                          especialidad: e.target.value,
                        })
                      }
                      className="input-field"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">
                      MP
                    </label>
                    <input
                      type="text"
                      value={targetProf.mp}
                      onChange={(e) =>
                        setTargetProf({ ...targetProf, mp: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">
                      ME
                    </label>
                    <input
                      type="text"
                      value={targetProf.me}
                      onChange={(e) =>
                        setTargetProf({ ...targetProf, me: e.target.value })
                      }
                      className="input-field"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1 font-black text-blue-500">
                      Rol de Acceso
                    </label>
                    <select
                      className="input-field"
                      value={targetProf.role || "orl"}
                      onChange={(e) => {
                        const newRole = e.target.value;
                        setTargetProf({ ...targetProf, role: newRole });
                      }}
                    >
                      <optgroup label="Administración">
                        <option value="admin">Administrador</option>
                        <option value="directora_medica">Directora Médica</option>
                        <option value="super_secretaria">Super Secretaria</option>
                        <option value="secretaria">Secretaría</option>
                      </optgroup>
                      <optgroup label="Especialidades">
                        <option value="cabeza y cuello">Cabeza y cuello</option>
                        <option value="cx plástica">CX Plástica</option>
                        <option value="electrografías">Electrografías</option>
                        <option value="orl">ORL</option>
                        <option value="vestibular">Vestibular</option>
                        <option value="fonoaudiología">Fonoaudiología</option>
                      </optgroup>
                    </select>
                  </div>

                  {/* Toggle Membrete COAT */}
                  <div className="md:col-span-5 pt-4 border-t border-main">

                    <label className="flex items-center gap-3 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-2xl border border-indigo-100 dark:border-indigo-900/30 cursor-pointer group hover:bg-indigo-50 transition-all">
                      <input
                        type="checkbox"
                        checked={!!targetProf.hasLetterhead}
                        onChange={(e) =>
                          setTargetProf({
                            ...targetProf,
                            hasLetterhead: e.target.checked,
                          })
                        }
                        className="w-6 h-6 rounded-lg border-indigo-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
                          HABILITAR ENCABEZADO PERSONALIZADO
                        </span>
                        <span className="text-xs text-indigo-700/60 dark:text-indigo-400/60">
                          Si se activa, este profesional podrá usar su encabezado personalizado (hasta 8 líneas) en lugar del nombre estándar de COAT. El logo y pie siempre se muestran.
                        </span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 p-4 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-900/30 cursor-pointer group hover:bg-blue-50 transition-all mt-4">
                      <input
                        type="checkbox"
                        checked={!!targetProf.canCustomizeModels}
                        onChange={(e) =>
                          setTargetProf({
                            ...targetProf,
                            canCustomizeModels: e.target.checked,
                          })
                        }
                        className="w-6 h-6 rounded-lg border-blue-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-blue-900 dark:text-blue-300">
                          HABILITAR "MIS MODELOS"
                        </span>
                        <span className="text-xs text-blue-700/60 dark:text-blue-400/60">
                          Si se activa, este profesional tendrá acceso a la pestaña "Mis Modelos" para personalizar sus informes base.
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Signature Section in Admin */}
                <div className="space-y-4 pt-4 border-t border-main">
                  <label className="text-[10px] font-black uppercase text-gray-400 ml-1">
                    Firma Digital (PNG)
                  </label>
                  <div className="flex items-center gap-6">
                    <div className="w-40 h-24 bg-white rounded-xl border-2 border-dashed border-main flex items-center justify-center relative overflow-hidden group">
                      {isUploadingSignature ? (
                        <div className="flex flex-col items-center gap-1 text-blue-500">
                          <Loader2 size={24} className="animate-spin" />
                          <span className="text-[8px] font-bold uppercase">
                            Subiendo
                          </span>
                        </div>
                      ) : targetProf.signatureBase64 ? (
                        <img
                          src={targetProf.signatureBase64}
                          alt="firma"
                          className="max-w-full max-h-full object-contain"
                        />
                      ) : (
                        <div className="text-gray-300 flex flex-col items-center">
                          <Upload size={20} />
                          <span className="text-[8px] font-bold">
                            Subir PNG
                          </span>
                        </div>
                      )}
                      {!isUploadingSignature && (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleSignatureUpload}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      )}
                    </div>
                    {targetProf.signatureBase64 && (
                      <button
                        onClick={() =>
                          setTargetProf({
                            ...targetProf,
                            signatureBase64: null,
                          })
                        }
                        className="px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[10px] font-black uppercase hover:bg-red-100 transition-colors"
                      >
                        Eliminar Firma
                      </button>
                    )}
                  </div>
                  <p className="text-[9px] text-gray-400 italic">
                    Esta firma se utilizará para generar los reportes en PDF
                    del profesional.
                  </p>
                </div>

                {/* Headers */}
                {targetProf.role === "directora_medica" && (
                  <div className="space-y-4">
                    <div className="flex gap-4 border-b border-main">
                      <button
                        onClick={() => setPreviewType("general")}
                        className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${previewType === "general" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-400"}`}
                      >
                        Membrete General
                      </button>
                      <button
                        onClick={() => setPreviewType("fibro")}
                        className={`px-6 py-3 font-bold text-sm transition-all border-b-2 ${previewType === "fibro" ? "border-blue-500 text-blue-600" : "border-transparent text-gray-400"}`}
                      >
                        Membrete Fibroscopía
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[var(--bg-secondary)] p-6 rounded-3xl border border-main">
                      {Array(8)
                        .fill(0)
                        .map((_, i) => (
                          <div key={i} className="space-y-1">
                            <label className="text-[9px] font-bold text-gray-400 ml-1 uppercase tracking-tight">
                              Línea {i + 1}{" "}
                              {i === 0
                                ? "(Principal)"
                                : i < 3
                                  ? "(Secundaria)"
                                  : "(Pie)"}
                            </label>
                            <input
                              type="text"
                              className="input-field text-sm"
                              value={
                                previewType === "general"
                                  ? targetProf.headerGeneral?.[i] || ""
                                  : targetProf.headerFibro?.[i] || ""
                              }
                              onChange={(e) =>
                                updateTargetHeader(
                                  previewType,
                                  i,
                                  e.target.value,
                                )
                              }
                              placeholder={`Texto línea ${i + 1}...`}
                            />
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="p-8 border-t border-main flex gap-4 bg-[var(--bg-card)]">
                <button
                  onClick={handleSaveManagedUser}
                  disabled={isProfSaving}
                  className="btn-primary flex-1 py-4 font-black flex items-center justify-center gap-2"
                >
                  {isProfSaving ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Save size={20} />
                  )}
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
          <div className="fixed inset-0 z-[400] flex items-center justify-center p-12 bg-slate-900/90 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white w-[210mm] min-h-[80mm] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] overflow-hidden relative border border-gray-400 flex flex-col p-[15mm]"
            >
              <div className="flex border-b-2 border-slate-200 pb-[5mm] mb-[5mm] relative">
                {targetProf.hasLetterhead === false && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-red-50 text-red-500 text-[8pt] font-black px-4 py-1 rounded-full border border-red-100 z-10 animate-pulse">
                    MEMBRETE DESACTIVADO PARA ESTE PROFESIONAL
                  </div>
                )}

                {/* Logo Area */}
                <div className="w-[45mm] flex items-center justify-center pr-10 border-r border-slate-100">
                  {targetProf.hasLetterhead !== false ? (
                    targetProf.logoBase64 ? (
                      <img
                        src={targetProf.logoBase64}
                        className="max-w-full max-h-full object-contain"
                        alt="logo"
                      />
                    ) : (
                      <img
                        src="/coat_logo.png"
                        className="max-w-full max-h-full object-contain"
                        alt="logo"
                      />
                    )
                  ) : (
                    <div className="text-slate-300 text-[8pt] font-bold uppercase text-center">
                      Logo<br/>Oculto
                    </div>
                  )}
                </div>

                {/* Header Text Area */}
                <div className="flex-1 flex flex-col justify-center">
                  {targetProf.hasLetterhead !== false || targetProf.role === 'directora_medica' ? (
                    (previewType === "general"
                      ? targetProf.headerGeneral || []
                      : targetProf.headerFibro || []
                    ).length > 0 && (previewType === "general" ? targetProf.headerGeneral : targetProf.headerFibro).some(l => l) ? (
                      (previewType === "general" ? targetProf.headerGeneral : targetProf.headerFibro).map((line, i) => {
                        if (!line) return null;
                        let fontSize = "9pt";
                        let fontWeight = "400";
                        let marginBottom = "1mm";
                        if (i === 0) {
                          fontSize = "16pt";
                          fontWeight = "700";
                          marginBottom = "3mm";
                        } else if (i < 3) {
                          fontSize = "11pt";
                          fontWeight = "600";
                        }
                        return (
                          <p key={i} style={{ fontSize, fontWeight, textAlign: "center", margin: 0, marginBottom, color: "#000000", fontFamily: "sans-serif" }}>
                            {line}
                          </p>
                        );
                      })
                    ) : (
                      <>
                        <p style={{ fontSize: '14pt', fontWeight: 'bold', textAlign: 'center', margin: 0, color: '#006680' }}>
                          CENTRO OTOAUDIOLÓGICO DE ALTA TECNOLOGÍA
                        </p>
                        <p style={{ fontSize: '10pt', textAlign: 'center', margin: 0, color: '#666' }}>
                          NARIZ - GARGANTA - OÍDO
                        </p>
                      </>
                    )
                  ) : (
                    <div className="text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
                      Encabezado Institucional Desactivado
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center justify-center py-20 border-2 border-dashed border-slate-100 rounded-3xl">
                <p className="text-slate-200 uppercase tracking-[0.5rem] font-bold text-sm">
                  Contenido editable del informe
                </p>
              </div>

              {/* Close Button UI */}
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-6 right-6 w-12 h-12 bg-red-500 text-white rounded-full shadow-2xl hover:bg-red-600 transition-all flex items-center justify-center active:scale-90"
              >
                <X size={28} />
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
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-[var(--bg-card)] w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border border-[var(--border-main)]"
            >
              <div className="p-6 border-b border-main flex items-center justify-between">
                <h3 className="font-bold flex items-center gap-2">
                  <UserPlus /> Nuevo Profesional
                </h3>
                <button
                  onClick={() => setIsManualModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold uppercase opacity-40 ml-1">
                      Nombre Completo
                    </label>
                    <input
                      type="text"
                      value={manualUserForm.nombre}
                      onChange={(e) =>
                        setManualUserForm({
                          ...manualUserForm,
                          nombre: e.target.value,
                        })
                      }
                      className="input-field"
                      placeholder="Dr. Nome Apellido"
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="text-xs font-bold uppercase opacity-40 ml-1">
                      Usuario
                    </label>
                    <input
                      type="text"
                      value={manualUserForm.u}
                      onChange={(e) =>
                        setManualUserForm({
                          ...manualUserForm,
                          u: e.target.value,
                        })
                      }
                      className="input-field"
                      placeholder="usuario_coat"
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="text-xs font-bold uppercase opacity-40 ml-1">
                      Contraseña
                    </label>
                    <input
                      type="password"
                      value={manualUserForm.password}
                      onChange={(e) =>
                        setManualUserForm({
                          ...manualUserForm,
                          password: e.target.value,
                        })
                      }
                      className="input-field"
                      placeholder="******"
                    />
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="text-xs font-bold uppercase opacity-40 ml-1">
                      Prefijo
                    </label>
                    <select
                      value={manualUserForm.prefix || ""}
                      onChange={(e) =>
                        setManualUserForm({
                          ...manualUserForm,
                          prefix: e.target.value,
                        })
                      }
                      className="input-field"
                    >
                      <option value="">Ninguno</option>
                      <option value="Dr.">Dr.</option>
                      <option value="Dra.">Dra.</option>
                      <option value="Lic.">Lic.</option>
                      <option value="Prof. Dr.">Prof. Dr.</option>
                    </select>
                  </div>
                  <div className="col-span-1 space-y-1">
                    <label className="text-xs font-bold uppercase opacity-40 ml-1">
                      Rol de Acceso
                    </label>
                    <select
                      value={manualUserForm.role}
                      onChange={(e) =>
                        setManualUserForm({
                          ...manualUserForm,
                          role: e.target.value,
                        })
                      }
                      className="input-field appearance-none cursor-pointer"
                    >
                      <optgroup label="Administración">
                        <option value="admin">Administrador</option>
                        <option value="directora_medica">Directora Médica</option>
                        <option value="secretaria">Secretaría</option>
                      </optgroup>
                      <optgroup label="Especialidades">
                        <option value="cabeza y cuello">Cabeza y cuello</option>
                        <option value="cx plástica">CX Plástica</option>
                        <option value="electrografías">Electrografías</option>
                        <option value="orl">ORL</option>
                        <option value="vestibular">Vestibular</option>
                        <option value="fonoaudiología">Fonoaudiología</option>
                      </optgroup>
                    </select>
                  </div>
                  <div className="col-span-2 space-y-1">
                    <label className="text-xs font-bold uppercase opacity-40 ml-1">
                      Especialidad (Texto libre)
                    </label>
                    <input
                      type="text"
                      value={manualUserForm.especialidad}
                      onChange={(e) =>
                        setManualUserForm({
                          ...manualUserForm,
                          especialidad: e.target.value,
                        })
                      }
                      className="input-field"
                      placeholder="Otorrinolaringología"
                    />
                  </div>
                </div>
                <button
                  onClick={handleManualUserCreate}
                  className="btn-primary w-full py-4 mt-4 font-black"
                >
                  CREAR CUENTA PROFESIONAL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminPage;
