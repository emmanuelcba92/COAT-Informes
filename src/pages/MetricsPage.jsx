import React, { useState, useEffect } from 'react';
import { 
  BarChart3, Users, Award, TrendingUp, RefreshCw, 
  Search, Calendar, Filter, Download, UserCheck, 
  ChevronRight, ArrowUpRight, Activity, FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, query, getDocs, orderBy, limit, where } from 'firebase/firestore';
import { db } from '../services/firebase';

const MetricsPage = ({ isDarkMode }) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState([]);
  const [filter, setFilter] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      // Cargamos informes para calcular métricas (últimos 1000 para balancear rendimiento/dato)
      const q = query(collection(db, "reports"), orderBy("fechaCreatedAt", "desc"), limit(1000));
      const snap = await getDocs(q);
           const statsMap = {};
      
      snap.docs.forEach(doc => {
        const data = doc.data();
        const authorId = data.createdBy || data.profesionalId;
        let authorName = data.createdByName || data.profesionalNombre;
        
        if (!authorName || authorName === "Desconocido") {
          authorName = authorId ? `ID: ${authorId.substring(0, 8)}...` : "Desconocido";
        }

        const profId = data.profesionalId;
        const profName = data.profesionalNombre && data.profesionalNombre !== "Desconocido" 
          ? data.profesionalNombre 
          : (profId ? `ID: ${profId.substring(0, 8)}...` : "Desconocido");
        
        const practiceName = data.practicaNombre || data.practica || "Sin nombre de práctica";
        const isDelegated = data.createdBy && data.createdBy !== data.profesionalId;

        if (!statsMap[authorId]) {
          statsMap[authorId] = {
            id: authorId,
            name: authorName,
            total: 0,
            delegated: 0,
            targets: {},
            practices: {}, // Track all practices for this author
            lastActivity: data.fechaCreatedAt
          };
        }

        statsMap[authorId].total++;
        
        // Track practice count for author
        if (!statsMap[authorId].practices[practiceName]) {
          statsMap[authorId].practices[practiceName] = 0;
        }
        statsMap[authorId].practices[practiceName]++;

        if (isDelegated) {
          statsMap[authorId].delegated++;
          if (!statsMap[authorId].targets[profId]) {
            statsMap[authorId].targets[profId] = { 
              name: profName, 
              count: 0,
              reports: {}
            };
          }
          statsMap[authorId].targets[profId].count++;
          
          if (!statsMap[authorId].targets[profId].reports[practiceName]) {
            statsMap[authorId].targets[profId].reports[practiceName] = 0;
          }
          statsMap[authorId].targets[profId].reports[practiceName]++;
        }
      });

      setStats(Object.values(statsMap).sort((a, b) => b.total - a.total));
    } catch (err) {
      console.error("Error fetching metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredStats = stats.filter(s => 
    s.name.toLowerCase().includes(filter.toLowerCase())
  );

  const totalReports = stats.reduce((acc, s) => acc + s.total, 0);
  const totalDelegated = stats.reduce((acc, s) => acc + s.delegated, 0);

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-10">
      {/* Header & Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <h1 className="text-3xl font-black tracking-tighter uppercase mb-1 flex items-center gap-3">
            <Activity className="text-blue-600" size={32} />
            Métricas
          </h1>
          <p className="text-sm font-black text-slate-950 dark:text-slate-400">Panel de productividad y gestión de autoría</p>
        </div>
        
        <div className="card p-4 flex items-center gap-4 group hover:border-blue-500/50 transition-all">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
            <BarChart3 size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-400 tracking-widest">Total Informes</p>
            <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{totalReports}</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-4 group hover:border-amber-500/50 transition-all">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
            <UserCheck size={24} />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase text-slate-900 dark:text-slate-400 tracking-widest">Informes Delegados</p>
            <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">{totalDelegated}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between card p-3">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre de autor..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-main rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-medium transition-all text-slate-900 dark:text-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={fetchData}
            disabled={loading}
            className="p-2 rounded-xl bg-[var(--bg-page)] border border-main hover:bg-blue-600 hover:text-white transition-all disabled:opacity-50"
            title="Sincronizar Datos"
          >
            <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Productivity Table */}
        <div className="lg:col-span-2 space-y-4">
          <div className="card">
            <div className="p-6 border-b border-main flex items-center justify-between bg-gradient-to-r from-blue-600/5 to-transparent">
              <div>
                <h3 className="text-xl font-black tracking-tight uppercase text-slate-950 dark:text-white">Rendimiento por Autor Real</h3>
                <p className="text-xs font-black text-slate-900 dark:text-slate-400">Desglose de informes realizados por usuario (incluye delegados)</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-black/20 text-left">
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-900 dark:text-slate-400 tracking-widest">Autor Real</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-900 dark:text-slate-400 tracking-widest text-center">Total</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-900 dark:text-slate-400 tracking-widest">Desglose de Informes</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase text-slate-900 dark:text-slate-400 tracking-widest">Productividad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-main">
                  <AnimatePresence>
                    {filteredStats.map((item, idx) => (
                      <motion.tr 
                        key={item.id || idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="hover:bg-blue-600/5 transition-colors group"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-blue-600/10 flex items-center justify-center text-blue-600 font-black text-xs border border-blue-500/20 group-hover:scale-110 transition-transform shrink-0">
                              {item.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="font-black tracking-tight uppercase text-sm truncate text-slate-950 dark:text-white">{item.name}</p>
                              <p className="text-[10px] font-black uppercase tracking-tighter italic text-slate-950 dark:text-slate-400">
                                {item.delegated > 0 ? `${item.delegated} delegados` : 'Personal directo'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center justify-center min-w-[32px] h-8 bg-slate-100 dark:bg-slate-800 rounded-lg font-black text-sm">
                            {item.total}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 max-w-[300px]">
                            {Object.entries(item.practices).map(([name, count], pidx) => (
                              <div key={pidx} className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 transition-all">
                                <span className="text-[9px] font-black uppercase truncate max-w-[120px] text-slate-900 dark:text-slate-400">{name}</span>
                                <span className="text-[10px] font-black text-blue-600">{count}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-1 min-w-[60px] h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${(item.total / (stats[0]?.total || 1)) * 100}%` }}
                                className={`h-full ${item.delegated > 0 ? 'bg-gradient-to-r from-blue-600 to-amber-500' : 'bg-blue-600'}`}
                              />
                            </div>
                            <span className="text-[10px] font-black text-blue-600">
                              {Math.round((item.total / totalReports) * 100)}%
                            </span>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Breakdown Card */}
        <div className="space-y-6">
          <div className="card p-6 h-full relative overflow-hidden">
             <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12">
               <TrendingUp size={120} />
             </div>

             <h3 className="text-lg font-black uppercase tracking-tight mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
               <Users className="text-blue-600" size={20} />
               Desglose de Gestión
             </h3>

             <div className="space-y-6 relative z-10">
               {filteredStats.filter(s => s.delegated > 0).map((admin, idx) => (
                 <div key={admin.id || idx} className="space-y-3">
                   <div className="flex items-center justify-between">
                     <p className="text-sm font-black uppercase text-blue-600">{admin.name}</p>
                     <span className="text-[10px] font-black px-2 py-0.5 bg-blue-600/10 rounded-full uppercase">Autor Delegado</span>
                   </div>
                   
                   <div className="grid grid-cols-1 gap-4">
                     {Object.values(admin.targets).map((target, tidx) => (
                       <div key={tidx} className="bg-slate-50 dark:bg-black/20 rounded-2xl border border-main overflow-hidden">
                         <div className="flex items-center justify-between p-3 bg-white/80 dark:bg-slate-800/50 border-b border-main shadow-sm">
                           <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                             <p className="text-xs font-black uppercase truncate max-w-[150px] text-slate-900 dark:text-white">{target.name}</p>
                           </div>
                           <div className="flex items-center gap-1.5">
                             <span className="text-xs font-black text-blue-600">{target.count}</span>
                           </div>
                         </div>
                         
                         {/* Detailed list of report types */}
                         <div className="p-3 space-y-2 bg-white dark:bg-transparent">
                           {Object.entries(target.reports).map(([rType, rCount], ridx) => (
                             <div key={ridx} className="flex items-center justify-between text-[10px]">
                                <div className="flex items-center gap-2 text-slate-900 dark:text-slate-400">
                                  <FileText size={12} />
                                  <span className="font-bold uppercase truncate max-w-[180px]">{rType}</span>
                                </div>
                                <span className="font-black bg-blue-600/10 text-blue-600 px-1.5 py-0.5 rounded">
                                  {rCount}
                                </span>
                             </div>
                           ))}
                         </div>
                       </div>
                     ))}
                   </div>
                 </div>
               ))}
               
               {filteredStats.filter(s => s.delegated > 0).length === 0 && (
                 <div className="text-center py-12 italic text-slate-900 dark:text-slate-400">
                    <p className="text-sm font-black">No se detectaron informes delegados recientemente.</p>
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsPage;
