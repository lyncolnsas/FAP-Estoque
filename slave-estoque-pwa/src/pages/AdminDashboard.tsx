import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert, Package, Activity, Layers, TriangleAlert,
  Truck, Calendar, CheckCircle2, Clock, MapPin, Edit, Save, X, ExternalLink
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip as RechartsTooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';
import { api } from '../lib/api';
import { toast } from 'sonner';

type PanelTab = 'visao-geral' | 'emprestimos' | 'reservas';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<PanelTab>('visao-geral');
  const [metrics, setMetrics] = useState<any>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const { token, user } = useAuth();

  // ── Reservas state ──────────────────────────────────────────────────────────
  const [reservas, setReservas] = useState<any[]>([]);
  const [locais, setLocais] = useState<any[]>([]);
  const [loadingReservas, setLoadingReservas] = useState(false);
  const [reservaTab, setReservaTab] = useState<'PENDENTES' | 'CONFIRMADAS'>('PENDENTES');
  const [editingReserva, setEditingReserva] = useState<any>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editLocalId, setEditLocalId] = useState('');
  const [editInicio, setEditInicio] = useState('');
  const [editFim, setEditFim] = useState('');

  // ── Métricas ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    fetch(api('/dashboard/metrics'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setMetrics)
      .catch(console.error)
      .finally(() => setLoadingMetrics(false));
  }, [token]);

  // ── Reservas ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab === 'reservas' && token) {
      carregarReservas();
    }
  }, [activeTab, token]);

  const carregarReservas = async () => {
    setLoadingReservas(true);
    try {
      const [resReservas, resLocais] = await Promise.all([
        fetch(api('/reservas-locais'), { headers: { Authorization: `Bearer ${token}` } }),
        fetch(api('/locais'),          { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const dataReservas = await resReservas.json();
      const dataLocais   = await resLocais.json();
      if (Array.isArray(dataReservas)) setReservas(dataReservas);
      if (Array.isArray(dataLocais))   setLocais(dataLocais);
    } catch {
      toast.error('Erro ao carregar reservas');
    } finally {
      setLoadingReservas(false);
    }
  };

  const handleSalvarEdicao = async () => {
    try {
      const res = await fetch(api(`/reservas-locais/${editingReserva.id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          status:    editStatus,
          localId:   editLocalId,
          dataInicio: new Date(editInicio).toISOString(),
          dataFim:    new Date(editFim).toISOString(),
        }),
      });
      if (res.ok) {
        toast.success('Reserva atualizada com sucesso!');
        setEditingReserva(null);
        carregarReservas();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao atualizar reserva');
      }
    } catch {
      toast.error('Erro de conexão');
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString('pt-BR')} às ${d.toLocaleTimeString('pt-BR').slice(0, 5)}`;
  };

  const pendentes   = reservas.filter(r => r.status === 'AGUARDANDO');
  const confirmadas = reservas.filter(r => r.status === 'CONFIRMADA');
  const listaReservas = reservaTab === 'PENDENTES' ? pendentes : confirmadas;

  if (user?.role !== 'ADMIN') {
    return (
      <div className="text-center mt-20 text-red-400">
        <ShieldAlert size={48} className="mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Acesso Negado</h2>
        <p>Você não tem permissão de Administrador.</p>
      </div>
    );
  }

  const pieData = metrics ? [
    { name: 'Disponível', value: metrics.equipamentosDisponiveis, color: '#10b981' },
    { name: 'Emprestado', value: metrics.equipamentosEmprestados, color: '#f59e0b' },
    { name: 'Com Defeito', value: metrics.equipamentosComDefeito, color: '#ef4444' },
  ].filter(d => d.value > 0) : [];

  // ── Tabs config ─────────────────────────────────────────────────────────────
  const TABS: { id: PanelTab; label: string; icon: React.ElementType; badge?: number }[] = [
    { id: 'visao-geral',  label: 'Visão Geral',            icon: Activity },
    { id: 'emprestimos',  label: 'Empréstimos & Devoluções', icon: Truck,
      badge: metrics?.equipamentosEmprestados || 0 },
    { id: 'reservas',     label: 'Reservas de Locais',      icon: Calendar,
      badge: pendentes.length || undefined },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-6">

      {/* ── Cabeçalho ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Painel de Estoque</h1>
          <p className="text-slate-500 mt-1">Gerencie e inicie empréstimos, devoluções e reservas de locais.</p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/admin/equipamentos"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm shadow-blue-500/20"
          >
            <Package size={18} /> Novo Equipamento
          </a>
          <a
            href="/"
            className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg font-medium transition-colors shadow-sm"
          >
            <Activity size={18} /> Nova Requisição
          </a>
        </div>
      </div>

      {/* ── Abas ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-500 text-blue-600 bg-blue-50/50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon size={16} />
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                    tab.id === 'reservas' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Conteúdo da aba ─────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">

          {/* ── VISÃO GERAL ──────────────────────────────────────────────── */}
          {activeTab === 'visao-geral' && (
            <motion.div
              key="visao-geral"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-8"
            >
              {loadingMetrics ? (
                <div className="text-center py-16 text-slate-400">Carregando métricas...</div>
              ) : !metrics ? (
                <div className="text-center py-16 text-slate-400">Erro ao carregar dados.</div>
              ) : (
                <>
                  {/* KPIs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                    {[
                      { label: 'Total Acervo',       value: metrics.totalEquipamentos,    color: 'bg-blue-50 text-blue-600',   Icon: Layers },
                      { label: 'Em Uso',              value: metrics.equipamentosEmprestados, color: 'bg-amber-50 text-amber-600', Icon: Package },
                      { label: 'Com Avaria',          value: metrics.equipamentosComDefeito,  color: 'bg-red-50 text-red-600',    Icon: TriangleAlert },
                      { label: 'Total Requisições',   value: metrics.totalRequisicoes,     color: 'bg-indigo-50 text-indigo-600', Icon: Activity },
                    ].map(kpi => (
                      <div key={kpi.label} className="bg-slate-50 p-5 rounded-xl flex items-center gap-4 border border-slate-100">
                        <div className={`w-11 h-11 rounded-full ${kpi.color} flex items-center justify-center shrink-0`}>
                          <kpi.Icon size={22} />
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
                          <p className="text-2xl font-bold text-slate-800">{kpi.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Gráficos */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                      <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Status do Acervo</h3>
                      <div className="h-[260px]">
                        {pieData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value">
                                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                              </Pie>
                              <RechartsTooltip formatter={(v) => [`${v} itens`, 'Quantidade']} />
                              <Legend verticalAlign="bottom" height={36} />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-400 text-sm">Sem dados de acervo</div>
                        )}
                      </div>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-xl border border-slate-100">
                      <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase tracking-wider">Top Setores Solicitantes</h3>
                      <div className="h-[260px]">
                        {metrics.topDepartamentos?.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={metrics.topDepartamentos} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                              <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                              <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                              <Bar dataKey="count" name="Requisições" fill="#3b82f6" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            </BarChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-slate-400 text-sm">Nenhum departamento registrado</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Pendentes de Devolução */}
                  <div className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                      <div>
                        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Pendentes de Devolução</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Setores com equipamentos ainda não devolvidos.</p>
                      </div>
                      <a href="/entregas" className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium">
                        Ver Entregas <ExternalLink size={12} />
                      </a>
                    </div>
                    <table className="w-full text-left text-sm text-slate-600">
                      <thead className="hidden md:table-header-group bg-white text-xs uppercase text-slate-400 border-b border-slate-200">
                        <tr>
                          <th className="px-5 py-3">Setor</th>
                          <th className="px-5 py-3">Solicitante</th>
                          <th className="px-5 py-3">Prev. Devolução</th>
                          <th className="px-5 py-3">Itens</th>
                          <th className="px-5 py-3">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 block md:table-row-group">
                        {metrics.pendingReturns?.map((req: any) => {
                          const isAtrasado = new Date(req.dataFimEvento) < new Date();
                          return (
                            <tr key={req.id} className={`block md:table-row transition-colors ${isAtrasado ? 'bg-red-50/40' : 'hover:bg-white'}`}>
                              <td className="px-4 py-3 md:px-5 block md:table-cell">
                                <div className="flex items-center gap-2">
                                  {isAtrasado && <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 animate-pulse" />}
                                  <span className="font-semibold text-slate-900">{req.departamento}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 md:px-5 md:py-3 block md:table-cell">
                                <div className="flex justify-between md:block">
                                  <span className="md:hidden text-xs font-semibold text-slate-400 uppercase">Solicitante</span>
                                  <span>{req.solicitanteNome}</span>
                                </div>
                              </td>
                              <td className="px-4 py-2 md:px-5 md:py-3 block md:table-cell">
                                <div className="flex justify-between md:block">
                                  <span className="md:hidden text-xs font-semibold text-slate-400 uppercase">Devolução</span>
                                  <span className={`font-medium ${isAtrasado ? 'text-red-600' : ''}`}>
                                    {new Date(req.dataFimEvento).toLocaleDateString('pt-BR')}
                                    {isAtrasado && <span className="ml-1 text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded-md font-bold">Atrasado</span>}
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-2 md:px-5 md:py-3 block md:table-cell">
                                <span className="font-mono text-xs bg-white px-2 py-1 rounded border border-slate-200">{req.itens.length} itens</span>
                              </td>
                              <td className="px-4 py-2 md:px-5 md:py-3 block md:table-cell">
                                {req.status === 'AGUARDANDO_ACEITE' && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">Aguardando Aceite</span>}
                                {req.status === 'EMPRESTADO'        && <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Emprestado</span>}
                              </td>
                            </tr>
                          );
                        })}
                        {(!metrics.pendingReturns || metrics.pendingReturns.length === 0) && (
                          <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-400 text-sm">🎉 Nenhuma pendência de devolução. Parabéns!</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ── EMPRÉSTIMOS & DEVOLUÇÕES ─────────────────────────────────── */}
          {activeTab === 'emprestimos' && (
            <motion.div
              key="emprestimos"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-8 flex flex-col items-center justify-center min-h-[320px] text-center gap-6"
            >
              <div className="w-20 h-20 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center">
                <Truck size={36} />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Entregas & Devoluções</h2>
                <p className="text-slate-500 text-sm mt-1 max-w-md">
                  Gerencie empréstimos ativos, inicie devoluções e confirme recebimentos de materiais.
                </p>
              </div>
              {metrics && (
                <div className="flex gap-4 flex-wrap justify-center">
                  <div className="bg-amber-50 border border-amber-100 rounded-xl px-5 py-3 text-center">
                    <p className="text-2xl font-bold text-amber-700">{metrics.equipamentosEmprestados}</p>
                    <p className="text-xs text-amber-600 font-medium">Emprestados</p>
                  </div>
                  <div className="bg-red-50 border border-red-100 rounded-xl px-5 py-3 text-center">
                    <p className="text-2xl font-bold text-red-700">{metrics.pendingReturns?.length || 0}</p>
                    <p className="text-xs text-red-600 font-medium">Pendentes Devolução</p>
                  </div>
                  <div className="bg-green-50 border border-green-100 rounded-xl px-5 py-3 text-center">
                    <p className="text-2xl font-bold text-green-700">{metrics.equipamentosDisponiveis}</p>
                    <p className="text-xs text-green-600 font-medium">Disponíveis</p>
                  </div>
                </div>
              )}
              <a
                href="/entregas"
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-3 rounded-xl transition-colors shadow-sm shadow-blue-500/20"
              >
                <Truck size={18} /> Ir para Entregas & Devoluções
              </a>
            </motion.div>
          )}

          {/* ── RESERVAS DE LOCAIS ───────────────────────────────────────── */}
          {activeTab === 'reservas' && (
            <motion.div
              key="reservas"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-5"
            >
              {/* Sub-tabs */}
              <div className="flex border-b border-slate-100 gap-4">
                <button
                  onClick={() => setReservaTab('PENDENTES')}
                  className={`pb-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
                    reservaTab === 'PENDENTES'
                      ? 'border-amber-500 text-amber-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <Clock size={15} /> Pendentes
                  {pendentes.length > 0 && (
                    <span className="bg-amber-100 text-amber-700 text-[11px] font-bold px-1.5 py-0.5 rounded-full">
                      {pendentes.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setReservaTab('CONFIRMADAS')}
                  className={`pb-3 font-semibold text-sm transition-colors border-b-2 flex items-center gap-2 ${
                    reservaTab === 'CONFIRMADAS'
                      ? 'border-emerald-500 text-emerald-600'
                      : 'border-transparent text-slate-400 hover:text-slate-600'
                  }`}
                >
                  <CheckCircle2 size={15} /> Confirmadas ({confirmadas.length})
                </button>
              </div>

              {loadingReservas ? (
                <div className="text-center py-12 text-slate-400">Carregando reservas...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {listaReservas.map(reserva => (
                    <motion.div
                      key={reserva.id}
                      initial={{ opacity: 0, scale: 0.97 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-slate-50 border border-slate-200 p-5 rounded-xl flex flex-col hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2 text-slate-800 font-bold">
                          <MapPin size={16} className="text-blue-500 shrink-0" />
                          {reserva.local.nome}
                        </div>
                        {reserva.status === 'AGUARDANDO'  && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-xs font-semibold">Pendente</span>}
                        {reserva.status === 'CONFIRMADA'  && <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs font-semibold">Confirmada</span>}
                      </div>
                      <div className="space-y-1.5 mb-4 text-sm text-slate-600">
                        <p><span className="font-semibold text-slate-700">Solicitante:</span> {reserva.usuario.nome}</p>
                        <p className="text-xs text-slate-400">{reserva.usuario.departamento || 'Sem departamento'}</p>
                        <p><span className="font-semibold text-slate-700">Início:</span> {formatDateTime(reserva.dataInicio)}</p>
                        <p><span className="font-semibold text-slate-700">Término:</span> {formatDateTime(reserva.dataFim)}</p>
                      </div>
                      <div className="mt-auto pt-3 border-t border-slate-200">
                        <button
                          onClick={() => {
                            setEditingReserva(reserva);
                            setEditStatus(reserva.status);
                            setEditLocalId(reserva.localId);
                            setEditInicio(new Date(reserva.dataInicio).toISOString().slice(0, 16));
                            setEditFim(new Date(reserva.dataFim).toISOString().slice(0, 16));
                          }}
                          className="w-full bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
                        >
                          <Edit size={14} /> Editar Reserva
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  {listaReservas.length === 0 && (
                    <div className="col-span-full text-center py-12 text-slate-400 text-sm">
                      Nenhuma reserva encontrada nesta aba.
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Modal Edição de Reserva ─────────────────────────────────────────── */}
      <AnimatePresence>
        {editingReserva && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-6 rounded-2xl w-full max-w-md shadow-2xl relative"
            >
              <button onClick={() => setEditingReserva(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={22} />
              </button>
              <h3 className="text-lg font-bold text-slate-800 mb-5 flex items-center gap-2">
                <Edit size={18} className="text-blue-500" /> Editar Reserva
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Local</label>
                  <select
                    value={editLocalId}
                    onChange={e => setEditLocalId(e.target.value)}
                    className="w-full border border-slate-200 text-slate-800 rounded-xl p-3 focus:outline-none focus:border-blue-500 bg-slate-50"
                  >
                    {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                    className="w-full border border-slate-200 text-slate-800 rounded-xl p-3 focus:outline-none focus:border-blue-500 bg-slate-50"
                  >
                    <option value="AGUARDANDO">Aguardando Aprovação</option>
                    <option value="CONFIRMADA">Confirmada</option>
                    <option value="CANCELADA">Cancelada (Recusar)</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Início</label>
                    <input
                      type="datetime-local"
                      value={editInicio}
                      onChange={e => setEditInicio(e.target.value)}
                      className="w-full border border-slate-200 text-slate-800 rounded-xl p-3 focus:outline-none focus:border-blue-500 bg-slate-50 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Término</label>
                    <input
                      type="datetime-local"
                      value={editFim}
                      onChange={e => setEditFim(e.target.value)}
                      className="w-full border border-slate-200 text-slate-800 rounded-xl p-3 focus:outline-none focus:border-blue-500 bg-slate-50 text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={handleSalvarEdicao}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-colors mt-1"
                >
                  <Save size={16} /> Salvar Alterações
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
