import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  FileText, User, Users, Settings, Activity, Sun, Moon, LogOut, 
  ChevronRight, Menu, ClipboardList, Layout, FilePlus, History, BookTemplate
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { doc, getDoc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './services/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { supabase } from './services/supabase';

import AuthPage from './pages/AuthPage.jsx';
const ReportsMain = React.lazy(() => import('./pages/ReportsMain'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const OrdersMain = React.lazy(() => import('./pages/OrdersMain'));
const PatientsPage = React.lazy(() => import('./pages/PatientsPage'));

// Preload critical routes
const preloadRoutes = () => {
  import('./pages/ReportsMain');
  import('./pages/OrdersMain');
};

const PageLoader = () => (
  <div className="fixed inset-0 flex flex-col items-center justify-center bg-[var(--bg-page)] z-[100] animate-in fade-in duration-500">
    <div className="relative mb-6">
      <div className="w-20 h-20 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin"></div>
      <div className="absolute inset-0 flex items-center justify-center">
        <img src="/coat_logo.png" alt="COAT" className="w-10 h-10 object-contain animate-pulse" />
      </div>
    </div>
    <div className="flex flex-col items-center gap-2">
      <p className="text-lg font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent uppercase tracking-[0.2em] animate-pulse">
        COAT
      </p>
      <div className="flex gap-1">
        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
        <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
      </div>
    </div>
  </div>
);

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSecretaria, setIsSecretaria] = useState(false);
  const [isDirectora, setIsDirectora] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [ordersEnabled, setOrdersEnabled] = useState(true);

  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
    // Forzar título de pestaña corregido
    document.title = "Informes COAT - Centro Otoaudiológico de Alta Tecnología";
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    let timeoutId;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      // 2 hours = 7200,000 ms
      timeoutId = setTimeout(() => {
        if (auth.currentUser) {
          handleLogout();
          alert("Tu sesión ha expirado por inactividad (2 hs).");
        }
      }, 7200000);
    };

    if (currentUser) {
      // Listen for activity
      window.addEventListener('mousemove', resetTimer);
      window.addEventListener('keydown', resetTimer);
      window.addEventListener('click', resetTimer);
      window.addEventListener('scroll', resetTimer);
      resetTimer(); // Start timer
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('scroll', resetTimer);
    };
  }, [currentUser]);

  // Pre-carga agresiva un segundo después del inicio
  useEffect(() => {
    const timer = setTimeout(() => {
      preloadRoutes();
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let unsubscribeSettings = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Listener de configuración (solo si hay usuario)
        unsubscribeSettings = onSnapshot(doc(db, 'config', 'order_settings'), (snap) => {
          if (snap.exists()) {
            setOrdersEnabled(snap.data().ordersEnabled ?? true);
          }
        });

        // Heartbeat de Supabase
        try {
          await supabase.storage.from('informescoat').list('', { limit: 1 });
          console.log("Supabase heartbeat sent");
        } catch (e) {
          console.warn("Supabase Heartbeat error:", e.message);
        }

        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(data);
            const role = data.role?.toLowerCase() || '';
            setIsSecretaria(role === 'secretaria' || role === 'secre' || role === 'secretaría');
            setIsDirectora(role.includes('directora') || role.includes('director'));
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        }
      } else {
        setCurrentUser(null);
        setUserProfile(null);
        setIsSecretaria(false);
        setIsDirectora(false);
        unsubscribeSettings(); // Detener listener si se desloguea
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
    };
  }, []);

  const isAdmin = userProfile?.role === 'admin' || 
                  currentUser?.email?.toLowerCase() === 'egomez@coat.com.ar' ||
                  currentUser?.email?.toLowerCase() === 'aparedes@coat.com.ar';



  const canSeeOrders = ordersEnabled || isAdmin || isDirectora;
  const canCustomizeModels = userProfile?.canCustomizeModels || isDirectora || isAdmin;

  const navItems = [
    { id: 'reports', label: 'Informes', icon: <Layout size={24} />, path: '/reports', show: true },
    { id: 'orders', label: 'Pedidos', icon: <ClipboardList size={24} />, path: '/orders', show: canSeeOrders },
    { id: 'patients', label: 'Pacientes', icon: <Users size={24} />, path: '/patients', show: isAdmin || isDirectora || isSecretaria },
    { id: 'profile', label: 'Mi Perfil', icon: <User size={24} />, path: '/profile', show: true },
    { id: 'admin', label: 'Administración', icon: <Settings size={24} />, path: '/admin', show: isAdmin },
  ].filter(item => item.show);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (err) {
      console.error("Error signing out:", err);
    }
  };

  const userInitials = userProfile?.nombre 
    ? userProfile.nombre.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : currentUser?.email?.substring(0, 2).toUpperCase() || '??';

  if (!currentUser) {
    return (
      <div className={`min-h-screen transition-all duration-500 ${isDarkMode ? 'dark bg-slate-950' : 'bg-blue-50'}`}>
        <AuthPage 
          onLogin={(user) => {
            setCurrentUser(user);
            navigate('/reports');
          }} 
          isDarkMode={isDarkMode} 
          toggleTheme={toggleTheme} 
        />
      </div>
    );
  }

  return (
    <div className={`h-screen flex overflow-hidden transition-all duration-300 ${isDarkMode ? 'dark' : ''} bg-[var(--bg-page)] text-[var(--text-main)]`}>
      {/* Navigation Rail - Material 3 Style */}
      <aside className="w-24 flex-shrink-0 flex flex-col items-center py-6 glass border-r border-main z-50 h-full overflow-y-auto scrollbar-hide">
        <div className="mb-10">
          <img src="/coat_logo.png" alt="COAT" className="w-12 h-12 object-contain" />
        </div>
        
        <nav className="flex-1 flex flex-col gap-4 w-full">
          {navItems.map((item) => (
            <div
              key={item.id}
              onClick={() => navigate(item.path)}
              className={`nav-rail-item ${location.pathname.startsWith(item.path) ? 'active' : ''}`}
              title={item.label}
            >
              <div className={`p-2 rounded-full transition-all duration-300 ${location.pathname.startsWith(item.path) ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'}`}>
                {item.icon}
              </div>
              <span className={`text-[10px] font-black uppercase tracking-tighter text-center transition-colors duration-300 ${location.pathname.startsWith(item.path) ? 'text-blue-600' : 'text-slate-500 dark:text-slate-400'}`}>
                {item.label}
              </span>
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-4 mt-auto w-full items-center pb-4">
          <div 
            className="flex flex-col items-center gap-1 group cursor-pointer" 
            onClick={() => navigate('/profile')}
            title="Ver mi perfil"
          >
            <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold shadow-lg group-hover:shadow-blue-500/40 transition-all text-xs border-2 border-transparent group-hover:border-white/20">
              {userInitials}
            </div>
            <div className="flex flex-col items-center gap-0.5">
              {(userProfile?.nombre || currentUser.email?.split('@')[0] || '')
                .split(' ')
                .filter(part => part.length > 0)
                .map((part, idx) => (
                  <span key={idx} className="text-[9px] font-black text-blue-500 uppercase leading-tight tracking-tighter text-center max-w-[70px] break-words">
                    {part}
                  </span>
              ))}
            </div>
          </div>

          <button 
            onClick={toggleTheme}
            className="p-2.5 rounded-xl hover:bg-[var(--bg-secondary)] transition-colors"
          >
            {isDarkMode ? <Sun size={20} className="text-amber-400" /> : <Moon size={20} className="text-indigo-600" />}
          </button>
          
          <button 
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto">
        <header className="header">
          <div className="flex items-center justify-between w-full gap-4">
            <h2 className="text-xl font-bold opacity-80 tracking-tight shrink-0">
              {navItems.find(i => location.pathname.startsWith(i.path))?.label || 'Panel'}
            </h2>

            {/* Dynamic Tabs in Header */}
            {(location.pathname.startsWith('/reports') || location.pathname.startsWith('/orders')) && (
              <div className="hidden md:flex items-center gap-1 bg-[var(--bg-secondary)] p-1 rounded-xl border border-main">
                {(location.pathname.startsWith('/reports') ? [
                  { id: 'new', label: 'Generar Informe', icon: FilePlus, path: '/reports/new', show: !isSecretaria },
                  { id: 'history', label: isSecretaria ? 'Ver Informes' : 'Historial', icon: History, path: '/reports/history', show: true },
                  { id: 'models', label: 'Mis Modelos', icon: BookTemplate, path: '/reports/models', show: canCustomizeModels && !isSecretaria }
                ] : [
                  { id: 'new', label: 'Generar Pedido', icon: FilePlus, path: '/orders/new', show: !isSecretaria },
                  { id: 'history', label: isSecretaria ? 'Ver Pedidos' : 'Historial', icon: History, path: '/orders/history', show: true }
                ]).filter(tab => tab.show).map((tab) => {
                  const isActive = location.pathname.startsWith(tab.path) || 
                                 (tab.id === 'new' && (location.pathname === '/reports' || location.pathname === '/orders'));
                  return (
                    <button
                      key={tab.id}
                      onClick={() => navigate(tab.path)}
                      className={`
                        relative flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-bold transition-all
                        ${isActive 
                          ? 'text-white shadow-sm' 
                          : 'text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400'
                        }
                      `}
                    >
                      <div className="relative z-10 flex items-center gap-2">
                        <tab.icon size={16} />
                        <span>{tab.label}</span>
                      </div>
                      {isActive && (
                        <motion.div
                          layoutId="headerTab"
                          className="absolute inset-0 bg-blue-600 rounded-lg"
                          transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex-1 md:hidden"></div>
          </div>
        </header>

        <React.Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="p-3 md:pt-4 md:px-8 md:pb-8"
            >
              <Routes>
                <Route path="/" element={<Navigate to="/reports" replace />} />
                <Route path="/reports/*" element={<ReportsMain currentUser={currentUser} userProfile={userProfile} isSecretaria={isSecretaria} canCustomizeModels={canCustomizeModels} />} />
                <Route path="/orders/*" element={<OrdersMain userProfile={userProfile} isSecretaria={isSecretaria} />} />
                <Route path="/patients" element={isAdmin || isDirectora || isSecretaria ? <PatientsPage isAdmin={isAdmin} isSecretaria={isSecretaria} /> : <Navigate to="/reports" replace />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/admin" element={isAdmin ? <AdminPage /> : <Navigate to="/reports" replace />} />
                <Route path="*" element={<Navigate to="/reports" replace />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </React.Suspense>
      </main>
    </div>
  );
}

export default App;
