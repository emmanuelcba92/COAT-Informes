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

const OrdersMain = ({ userProfile, isAdmin = false, isSecretaria = false }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  const tabs = [
    { id: 'new', label: 'Generar Pedido', icon: FilePlus, path: '/orders/new', show: !isSecretaria },
    { id: 'history', label: isSecretaria ? 'Ver Pedidos' : 'Historial', icon: History, path: '/orders/history', show: true }
  ].filter(tab => tab.show);

  return (
    <div className="flex flex-col gap-4">

      <div className="min-h-[400px]">
        <Suspense fallback={<div className="p-10 text-center opacity-50 text-[var(--text-main)]">Cargando sección de pedidos...</div>}>
          <Routes>
            <Route path="new" element={!isSecretaria ? <NewOrderPage userProfile={userProfile} /> : <Navigate to="/orders/history" replace />} />
            <Route path="history" element={<MyOrdersPage userProfile={userProfile} isAdmin={isAdmin} isSecretaria={isSecretaria} />} />
            <Route index element={<Navigate to={isSecretaria ? "history" : "new"} replace />} />
            <Route path="*" element={<Navigate to={isSecretaria ? "history" : "new"} replace />} />
          </Routes>
        </Suspense>
      </div>
    </div>
  );
};

export default OrdersMain;
