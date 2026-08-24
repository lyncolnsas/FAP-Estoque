/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2, Clock, Truck, ShieldAlert, ScanLine, Send, X, MapPin, Package, XCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';

interface Usuario {
  id: string;
  nome: string;
  departamento: string;
}

interface ItemRequisicao {
  id: string;
  equipamento?: { nome: string };
}

interface RequisicaoDashboard {
  id: string;
  status: string;
  solicitanteNome?: string;
  departamento?: string;
  usuarioId?: string;
  criadoEm?: string;
  dataInicioEvento?: string;
  dataFimEvento?: string;
  local?: { nome: string };
  itens?: ItemRequisicao[];
  isReservaLocalOnly?: boolean;
}

export default function Dashboard() {
  const [requisicoes, setRequisicoes] = useState<RequisicaoDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const { token, user } = useAuth();
  
  const isSetor = user?.role === 'SETOR';
  const [activeTab, setActiveTab] = useState<string>(isSetor ? 'SETOR_ANALISE' : 'ANALISE');
  const [viewingReq, setViewingReq] = useState<RequisicaoDashboard | null>(null);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [targetUserId, setTargetUserId] = useState('');
  const [creatingReq, setCreatingReq] = useState(false);
  const [extNome, setExtNome] = useState('');
  const [extDepto, setExtDepto] = useState('');
  const [extWhatsapp, setExtWhatsapp] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    if (user && isSetor && activeTab === 'ANALISE') {
      setActiveTab('SETOR_ANALISE');
    } else if (user && !isSetor && activeTab === 'SETOR_ANALISE') {
      setActiveTab('ANALISE');
    }
  }, [user, isSetor]);

  useEffect(() => {
    if (user && isSetor && activeTab === 'ANALISE') {
      setActiveTab('SETOR_ANALISE');
    } else if (user && !isSetor && activeTab === 'SETOR_ANALISE') {
      setActiveTab('ANALISE');
    }
  }, [user, isSetor, activeTab]);

  const fetchRequisicoes = useCallback(async () => {
    setLoading(true);
    try {
      const resReqs = await fetch(api('/requisicoes'), { headers: { Authorization: `Bearer ${token}` } });
      const reqsData = await resReqs.json();
      
      let mergedData = Array.isArray(reqsData) ? reqsData : [];
      
      if (isSetor) {
        const resLocais = await fetch(api('/reservas-locais/me'), { headers: { Authorization: `Bearer ${token}` } });
        const locaisData = await resLocais.json();
        
        if (Array.isArray(locaisData)) {
          const locaisMapped = locaisData.map((l: { id?: string; status: string; criadoEm?: string; dataInicio: string; dataFim: string; usuarioId?: string; local?: { nome: string } }) => ({
             id: l.id || String(Math.random()),
             status: l.status,
             criadoEm: l.criadoEm || l.dataInicio,
             solicitanteNome: user?.nome,
             usuarioId: l.usuarioId,
             local: l.local,
             departamento: 'Reserva de Espaço',
             itens: [],
             isReservaLocalOnly: true,
             dataInicioEvento: l.dataInicio,
             dataFimEvento: l.dataFim,
          }));
          
          mergedData = [...mergedData, ...locaisMapped].sort((a: RequisicaoDashboard, b: RequisicaoDashboard) => new Date(b.criadoEm || b.dataInicioEvento || 0).getTime() - new Date(a.criadoEm || a.dataInicioEvento || 0).getTime());
        }
      }
      
      setRequisicoes(mergedData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [token, isSetor, user?.nome]);

  useEffect(() => {
    if (!token) return;
    fetchRequisicoes();
  }, [token, fetchRequisicoes]);

  const handleConfirmarRecebimento = async (reqId: string) => {
    if (!window.confirm('Confirmar o recebimento dos equipamentos?')) return;
    
    const loadingToast = toast.loading('Confirmando recebimento...');
    try {
      const res = await fetch(api(`/requisicoes/${reqId}/receber`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao confirmar');
      toast.success('Recebimento confirmado com sucesso!', { id: loadingToast });
      setViewingReq(null);
      fetchRequisicoes();
    } catch {
      toast.error('Erro ao confirmar recebimento', { id: loadingToast });
    }
  };

  const handleEntregarManualmente = async (reqId: string) => {
    if (!window.confirm('Tem certeza que deseja marcar esta requisição como entregue (sem usar o scanner)?')) return;
    
    const loadingToast = toast.loading('Entregando requisição...');
    try {
      const res = await fetch(api(`/requisicoes/${reqId}/entregar-manualmente`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao entregar manualmente');
      toast.success('Requisição entregue com sucesso!', { id: loadingToast });
      setViewingReq(null);
      fetchRequisicoes();
    } catch {
      toast.error('Erro ao entregar', { id: loadingToast });
    }
  };

  const handleCancelarRequisicao = async (reqId: string) => {
    if (!window.confirm('Tem certeza que deseja cancelar esta requisição? Esta ação não pode ser desfeita.')) return;
    
    const loadingToast = toast.loading('Cancelando...');
    try {
      const res = await fetch(api(`/requisicoes/${reqId}/cancelar`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Falha ao cancelar');
      }
      toast.success('Requisição cancelada com sucesso!', { id: loadingToast });
      setViewingReq(null);
      fetchRequisicoes();
    } catch (e: unknown) {
      const err = e as Error;
      toast.error(err.message || 'Erro ao cancelar', { id: loadingToast });
    }
  };

  const openLiberarModal = async () => {
    setIsModalOpen(true);
    if (usuarios.length === 0) {
      try {
        const res = await fetch(api('/auth/users'), { headers: { Authorization: 'Bearer ' + token } });
        const data = await res.json();
        if (Array.isArray(data)) setUsuarios(data);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const handleCreateInstantLoan = async () => {
    if (targetUserId !== 'EXTERNAL' && !targetUserId) return toast.error('Selecione um solicitante');
    if (targetUserId === 'EXTERNAL' && (!extNome || !extDepto)) return toast.error('Preencha os campos Nome e Departamento');
    
    setCreatingReq(true);
    try {
      const res = await fetch(api('/requisicoes'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          dataInicioEvento: new Date().toISOString(),
          dataFimEvento: new Date().toISOString(),
          departamento: targetUserId === 'EXTERNAL' ? extDepto : 'Empréstimo Rápido',
          solicitanteNome: targetUserId === 'EXTERNAL' ? extNome : undefined,
          solicitanteWhatsapp: targetUserId === 'EXTERNAL' ? extWhatsapp : undefined,
          equipamentosIds: [], // blank
          targetUserId
        })
      });
      const data = await res.json();
      if (data.id) {
        toast.success('Empréstimo rápido iniciado!');
        navigate(`/scanner?req=${data.id}&modo=SEPARACAO`);
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao criar empréstimo rápido');
    } finally {
      setCreatingReq(false);
    }
  };


  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'AGUARDANDO': return <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-yellow-500/30"><Clock size={12}/> Aguardando Aprovação</span>;
      case 'CONFIRMADA': return <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-blue-500/30"><CheckCircle2 size={12}/> Local Confirmado</span>;
      case 'PENDENTE': 
      case 'AGUARDANDO_SEPARACAO': return <span className="bg-yellow-500/20 text-yellow-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-yellow-500/30"><Clock size={12}/> Pendente / Aguardando Separação</span>;
      case 'EM_SEPARACAO': return <span className="bg-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-blue-500/30"><ClipboardList size={12}/> Em Separação</span>;
      case 'AGUARDANDO_DEVOLUCAO': return <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-orange-500/30"><ShieldAlert size={12}/> Aguardando Devolução</span>;
      case 'AGUARDANDO_ACEITE': return <span className="bg-teal-500/20 text-teal-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-teal-500/30"><ShieldAlert size={12}/> Aguardando Aceite</span>;
      case 'EMPRESTADO': return <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-green-500/30"><Truck size={12}/> Emprestado</span>;
      case 'DEVOLVIDO': return <span className="bg-gray-500/20 text-gray-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-gray-500/30"><CheckCircle2 size={12}/> Devolvido</span>;
      case 'CANCELADO':
      case 'CANCELADA': return <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-red-500/30"><XCircle size={12}/> Cancelada</span>;
      case 'RECUSADO':
      case 'RECUSADA': return <span className="bg-red-500/20 text-red-400 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 border border-red-500/30"><XCircle size={12}/> Recusada</span>;
      default: return null;
    }
  };

  // Lógica para ADMIN/ESTOQUISTA
  const aguardando = requisicoes.filter(r => ['PENDENTE', 'AGUARDANDO'].includes(r.status));
  const paraSeparar = requisicoes.filter(r => ['AGUARDANDO_SEPARACAO', 'EM_SEPARACAO', 'CONFIRMADA'].includes(r.status));
  const emprestados = requisicoes.filter(r => ['EMPRESTADO', 'AGUARDANDO_ACEITE'].includes(r.status));
  const paraDevolver = requisicoes.filter(r => r.status === 'AGUARDANDO_DEVOLUCAO');

  let adminListToRender: RequisicaoDashboard[] = [];
  if (activeTab === 'ANALISE' || activeTab === 'LIBERACAO') adminListToRender = aguardando;
  else if (activeTab === 'SEPARACAO') adminListToRender = paraSeparar;
  else if (activeTab === 'EMPRESTADOS') adminListToRender = emprestados;
  else if (activeTab === 'DEVOLUCAO') adminListToRender = paraDevolver;

  // Lógica para SETOR
  const myReqs = requisicoes.filter(r => r.usuarioId === user?.id || r.solicitanteNome === user?.nome);
  let setorListToRender: RequisicaoDashboard[] = [];
  if (activeTab === 'SETOR_ANALISE') {
    setorListToRender = myReqs.filter(r => ['PENDENTE', 'AGUARDANDO'].includes(r.status));
  } else if (activeTab === 'SETOR_APROVADOS') {
    setorListToRender = myReqs.filter(r => ['AGUARDANDO_SEPARACAO', 'EM_SEPARACAO', 'CONFIRMADA'].includes(r.status));
  } else if (activeTab === 'SETOR_ANDAMENTO') {
    setorListToRender = myReqs.filter(r => ['EMPRESTADO', 'AGUARDANDO_DEVOLUCAO', 'AGUARDANDO_ACEITE'].includes(r.status));
  } else if (activeTab === 'SETOR_FINALIZADOS') {
    setorListToRender = myReqs.filter(r => ['DEVOLVIDO', 'CANCELADO', 'RECUSADO', 'CANCELADA', 'RECUSADA'].includes(r.status));
  }

  const listToRender = isSetor ? setorListToRender : adminListToRender;

  const handleDevolverManualmente = async (reqId: string) => {
    if (!window.confirm('Tem certeza que deseja marcar esta requisição como DEVOLVIDA sem bipar os itens?')) return;
    
    const loadingToast = toast.loading('Recebendo equipamentos...');
    try {
      const res = await fetch(api(`/requisicoes/${reqId}/devolver-manualmente`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Falha ao receber');
      toast.success('Equipamentos recebidos com sucesso!', { id: loadingToast });
      setViewingReq(null);
      fetchRequisicoes();
    } catch {
      toast.error('Erro ao receber equipamentos', { id: loadingToast });
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{isSetor ? 'Minhas Solicitações' : 'Painel de Estoque'}</h2>
          <p className="text-slate-500 mt-1">{isSetor ? 'Acompanhe seus pedidos e eventos.' : 'Gerencie e inicie empréstimos ou devoluções.'}</p>
        </div>
        
        {!isSetor && (
          <div className="flex gap-3">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openLiberarModal}
              className="bg-teal-600 hover:bg-teal-500 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg"
            >
              <Send size={18}/> Liberar
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/scanner?modo=DEVOLUCAO_GLOBAL')} 
              className="bg-slate-800 hover:bg-slate-900 text-white font-bold py-3 px-6 rounded-xl shadow-lg flex items-center gap-2 transition-all"
            >
              <ScanLine size={18}/> Devolver
            </motion.button>
          </div>
        )}
      </div>

      <div className="flex overflow-x-auto border-b border-slate-200 gap-6 no-scrollbar">
        {isSetor ? (
          <>
            <button onClick={() => setActiveTab('SETOR_ANALISE')} className={`pb-3 whitespace-nowrap font-semibold text-lg transition-colors border-b-2 ${activeTab === 'SETOR_ANALISE' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Em Análise</button>
            <button onClick={() => setActiveTab('SETOR_APROVADOS')} className={`pb-3 whitespace-nowrap font-semibold text-lg transition-colors border-b-2 ${activeTab === 'SETOR_APROVADOS' ? 'border-emerald-500 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Aprovados</button>
            <button onClick={() => setActiveTab('SETOR_ANDAMENTO')} className={`pb-3 whitespace-nowrap font-semibold text-lg transition-colors border-b-2 ${activeTab === 'SETOR_ANDAMENTO' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Em Andamento</button>
            <button onClick={() => setActiveTab('SETOR_FINALIZADOS')} className={`pb-3 whitespace-nowrap font-semibold text-lg transition-colors border-b-2 ${activeTab === 'SETOR_FINALIZADOS' ? 'border-slate-500 text-slate-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Finalizados</button>
          </>
        ) : (
          <>
            <button onClick={() => setActiveTab('ANALISE')} className={`pb-3 whitespace-nowrap font-semibold text-lg transition-colors border-b-2 ${activeTab === 'ANALISE' ? 'border-teal-500 text-teal-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Aguardando ({aguardando.length})</button>
            <button onClick={() => setActiveTab('SEPARACAO')} className={`pb-3 whitespace-nowrap font-semibold text-lg transition-colors border-b-2 ${activeTab === 'SEPARACAO' ? 'border-amber-500 text-amber-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Para Separar ({paraSeparar.length})</button>
            <button onClick={() => setActiveTab('EMPRESTADOS')} className={`pb-3 whitespace-nowrap font-semibold text-lg transition-colors border-b-2 ${activeTab === 'EMPRESTADOS' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Emprestados ({emprestados.length})</button>
            <button onClick={() => setActiveTab('DEVOLUCAO')} className={`pb-3 whitespace-nowrap font-semibold text-lg transition-colors border-b-2 ${activeTab === 'DEVOLUCAO' ? 'border-rose-500 text-rose-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Para Devolver ({paraDevolver.length})</button>
          </>
        )}
      </div>

      {loading ? (
        <div className="text-slate-500 text-center py-12">Carregando dados...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {listToRender.map((req) => {
              const badge = getStatusBadge(req.status);
              return (
                <motion.div 
                  key={req.id} layout 
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} 
                  className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col h-full hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setViewingReq(req)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-slate-400 text-xs font-bold mb-1">ID: {req?.id?.toString()?.split('-')[0]?.toUpperCase() || 'N/A'}</span>
                      <h3 className="text-lg font-bold text-slate-800 line-clamp-2">{req.solicitanteNome || 'Usuário'}</h3>
                      <p className="text-sm text-slate-500">{req.departamento}</p>
                    </div>
                    {badge}
                  </div>
                  <div className="space-y-3 mb-6 flex-1">
                    {req.local && (
                      <div className="flex items-center gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <MapPin size={18} className="text-blue-500"/>
                        <span className="text-sm font-medium">{req.local.nome}</span>
                      </div>
                    )}
                    {req.itens && req.itens.length > 0 && (
                      <div className="flex items-start gap-3 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <Package size={18} className="text-emerald-500 mt-0.5"/>
                        <span className="text-sm font-medium">{req.itens.length} Equipamento(s)</span>
                      </div>
                    )}
                  </div>
                  <div className="mt-auto pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setViewingReq(req); }} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2 rounded-lg text-sm font-bold min-w-[60px]">Ver</button>
                    {!isSetor && ['PENDENTE', 'AGUARDANDO_SEPARACAO', 'EM_SEPARACAO'].includes(req.status) && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); navigate(`/scanner?req=${req.id}&modo=SEPARACAO`); }} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white py-2 px-1 rounded-lg text-sm font-bold flex items-center justify-center gap-1 min-w-[80px]" title="Separar com Scanner">
                          <ScanLine size={14}/> Bipar
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleEntregarManualmente(req.id); }} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-1 rounded-lg text-sm font-bold flex items-center justify-center gap-1 min-w-[80px]" title="Entregar Imediatamente">
                          <CheckCircle2 size={14}/> Entregar
                        </button>
                      </>
                    )}
                    {!isSetor && req.status === 'EMPRESTADO' && (
                      <button onClick={(e) => { e.stopPropagation(); handleDevolverManualmente(req.id); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-1 rounded-lg text-sm font-bold flex items-center justify-center gap-1 min-w-[80px]" title="Receber (Devolução Manual)">
                        <CheckCircle2 size={14}/> Receber
                      </button>
                    )}
                    {isSetor && ['AGUARDANDO_ACEITE', 'AGUARDANDO_DEVOLUCAO'].includes(req.status) && (
                      <button onClick={(e) => { e.stopPropagation(); handleConfirmarRecebimento(req.id); }} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-1 rounded-lg text-sm font-bold flex items-center justify-center gap-1 min-w-[80px]" title="Confirmar Recebimento">
                        <CheckCircle2 size={14}/> Recebido
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {listToRender.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-200">
              Nenhuma solicitação encontrada nesta aba.
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
              <h3 className="text-xl font-bold text-slate-800 mb-2 flex items-center gap-2"><Send className="text-teal-600"/> Empréstimo Rápido</h3>
              <p className="text-slate-500 text-sm mb-6">Selecione o solicitante para iniciar a liberação.</p>
              
              <div className="flex gap-2 mb-4 p-1 bg-slate-100 rounded-xl">
                <button onClick={() => setTargetUserId('')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${targetUserId !== 'EXTERNAL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Usuário</button>
                <button onClick={() => setTargetUserId('EXTERNAL')} className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${targetUserId === 'EXTERNAL' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}>Externo</button>
              </div>

              {targetUserId !== 'EXTERNAL' ? (
                <select value={targetUserId} onChange={e => setTargetUserId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 mb-4 outline-none focus:ring-2 focus:ring-teal-500/20">
                  <option value="">Selecione um solicitante...</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome} ({u.departamento || 'Sem depto'})</option>)}
                </select>
              ) : (
                <div className="space-y-3 mb-4">
                  <input type="text" placeholder="Nome do Responsável / Evento" value={extNome} onChange={e => setExtNome(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-teal-500/20" />
                  <input type="text" placeholder="Departamento" value={extDepto} onChange={e => setExtDepto(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-teal-500/20" />
                  <input type="text" placeholder="WhatsApp (Opcional)" value={extWhatsapp} onChange={e => setExtWhatsapp(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-teal-500/20" />
                </div>
              )}

              <button onClick={handleCreateInstantLoan} disabled={creatingReq} className="w-full bg-teal-600 text-white font-bold py-3 rounded-xl">Iniciar Bipagem</button>
            </motion.div>
          </div>
        )}
        {viewingReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
              <button onClick={() => setViewingReq(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
              <h3 className="text-xl font-bold text-slate-800 mb-4">Detalhes da Solicitação</h3>
              <div className="space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                  <p className="text-sm text-slate-500 mb-1">ID</p>
                  <p className="font-mono text-slate-800 font-medium break-all">{viewingReq.id}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Solicitante</p>
                    <p className="font-bold text-slate-800">{viewingReq.solicitanteNome || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-sm text-slate-500 mb-1">Departamento</p>
                    <p className="font-bold text-slate-800">{viewingReq.departamento || 'N/A'}</p>
                  </div>
                </div>
                {viewingReq.local && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4 flex items-center gap-3">
                    <MapPin className="text-blue-500" />
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Local do Evento</p>
                      <p className="font-bold text-slate-800">{viewingReq.local.nome}</p>
                    </div>
                  </div>
                )}
                {viewingReq.itens && viewingReq.itens.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                    <p className="text-sm text-slate-500 mb-2 flex items-center gap-2"><Package size={16}/> Equipamentos ({viewingReq.itens.length})</p>
                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                      {viewingReq.itens.map((item: ItemRequisicao) => (
                        <li key={item.id} className="text-sm font-medium text-slate-700 bg-white p-2 rounded-lg border border-slate-200">
                          {item.equipamento?.nome || 'Equipamento'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 mt-6">
                  {!isSetor && ['PENDENTE', 'AGUARDANDO_SEPARACAO', 'EM_SEPARACAO'].includes(viewingReq.status) && (
                    <>
                      <button 
                        onClick={() => navigate(`/scanner?req=${viewingReq.id}&modo=SEPARACAO`)} 
                        className="flex-1 basis-[45%] bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <ScanLine size={18}/> Bipar Itens
                      </button>
                      <button 
                        onClick={() => handleEntregarManualmente(viewingReq.id)} 
                        className="flex-1 basis-[45%] bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <CheckCircle2 size={18}/> Entregar
                      </button>
                    </>
                  )}
                  {!isSetor && viewingReq.status === 'EMPRESTADO' && (
                    <button 
                      onClick={() => handleDevolverManualmente(viewingReq.id)} 
                      className="flex-1 basis-[45%] bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <CheckCircle2 size={18}/> Receber
                    </button>
                  )}
                  {isSetor && ['AGUARDANDO_ACEITE', 'AGUARDANDO_DEVOLUCAO'].includes(viewingReq.status) && (
                    <button 
                      onClick={() => handleConfirmarRecebimento(viewingReq.id)} 
                      className="flex-1 basis-[45%] bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
                    >
                      <CheckCircle2 size={18}/> Recebido
                    </button>
                  )}
                  {['PENDENTE', 'AGUARDANDO_SEPARACAO'].includes(viewingReq.status) && (
                    <button 
                      onClick={() => handleCancelarRequisicao(viewingReq.id)} 
                      className="flex-1 basis-[45%] bg-red-50 hover:bg-red-100 text-red-600 font-bold py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 border border-red-200 whitespace-nowrap"
                    >
                      <XCircle size={18}/> Cancelar
                    </button>
                  )}
                  <button onClick={() => setViewingReq(null)} className="flex-1 basis-[45%] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 text-sm rounded-xl whitespace-nowrap">
                    Fechar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
