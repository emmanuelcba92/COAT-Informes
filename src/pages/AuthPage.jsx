import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogIn, User, Lock, AlertCircle, Sun, Moon } from 'lucide-react';
import { auth, db } from '../services/firebase';
import { signInWithEmailAndPassword, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';

const LoginPage = ({ onLogin, isDarkMode, toggleTheme }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setError('Por favor complete todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const fullEmail = `${username.trim()}@coat.com.ar`;
      await setPersistence(auth, browserSessionPersistence);
      const userCredential = await signInWithEmailAndPassword(auth, fullEmail, password);
      
      // Actualizar última conexión en Firestore
      try {
        await updateDoc(doc(db, 'users', userCredential.user.uid), {
          lastLogin: new Date().toISOString()
        });
      } catch (updateErr) {
        console.error("Error updating lastLogin:", updateErr);
      }

      onLogin(userCredential.user);
    } catch (err) {
      console.error("Login error:", err);
      setError('Credenciales incorrectas o error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 transition-all duration-500" style={{ backgroundColor: 'var(--bg-page)' }}>
      
      {/* Theme Toggle for Login Page */}
      <div className="absolute top-6 right-6 z-50">
        <button 
          onClick={toggleTheme}
          className="p-3.5 rounded-2xl backdrop-blur-xl border transition-all shadow-xl group overflow-hidden relative"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}
          title={isDarkMode ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
        >
          <div className="relative z-10 flex items-center justify-center">
            {isDarkMode ? (
              <Sun size={20} className="text-amber-400 group-hover:rotate-45 transition-transform duration-500" />
            ) : (
              <Moon size={20} className="text-indigo-600 group-hover:-rotate-12 transition-transform duration-500" />
            )}
          </div>
        </button>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md backdrop-blur-md rounded-[2.5rem] shadow-2xl overflow-hidden border"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-main)' }}
      >
        <div className="p-8 pb-4 text-center">
          <img src="/coat_logo.png" alt="COAT" className="w-20 h-20 mx-auto mb-4 object-contain" />
          <h1 className="text-3xl font-bold mb-2 font-outfit text-[var(--text-main)]">Informes COAT</h1>
          <p className="text-[var(--text-sub)]">Ingrese sus credenciales de profesional</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold ml-1 text-[var(--text-main)]">Usuario</label>
            <div className="relative group">
              <User className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Usuario..."
                className="w-full pl-11 pr-4 py-3 border-2 focus:border-blue-600 rounded-2xl outline-none transition-all bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-main)]"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold ml-1 text-[var(--text-main)]">Contraseña</label>
            <div className="relative group">
              <Lock className="absolute left-3 top-3 text-gray-400 group-focus-within:text-blue-600 transition-colors" size={20} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-11 pr-4 py-3 border-2 focus:border-blue-600 rounded-2xl outline-none transition-all bg-[var(--bg-secondary)] border-[var(--border-main)] text-[var(--text-main)]"
              />
            </div>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 p-3 rounded-xl border text-sm"
                style={{ 
                  backgroundColor: 'rgba(239, 68, 68, 0.1)', 
                  borderColor: 'rgba(239, 68, 68, 0.2)',
                  color: '#ef4444' 
                }}
              >
                <AlertCircle size={18} />
                <span>{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-500/30 hover:shadow-blue-500/40 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <LogIn size={20} />
                <span>Ingresar</span>
              </>
            )}
          </button>
        </form>

        <div className="p-6 border-t text-center bg-[var(--bg-secondary)] border-[var(--border-main)]">
          <p className="text-xs text-[var(--text-sub)]">
            &copy; 2026 COAT • Centro Otoaudiológico de Alta Tecnología
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LoginPage;
