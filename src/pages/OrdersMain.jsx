import React, { Suspense } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FilePlus, 
  History, 
  ClipboardList
} from 'lucide-react';

const NewOrderPage = React.lazy(() => import('./NewOrderPage'));
const MyOrdersPage = React.lazy(() => import('./MyOrdersPage'));

const OrdersMain = ({ userProfile, isAdmin = false, isSecretaria = false, isSuperSecretaria = false, isDarkMode }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { id: 'new', label: 'Generar Pedido', icon: FilePlus, path: '/orders/new', show: !isSecretaria || isSuperSecretaria },
    { id: 'history', label: (isSecretaria && !isSuperSecretaria) ? 'Ver Pedidos' : 'Historial', icon: History, path: '/orders/history', show: true }
  ].filter(tab => tab.show);

  return (
    <div className="flex flex-col gap-4">

      <div className="min-h-[400px]">
        <Suspense fallback={<div className="p-10 text-center opacity-50 text-[var(--text-main)]">Cargando sección de pedidos...</div>}>
          <Routes>
            <Route path="new" element={(!isSecretaria || isSuperSecretaria) ? <NewOrderPage userProfile={userProfile} isAdmin={isAdmin} isSuperSecretaria={isSuperSecretaria} isDarkMode={isDarkMode} /> : <Navigate to="/orders/history" replace />} />
            <Route path="history" element={<MyOrdersPage userProfile={userProfile} isAdmin={isAdmin} isSecretaria={isSecretaria} isSuperSecretaria={isSuperSecretaria} isDarkMode={isDarkMode} />} />
            <Route index element={(isSecretaria && !isSuperSecretaria) ? <Navigate to="history" replace /> : <Navigate to="new" replace />} />
            <Route path="*" element={(isSecretaria && !isSuperSecretaria) ? <Navigate to="history" replace /> : <Navigate to="new" replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
};

export default OrdersMain;
