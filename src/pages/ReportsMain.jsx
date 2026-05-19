import React, { Suspense } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FilePlus, 
  History, 
  BookTemplate, 
  Layout,
  Search
} from 'lucide-react';

const ReportsPage = React.lazy(() => import('./ReportsPage'));
const MyReportsPage = React.lazy(() => import('./MyReportsPage'));
const PracticesPage = React.lazy(() => import('./PracticesPage'));

const ReportsMain = ({ currentUser, userProfile, isAdmin = false, isSecretaria = false, isSuperSecretaria = false, canCustomizeModels = false, isDarkMode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const isPreview = new URLSearchParams(location.search).get('preview') === 'true';

  const tabs = [
    { id: 'new', label: 'Generar Informe', icon: FilePlus, path: '/reports/new', show: !isSecretaria || isSuperSecretaria },
    { id: 'history', label: (isSecretaria && !isSuperSecretaria) ? 'Ver Informes' : 'Historial', icon: History, path: '/reports/history', show: true },
    { id: 'models', label: 'Mis Modelos', icon: BookTemplate, path: '/reports/models', show: canCustomizeModels && (!isSecretaria || isSuperSecretaria) }
  ].filter(tab => tab.show);

  const activeTab = tabs.find(tab => location.pathname.startsWith(tab.path)) || (tabs.length > 0 ? tabs[0] : null);

  return (
    <div className="flex flex-col gap-4">

      {/* Content Area */}
      <div className="min-h-[400px]">
        <Suspense fallback={<div className="p-10 text-center opacity-50">Cargando sección...</div>}>
          <Routes>
            <Route path="new" element={(!isSecretaria || isSuperSecretaria || isPreview) ? <ReportsPage isAdmin={isAdmin} isSecretaria={isSecretaria} isSuperSecretaria={isSuperSecretaria} userProfile={userProfile} isDarkMode={isDarkMode} /> : <Navigate to="/reports/history" replace />} />
            <Route path="history" element={<MyReportsPage user={currentUser} userProfile={userProfile} isAdmin={isAdmin} isSecretaria={isSecretaria} isSuperSecretaria={isSuperSecretaria} isDarkMode={isDarkMode} />} />
            <Route path="models" element={canCustomizeModels && (!isSecretaria || isSuperSecretaria) ? <PracticesPage isDarkMode={isDarkMode} /> : <Navigate to="/reports/history" replace />} />
            <Route index element={(isSecretaria && !isSuperSecretaria) ? <Navigate to="history" replace /> : <Navigate to="new" replace />} />
            <Route path="*" element={(isSecretaria && !isSuperSecretaria) ? <Navigate to="history" replace /> : <Navigate to="new" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
};

export default ReportsMain;
