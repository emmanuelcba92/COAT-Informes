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
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from './services/firebase';

import LoginPage from './pages/LoginPage';
import ReportsPage from './pages/ReportsPage';
import ProfilePage from './pages/ProfilePage';
import PracticesPage from './pages/PracticesPage';
import AdminPage from './pages/AdminPage';

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
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const [userProfile, setUserProfile] = useState(null);

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

  const role = (userProfile?.role || '').toLowerCase();
  const isAdmin = role === 'administrador' || 
                  role === 'admin' ||
                  currentUser?.email?.toLowerCase() === 'egomez@coat.com.ar' ||
                  currentUser?.email?.toLowerCase() === 'aparedes@coat.com.ar';

  const isSecretaria = role === 'secretaría';

  const navItems = [
    { id: 'reports', label: 'Informes', icon: <FileText size={24} />, path: '/' },
    { id: 'profile', label: 'Mi Perfil', icon: <User size={24} />, path: '/profile' },
    { id: 'practices', label: 'Mis Prácticas', icon: <Activity size={24} />, path: '/practices', hideForSecretaria: true },
    { id: 'admin', label: 'Administración', icon: <Settings size={24} />, path: '/admin', adminOnly: true },
  ].filter(item => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.hideForSecretaria && isSecretaria) return false;
    return true;
  });

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
        <LoginPage 
          onLogin={(user) => {
            setCurrentUser(user);
            navigate('/');
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
            <span className="text-[9px] font-bold text-blue-500 truncate max-w-[60px] text-center">
              {(userProfile?.nombre || '').split(' ')[0] || currentUser.email?.split('@')[0]}
            </span>
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

        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="p-6 md:p-10"
          >
            <Routes>
              <Route path="/" element={<ReportsPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/practices" element={<PracticesPage />} />
              <Route 
                path="/admin" 
                element={isAdmin ? <AdminPage /> : <ReportsPage />} 
              />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
