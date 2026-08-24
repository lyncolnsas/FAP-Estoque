import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, Package, Activity, Layers, TriangleAlert } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { api } from '../lib/api';

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth();

  useEffect(() => {
    if (!token) return;
    fetch(api('/dashboard/metrics'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (user?.role !== 'ADMIN') {
    return (
      <div className="text-center mt-20 text-red-400">
        <ShieldAlert size={48} className="mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Acesso Negado</h2>
        <p>Você não tem permissão de Administrador.</p>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center mt-20 text-slate-500">Carregando métricas do painel...</div>;
  }

  if (!metrics) {
    return <div className="text-center mt-20 text-slate-500">Erro ao carregar dados.</div>;
  }

  // Data for Charts
  const pieData = [
    { name: 'Disponível', value: metrics.equipamentosDisponiveis, color: '#10b981' },
    { name: 'Emprestado', value: metrics.equipamentosEmprestados, color: '#f59e0b' },
    { name: 'Com Defeito', value: metrics.equipamentosComDefeito, color: '#ef4444' },
  ].filter(d => d.value > 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Dashboard Gerencial</h1>
          <p className="text-slate-500 mt-1">Visão geral do acervo, requisições e status de empréstimos.</p>
        </div>
        <div className="flex items-center gap-3">
          <a href="/admin/equipamentos" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-blue-500/20">
            <Package size={18} />
            Novo Equipamento
          </a>
          <a href="/" className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium transition-colors shadow-sm">
            <Activity size={18} />
            Nova Requisição
          </a>
        </div>
      </div>

      {/* Cards KPI */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Layers size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total Acervo</p>
            <p className="text-2xl font-bold text-slate-800">{metrics.totalEquipamentos}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Em Uso (Emprestados)</p>
            <p className="text-2xl font-bold text-slate-800">{metrics.equipamentosEmprestados}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center shrink-0">
            <TriangleAlert size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Com Avaria</p>
            <p className="text-2xl font-bold text-slate-800">{metrics.equipamentosComDefeito}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-sm text-slate-500 font-medium">Total de Requisições</p>
            <p className="text-2xl font-bold text-slate-800">{metrics.totalRequisicoes}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Pie Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Status do Acervo</h3>
          <div className="h-[300px] w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`${value} itens`, 'Quantidade']} />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            ) : (
               <div className="h-full flex items-center justify-center text-slate-400">Sem dados de acervo</div>
            )}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-lg font-bold text-slate-800 mb-6">Top Setores Solicitantes</h3>
          <div className="h-[300px] w-full">
            {metrics.topDepartamentos && metrics.topDepartamentos.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.topDepartamentos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill: '#64748b', fontSize: 12}} axisLine={false} tickLine={false} />
                  <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                  <Bar dataKey="count" name="Requisições" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-400">Nenhum departamento registrado</div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Requisições Pendentes de Devolução</h3>
            <p className="text-sm text-slate-500">Setores que estão com equipamentos e ainda não devolveram.</p>
          </div>
        </div>
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="hidden md:table-header-group bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Setor</th>
              <th className="px-6 py-4">Solicitante</th>
              <th className="px-6 py-4">Prev. Devolução (Fim Evento)</th>
              <th className="px-6 py-4">Itens</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 block md:table-row-group">
            {metrics.pendingReturns?.map((req: any) => {
              const isAtrasado = new Date(req.dataFimEvento) < new Date();
              return (
                <tr key={req.id} className={`block md:table-row transition-colors border-b border-slate-100 md:border-b-0 ${isAtrasado ? 'bg-red-50/30 hover:bg-red-50/60' : 'hover:bg-slate-50'}`}>
                  <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell">
                    <div className="flex items-center gap-2">
                      {isAtrasado && <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse"></div>}
                      <span className="font-semibold text-slate-900">{req.departamento}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                    <div className="flex justify-between md:block">
                      <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Solicitante</span>
                      <span>{req.solicitanteNome}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                    <div className="flex justify-between md:block">
                      <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Devolução</span>
                      <span className={`font-medium ${isAtrasado ? 'text-red-600' : 'text-slate-600'}`}>
                        {new Date(req.dataFimEvento).toLocaleDateString('pt-BR')} {isAtrasado && <span className="text-xs font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md ml-1">Atrasado</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                    <div className="flex justify-between md:block">
                      <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Itens</span>
                      <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">{req.itens.length} equipamentos</span>
                    </div>
                  </td>
                  <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                    <div className="flex justify-between items-center md:block">
                      <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Status</span>
                      <div>
                        {req.status === 'AGUARDANDO_ACEITE' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">Aguardando Aceite</span>}
                        {req.status === 'EMPRESTADO' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Emprestado</span>}
                      </div>
                    </div>
                  </td>
                </tr>
              )
            })}
            {(!metrics.pendingReturns || metrics.pendingReturns.length === 0) && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <div className="text-4xl">🎉</div>
                    Nenhuma pendência de devolução. Parabéns!
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
// aria-label
