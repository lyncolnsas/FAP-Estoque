/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback, useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, CheckCircle2, Clock, Truck, ShieldAlert, ScanLine, Send, X, MapPin, Package, XCircle, Search } from 'lucide-react';
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
  historicoAvarias?: any[];
  isReservaLocalOnly?: boolean;
}

export interface GroupedItem {
  nome: string;
  total: number;
  avariasCount: number;
}

export function groupItems(itens?: ItemRequisicao[], historicoAvarias?: any[]): GroupedItem[] {
  if (!itens || itens.length === 0) return [];
  const map = new Map<string, GroupedItem>();

  itens.forEach(it => {
    const nome = it.equipamento?.nome || 'Equipamento';
    if (!map.has(nome)) {
      map.set(nome, { nome, total: 0, avariasCount: 0 });
    }
    const grp = map.get(nome)!;
    grp.total += 1;

    const hasAvaria = (historicoAvarias && historicoAvarias.some((h: any) => h.equipamentoId === (it as any).equipamentoId && !h.resolvido)) ||
      (it as any).observacao?.toLowerCase()?.includes('avaria') ||
      (it as any).observacao?.toLowerCase()?.includes('defeito') ||
      (it as any).observacao?.toLowerCase()?.includes('faltante');

    if (hasAvaria) {
      grp.avariasCount += 1;
    }
  });

  return Array.from(map.values());
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
      
      const endpointLocais = isSetor ? '/reservas-locais/me' : '/reservas-locais';
      const resLocais = await fetch(api(endpointLocais), { headers: { Authorization: `Bearer ${token}` } });
      const locaisData = await resLocais.json();
      
      if (Array.isArray(locaisData)) {
        const locaisMapped = locaisData.map((l: { id?: string; status: string; criadoEm?: string; dataInicio: string; dataFim: string; usuarioId?: string; usuario?: { nome: string; departamento?: string }; solicitanteNome?: string; departamento?: string; local?: { nome: string } }) => ({
           id: l.id || String(Math.random()),
           status: l.status,
           criadoEm: l.criadoEm || l.dataInicio,
           solicitanteNome: l.usuario?.nome || l.solicitanteNome || (isSetor ? user?.nome : 'Solicitante'),
           usuarioId: l.usuarioId,
           local: l.local,
           departamento: l.usuario?.departamento || l.departamento || 'Reserva de Espaço',
           itens: [],
           isReservaLocalOnly: true,
           dataInicioEvento: l.dataInicio,
           dataFimEvento: l.dataFim,
        }));
        
        mergedData = [...mergedData, ...locaisMapped].sort((a: RequisicaoDashboard, b: RequisicaoDashboard) => new Date(b.criadoEm || b.dataInicioEvento || 0).getTime() - new Date(a.criadoEm || a.dataInicioEvento || 0).getTime());
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
  const emprestados = requisicoes.filter(r => ['EMPRESTADO', 'AGUARDANDO_DEVOLUCAO', 'AGUARDANDO_ACEITE'].includes(r.status));
  const finalizados = requisicoes.filter(r => ['DEVOLVIDO', 'CANCELADO', 'RECUSADO', 'CANCELADA', 'RECUSADA'].includes(r.status));

  let adminListToRender: RequisicaoDashboard[] = [];
  if (activeTab === 'ANALISE' || activeTab === 'LIBERACAO') adminListToRender = aguardando;
  else if (activeTab === 'SEPARACAO') adminListToRender = paraSeparar;
  else if (activeTab === 'EMPRESTADOS' || activeTab === 'DEVOLUCAO') adminListToRender = emprestados;
  else if (activeTab === 'FINALIZADOS') adminListToRender = finalizados;

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

  const [searchQuery, setSearchQuery] = useState('');

  const getInitials = (name: string) => {
    if (!name) return 'US';
    const parts = name.trim().split(' ').filter(p => p.length > 0);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return name.slice(0, 2).toUpperCase();
  };

  const getAvatarGradient = (name: string) => {
    const gradients = [
      'from-blue-600 to-indigo-600',
      'from-teal-600 to-emerald-600',
      'from-violet-600 to-purple-600',
      'from-cyan-600 to-blue-600',
      'from-amber-500 to-orange-600',
      'from-rose-500 to-pink-600'
    ];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = (name || '').charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  interface UserGroup {
    id: string;
    nome: string;
    departamento: string;
    whatsapp?: string;
    fotoUrl?: string;
    requisicoes: RequisicaoDashboard[];
    totalEquipamentos: number;
    totalAvarias: number;
    locaisNomes: string[];
    itensConsolidados: { nome: string; total: number; avariasCount: number }[];
    statusCounts: Record<string, number>;
  }

  const [viewingUserGroup, setViewingUserGroup] = useState<UserGroup | null>(null);

  const groupedSolicitantes = useMemo(() => {
    const map = new Map<string, UserGroup>();

    listToRender.forEach(req => {
      const rawName = req.solicitanteNome?.trim() || 'Usuário';
      // Agrupamento estrito por nome normalizado para garantir 1 único card por solicitante
      const key = rawName.toLowerCase().replace(/\s+/g, ' ');
      const depto = req.departamento || 'Geral';
      const wa = (req as any).solicitanteWhatsapp || (req as any).usuario?.whatsapp;
      const foto = (req as any).usuario?.fotoUrl;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          nome: rawName,
          departamento: depto,
          whatsapp: wa,
          fotoUrl: foto,
          requisicoes: [],
          totalEquipamentos: 0,
          totalAvarias: 0,
          locaisNomes: [],
          itensConsolidados: [],
          statusCounts: {}
        });
      }

      const group = map.get(key)!;
      group.requisicoes.push(req);
      if (!group.whatsapp && wa) group.whatsapp = wa;
      if (!group.fotoUrl && foto) group.fotoUrl = foto;
      if (group.departamento === 'Geral' && depto !== 'Geral') group.departamento = depto;

      // Consolidação de itens e avarias
      if (req.itens && req.itens.length > 0) {
        group.totalEquipamentos += req.itens.length;
        const grp = groupItems(req.itens, req.historicoAvarias);
        grp.forEach(g => {
          group.totalAvarias += g.avariasCount;
          const existing = group.itensConsolidados.find(it => it.nome.toLowerCase() === g.nome.toLowerCase());
          if (existing) {
            existing.total += g.total;
            existing.avariasCount += g.avariasCount;
          } else {
            group.itensConsolidados.push({ ...g });
          }
        });
      }

      // Locais reservados
      if (req.local?.nome && !group.locaisNomes.includes(req.local.nome)) {
        group.locaisNomes.push(req.local.nome);
      }

      // Status
      group.statusCounts[req.status] = (group.statusCounts[req.status] || 0) + 1;
    });

    let groups = Array.from(map.values()).sort((a, b) => b.requisicoes.length - a.requisicoes.length);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      groups = groups.filter(g => 
        g.nome.toLowerCase().includes(q) || 
        g.departamento.toLowerCase().includes(q) ||
        (g.whatsapp && g.whatsapp.includes(q)) ||
        g.locaisNomes.some(l => l.toLowerCase().includes(q)) ||
        g.itensConsolidados.some(it => it.nome.toLowerCase().includes(q)) ||
        g.requisicoes.some(r => r.id.toLowerCase().includes(q))
      );
    }

    return groups;
  }, [listToRender, searchQuery]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-7xl mx-auto space-y-6"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-800 tracking-tight">{isSetor ? 'Minhas Solicitações' : 'Painel de Estoque'}</h2>
          <p className="text-slate-500 mt-1">{isSetor ? 'Acompanhe seus pedidos e eventos organizados.' : 'Gerencie e inicie empréstimos ou devoluções agrupados por solicitante.'}</p>
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

      {/* ABAS DE NAVEGAÇÃO E CAMPO DE PESQUISA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-2">
        <div className="flex overflow-x-auto gap-6 no-scrollbar">
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
              <button onClick={() => setActiveTab('EMPRESTADOS')} className={`pb-3 whitespace-nowrap font-semibold text-lg transition-colors border-b-2 ${activeTab === 'EMPRESTADOS' || activeTab === 'DEVOLUCAO' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Emprestados / Em Uso ({emprestados.length})</button>
              <button onClick={() => setActiveTab('FINALIZADOS')} className={`pb-3 whitespace-nowrap font-semibold text-lg transition-colors border-b-2 ${activeTab === 'FINALIZADOS' ? 'border-slate-500 text-slate-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>Devolvidos ({finalizados.length})</button>
            </>
          )}
        </div>

        <div className="relative min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Filtrar usuário ou item..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-slate-500 text-center py-12">Carregando dados...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
          <AnimatePresence mode="popLayout">
            {groupedSolicitantes.map((group: UserGroup) => {
              const gradient = getAvatarGradient(group.nome);
              const initials = getInitials(group.nome);

              return (
                <motion.div 
                  key={group.id} layout 
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} 
                  className="bg-white border border-slate-200/90 rounded-3xl shadow-sm hover:shadow-md transition-all overflow-hidden flex flex-col justify-between"
                >
                  {/* CABEÇALHO DO SOLICITANTE (1 CARD POR SOLICITANTE) */}
                  <div className="p-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {group.fotoUrl ? (
                          <img 
                            src={group.fotoUrl.startsWith('http') ? group.fotoUrl : api(group.fotoUrl)} 
                            alt={group.nome}
                            className="w-12 h-12 rounded-2xl object-cover border border-slate-200 shadow-sm shrink-0" 
                          />
                        ) : (
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${gradient} text-white font-bold flex items-center justify-center text-base shadow-sm shrink-0`}>
                            {initials}
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="text-lg font-bold text-slate-800 truncate" title={group.nome}>
                            {group.nome}
                          </h3>
                          <p className="text-xs font-semibold text-slate-500 truncate" title={group.departamento}>
                            {group.departamento}
                          </p>
                        </div>
                      </div>

                      <span className="bg-teal-50 text-teal-700 text-xs font-bold px-2.5 py-1 rounded-full border border-teal-200/70 shrink-0">
                        {group.requisicoes.length} {group.requisicoes.length === 1 ? 'Pedido' : 'Pedidos'}
                      </span>
                    </div>

                    {/* MÉTRICAS CONSOLIDADAS DO SOLICITANTE */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50/90 border border-slate-200/70 p-2 rounded-xl flex items-center gap-2">
                        <Package size={16} className="text-emerald-600 shrink-0"/>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Materiais</p>
                          <p className="font-bold text-slate-700">{group.totalEquipamentos} {group.totalEquipamentos === 1 ? 'item' : 'itens'}</p>
                        </div>
                      </div>

                      <div className="bg-slate-50/90 border border-slate-200/70 p-2 rounded-xl flex items-center gap-2">
                        <MapPin size={16} className="text-blue-600 shrink-0"/>
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">Espaços</p>
                          <p className="font-bold text-slate-700 truncate">
                            {group.locaisNomes.length > 0 ? group.locaisNomes.join(', ') : 'Nenhum'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* ALERTA DE AVARIAS SE HOUVER */}
                    {group.totalAvarias > 0 && (
                      <div className="mt-2.5 bg-red-50 text-red-700 text-xs font-bold px-3 py-1.5 rounded-xl border border-red-200 flex items-center gap-1.5">
                        <ShieldAlert size={14} className="text-red-500 shrink-0"/>
                        <span>⚠️ {group.totalAvarias} {group.totalAvarias === 1 ? 'avaria reportada' : 'avarias reportadas'}</span>
                      </div>
                    )}
                  </div>

                  {/* PRÉVIA DOS MATERIAIS SOLICITADOS */}
                  <div className="p-4 space-y-2">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resumo de Materiais</p>
                    {group.itensConsolidados.length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Reserva exclusiva de espaço físico.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {group.itensConsolidados.slice(0, 4).map(it => (
                          <span key={it.nome} className="bg-slate-100/90 border border-slate-200 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-medium">
                            {it.nome} <strong className="text-slate-900 font-bold">×{it.total}</strong>
                            {it.avariasCount > 0 && <span className="text-red-600 font-bold ml-1">({it.avariasCount} avaria)</span>}
                          </span>
                        ))}
                        {group.itensConsolidados.length > 4 && (
                          <span className="text-xs text-slate-400 self-center font-medium">+{group.itensConsolidados.length - 4} outros</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BOTÃO PARA ABRIR O HISTÓRICO COMPLETO */}
                  <div className="p-4 pt-0">
                    <button 
                      onClick={() => setViewingUserGroup(group)} 
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
                    >
                      <span>Ver Histórico e Pedidos ({group.requisicoes.length})</span>
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {groupedSolicitantes.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-3xl border border-slate-200 shadow-sm">
              Nenhuma solicitação encontrada para os filtros selecionados.
            </div>
          )}
        </div>
      )}

      {/* MODAL DE HISTÓRICO COMPLETO DO SOLICITANTE */}
      <AnimatePresence>
        {viewingUserGroup && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl max-h-[90vh] shadow-2xl overflow-hidden flex flex-col relative"
            >
              {/* CABEÇALHO DO MODAL */}
              <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-tr ${getAvatarGradient(viewingUserGroup.nome)} text-white font-bold flex items-center justify-center text-lg shadow-sm`}>
                    {getInitials(viewingUserGroup.nome)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{viewingUserGroup.nome}</h3>
                    <p className="text-xs font-semibold text-slate-500">{viewingUserGroup.departamento} • {viewingUserGroup.requisicoes.length} {viewingUserGroup.requisicoes.length === 1 ? 'Pedido no total' : 'Pedidos no total'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setViewingUserGroup(null)} 
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X size={22}/>
                </button>
              </div>

              {/* LISTA CRONOLÓGICA DAS REQUISIÇÕES DO SOLICITANTE */}
              <div className="p-6 overflow-y-auto space-y-4 max-h-[60vh] custom-scrollbar bg-slate-50/50">
                {viewingUserGroup.requisicoes.map((req) => {
                  const badge = getStatusBadge(req.status);
                  const isEmprestadoAtivo = ['EMPRESTADO', 'AGUARDANDO_DEVOLUCAO', 'AGUARDANDO_ACEITE'].includes(req.status);
                  const shortId = req?.id?.toString()?.split('-')[0]?.toUpperCase() || 'REQ';

                  return (
                    <div 
                      key={req.id} 
                      className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col gap-3"
                    >
                      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-500 font-mono text-xs font-bold bg-slate-100 px-2 py-0.5 rounded-md">
                            ID: {shortId}
                          </span>
                          {req.criadoEm && (
                            <span className="text-xs text-slate-400">
                              {new Date(req.criadoEm).toLocaleDateString('pt-BR')} às {new Date(req.criadoEm).toLocaleTimeString('pt-BR').slice(0, 5)}
                            </span>
                          )}
                        </div>
                        <div>{badge}</div>
                      </div>

                      {/* LOCAL / ESPAÇO */}
                      {req.local && (
                        <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1 rounded-xl text-xs font-bold border border-blue-200/70 w-fit">
                          <MapPin size={13} className="text-blue-600"/>
                          <span>Espaço: {req.local.nome}</span>
                        </div>
                      )}

                      {/* MATERIAIS AGRUPADOS */}
                      {req.itens && req.itens.length > 0 && (() => {
                        const grouped = groupItems(req.itens, req.historicoAvarias);
                        const totalAvarias = grouped.reduce((acc, g) => acc + g.avariasCount, 0);

                        return (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-slate-700 flex items-center gap-1.5">
                                <Package size={14} className="text-emerald-600"/> {req.itens.length} {req.itens.length === 1 ? 'Material' : 'Materiais'}:
                              </span>
                              {totalAvarias > 0 && (
                                <span className="text-[11px] bg-red-50 text-red-600 font-bold px-2 py-0.5 rounded-full border border-red-200">
                                  ⚠️ {totalAvarias} com avaria
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {grouped.map(g => (
                                <span key={g.nome} className="bg-slate-50 border border-slate-200 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-700">
                                  {g.nome} <strong className="text-slate-900">×{g.total}</strong>
                                  {g.avariasCount > 0 && <span className="text-red-600 font-bold ml-1">({g.avariasCount} avaria)</span>}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })()}

                      {/* AÇÕES */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2">
                        <button 
                          onClick={() => { setViewingUserGroup(null); setViewingReq(req); }} 
                          className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-1.5 px-3 rounded-lg text-xs transition-colors"
                        >
                          Ver Detalhes
                        </button>

                        {!isSetor && ['PENDENTE', 'AGUARDANDO_SEPARACAO', 'EM_SEPARACAO'].includes(req.status) && (
                          <>
                            <button 
                              onClick={() => { setViewingUserGroup(null); navigate(`/scanner?req=${req.id}&modo=SEPARACAO`); }} 
                              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 shadow-sm transition-all"
                            >
                              <ScanLine size={13}/> Bipar
                            </button>
                            <button 
                              onClick={() => handleEntregarManualmente(req.id)} 
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 shadow-sm transition-all"
                            >
                              <CheckCircle2 size={13}/> Entregar
                            </button>
                          </>
                        )}

                        {!isSetor && isEmprestadoAtivo && (
                          <>
                            <button 
                              onClick={() => { setViewingUserGroup(null); navigate(`/scanner?req=${req.id}&modo=DEVOLUCAO`); }} 
                              className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 shadow-sm transition-all"
                            >
                              <ScanLine size={13}/> Bipar Devolução
                            </button>
                            <button 
                              onClick={() => handleDevolverManualmente(req.id)} 
                              className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 shadow-sm transition-all"
                            >
                              <CheckCircle2 size={13}/> Receber
                            </button>
                          </>
                        )}

                        {isSetor && ['AGUARDANDO_ACEITE', 'AGUARDANDO_DEVOLUCAO'].includes(req.status) && (
                          <button 
                            onClick={() => handleConfirmarRecebimento(req.id)} 
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1 shadow-sm transition-all"
                          >
                            <CheckCircle2 size={13}/> Recebido
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RODAPÉ DO MODAL */}
              <div className="p-4 border-t border-slate-100 bg-white flex justify-end">
                <button 
                  onClick={() => setViewingUserGroup(null)} 
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 px-5 rounded-xl text-xs"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                {viewingReq.itens && viewingReq.itens.length > 0 && (() => {
                  const grouped = groupItems(viewingReq.itens, viewingReq.historicoAvarias);
                  return (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-bold text-slate-700 flex items-center gap-2">
                          <Package size={16} className="text-teal-600"/> Materiais Solicitados ({viewingReq.itens.length} total)
                        </p>
                      </div>
                      <ul className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {grouped.map(g => (
                          <li key={g.nome} className="text-sm font-medium text-slate-700 bg-white p-2.5 rounded-xl border border-slate-200 flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-800">{g.nome}</span>
                              <span className="text-xs bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded-full border border-teal-200">
                                {g.total} {g.total === 1 ? 'unidade' : 'unidades'}
                              </span>
                            </div>
                            {g.avariasCount > 0 ? (
                              <span className="text-xs bg-red-50 text-red-700 font-bold px-2.5 py-0.5 rounded-full border border-red-200">
                                ⚠️ {g.avariasCount} {g.avariasCount === 1 ? 'avaria' : 'avarias'}
                              </span>
                            ) : (
                              <span className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-full border border-emerald-100">
                                100% OK
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
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
                  {!isSetor && ['EMPRESTADO', 'AGUARDANDO_DEVOLUCAO', 'AGUARDANDO_ACEITE'].includes(viewingReq.status) && (
                    <>
                      <button 
                        onClick={() => navigate(`/scanner?req=${viewingReq.id}&modo=DEVOLUCAO`)} 
                        className="flex-1 basis-[45%] bg-teal-600 hover:bg-teal-700 text-white font-bold py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <ScanLine size={18}/> Bipar Devolução
                      </button>
                      <button 
                        onClick={() => handleDevolverManualmente(viewingReq.id)} 
                        className="flex-1 basis-[45%] bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 text-sm rounded-xl flex items-center justify-center gap-2 whitespace-nowrap"
                      >
                        <CheckCircle2 size={18}/> Receber
                      </button>
                    </>
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
