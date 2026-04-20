import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { 
  FileText, 
  User, 
  Settings, 
  Activity, 
  Sun, 
  Moon, 
  LogOut,
  ChevronRight,
  Menu,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';

const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const PracticesPage = React.lazy(() => import('./pages/PracticesPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const MyReportsPage = React.lazy(() => import('./pages/MyReportsPage'));

const PageLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
    <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
    <p className="text-sm font-bold opacity-40 uppercase tracking-widest">Cargando...</p>
  </div>
);

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

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

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setUserProfile(docSnap.data());
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
        }
      } else {
        setUserProfile(null);
      }
    });
    return () => unsubscribe();
  }, []);


  const isSecretaria = userProfile?.role === 'secre' || userProfile?.role === 'secretaría';
  const isAdmin = userProfile?.role === 'admin' || 
                  currentUser?.email?.toLowerCase() === 'egomez@coat.com.ar' ||
                  currentUser?.email?.toLowerCase() === 'aparedes@coat.com.ar';

  const navItems = [
    { id: 'reports', label: 'Informes', icon: <FileText size={24} />, path: '/', show: true },
    { id: 'history', label: isSecretaria ? 'Ver Informes' : 'Mis Informes', icon: <ClipboardList size={24} />, path: '/history', show: true },
    { id: 'profile', label: 'Mi Perfil', icon: <User size={24} />, path: '/profile', show: true },
    { id: 'practices', label: 'Mis Prácticas', icon: <Activity size={24} />, path: '/practices', show: !isSecretaria },
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
        <React.Suspense fallback={<PageLoader />}>
          <LoginPage 
            onLogin={(user) => {
              setCurrentUser(user);
              navigate('/');
            }} 
            isDarkMode={isDarkMode} 
            toggleTheme={toggleTheme} 
          />
        </React.Suspense>
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
              className={`nav-rail-item ${location.pathname === item.path ? 'active' : ''}`}
              title={item.label}
            >
              <div className={`p-2 rounded-full transition-colors ${location.pathname === item.path ? 'bg-blue-600 text-white' : ''}`}>
                {item.icon}
              </div>
              <span className="text-[10px] uppercase tracking-wider text-center">{item.label}</span>
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
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold opacity-80 tracking-tight">
              {navItems.find(i => i.path === location.pathname)?.label || 'Panel'}
            </h2>
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
              className="p-6 md:p-10"
            >
              <Routes>
                <Route path="/" element={<ReportsPage />} />
                <Route path="/history" element={<MyReportsPage user={currentUser} userProfile={userProfile} />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/practices" element={<PracticesPage />} />
                <Route path="/admin" element={<AdminPage />} />
              </Routes>
            </motion.div>
          </AnimatePresence>
        </React.Suspense>
      </main>
    </div>
  );
}

export default App;
