/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars, react-hooks/exhaustive-deps */
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar as CalendarIcon, MapPin, Package, Clock, X, Minus, Plus, Image as ImageIcon, PlusIcon, ChevronLeft, ChevronRight, Wrench, Play, Square } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from "@/components/ui/button";


import { api } from '../lib/api';
import { toast } from 'sonner';

interface Local {
  id: string;
  nome: string;
  capacidade: number;
  fotoUrl: string | null;
}

interface Equipamento {
  id: string;
  nome: string;
  codigoPatrimonio: string;
  categoriaId: string;
  tipoId: string;
  fotoUrl: string | null;
}

interface Categoria {
  id: string;
  nome: string;
}

interface EqGroup {
  nome: string;
  fotoUrl: string | null;
  categoriaId: string;
  idsDisponiveis: string[];
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  departamento: string;
  whatsapp?: string;
}

interface ItemRequisicao {
  equipamento?: {
    nome: string;
    categoriaId: string;
  };
}

interface Requisicao {
  id: string;
  status: string;
  solicitanteNome: string;
  departamento: string;
  dataInicioEvento: string;
  dataFimEvento: string;
  localId?: string;
  local?: { nome: string };
  itens?: ItemRequisicao[];
  usuarioCor?: string;
  usuario?: {
    nome: string;
    departamento: string;
    corPersonalizada?: string;
  };
}

interface ReservaLocal {
  id: string;
  status: string;
  dataInicio: string;
  dataFim: string;
  localId: string;
  local?: { nome: string };
  usuarioCor?: string;
  usuario?: {
    nome: string;
    departamento: string;
    corPersonalizada?: string;
  };
}


const SplitDateTimeField = ({ 
  label, icon: Icon, value, onChange, required = false, themeClass, textClass, bgClass, borderClass 
}: any) => {
  const [date, setDate] = useState(value ? value.split('T')[0] : '');
  const [time, setTime] = useState(value && value.includes('T') ? value.split('T')[1].substring(0, 5) : '');

  useEffect(() => {
    if (value && value.includes('T')) {
      setDate(value.split('T')[0]);
      setTime(value.split('T')[1].substring(0, 5));
    } else {
      setDate('');
      setTime('');
    }
  }, [value]);

  const handleDateChange = (newDate: string) => {
    setDate(newDate);
    if (newDate && time) onChange(`${newDate}T${time}`);
    else if (newDate) onChange(`${newDate}T00:00`);
    else onChange('');
  };

  const handleTimeChange = (newTime: string) => {
    setTime(newTime);
    if (date && newTime) onChange(`${date}T${newTime}`);
    else if (newTime) {
      const today = new Date().toISOString().split('T')[0];
      onChange(`${today}T${newTime}`);
      setDate(today);
    }
    else onChange('');
  };

  return (
    <div className={`p-4 rounded-xl border ${bgClass} ${borderClass}`}>
      <label className={`block text-sm font-bold mb-3 flex items-center gap-2 ${textClass}`}>
        <Icon size={18}/> {label}
      </label>
      <div className="flex flex-col gap-2">
        <div className="w-full">
          <div className={`text-xs font-semibold mb-1 ${textClass} opacity-80`}>Data</div>
          <input 
            type="date" 
            required={required}
            value={date} 
            onClick={(e) => { try { e.currentTarget.showPicker() } catch(err){} }}
            onChange={e => handleDateChange(e.target.value)} 
            className={`w-full rounded-lg border-white/60 shadow-sm focus:ring-2 cursor-pointer bg-white/90 text-slate-800 py-2 px-2 text-sm ${themeClass}`} 
          />
        </div>
        <div className="w-full">
          <div className={`text-xs font-semibold mb-1 ${textClass} opacity-80`}>Horário</div>
          <input 
            type="time" 
            required={required}
            value={time} 
            onClick={(e) => { try { e.currentTarget.showPicker() } catch(err){} }}
            onChange={e => handleTimeChange(e.target.value)} 
            className={`w-full rounded-lg border-white/60 shadow-sm focus:ring-2 cursor-pointer bg-white/90 text-slate-800 py-2 px-2 text-sm ${themeClass}`} 
          />
        </div>
      </div>
    </div>
  );
};

export default function CalendarioSolicitacoes() {

  const { token, user } = useAuth();
  
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [showModal, setShowModal] = useState(false);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [viewingEvent, setViewingEvent] = useState<any>(null);
  
  const [locais, setLocais] = useState<Local[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);

  const [eqGroups, setEqGroups] = useState<EqGroup[]>([]);
  const [todasRequisicoes, setTodasRequisicoes] = useState<Requisicao[]>([]);
  const [todasReservas, setTodasReservas] = useState<ReservaLocal[]>([]);
  
  // Form fields
  const [localId, setLocalId] = useState<string>('');
  const [carrinho, setCarrinho] = useState<Record<string, number>>({}); // nome -> quantidade
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);
  const [materialNecessario, setMaterialNecessario] = useState('');
  
  // Dados do Solicitante
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [targetUserId, setTargetUserId] = useState<string>(''); // '' = selecionando, 'SELF' = próprio, 'EXTERNAL' = externo, uuid = usuario
  const [extNome, setExtNome] = useState('');
  const [extDepto, setExtDepto] = useState('');
  const [solicitanteWhatsapp, setSolicitanteWhatsapp] = useState('');
  
  const [horarioOrganizacao, setHorarioOrganizacao] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('');
  const [horarioTermino, setHorarioTermino] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const formatForDatetimeLocal = (d: Date, hours: number) => {
    const nd = new Date(d);
    nd.setHours(hours, 0, 0, 0);
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${nd.getFullYear()}-${pad(nd.getMonth()+1)}-${pad(nd.getDate())}T${pad(nd.getHours())}:${pad(nd.getMinutes())}`;
  };

  useEffect(() => {
    if (showModal) {
      if (dateRange?.from) {
        setHorarioOrganizacao(formatForDatetimeLocal(dateRange.from, 8));
        setHorarioInicio(formatForDatetimeLocal(dateRange.from, 9));
        const toDate = dateRange.to || dateRange.from;
        setHorarioTermino(formatForDatetimeLocal(toDate, 12));
      } else {
        const now = new Date();
        setHorarioOrganizacao(formatForDatetimeLocal(now, 8));
        setHorarioInicio(formatForDatetimeLocal(now, 9));
        setHorarioTermino(formatForDatetimeLocal(now, 12));
      }
    }
  }, [showModal, dateRange]);

  const carregarTodasRequisicoes = React.useCallback(() => {
    if (token) {
      fetch(api('/requisicoes'), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setTodasRequisicoes)
        .catch(console.error);
    }
  }, [token]);

  const calendarDays = React.useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const start = new Date(year, month, 1 - firstDay);
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentMonth]);

  const eventosDoMes = React.useMemo(() => {
    if (calendarDays.length === 0) return [];
    
    const start = calendarDays[0];
    const end = new Date(calendarDays[calendarDays.length - 1]);
    start.setHours(0,0,0,0);
    end.setHours(23,59,59,999);

    const checkOverlap = (evStart: string|Date, evEnd: string|Date) => {
      const eS = new Date(evStart).getTime();
      const eE = new Date(evEnd).getTime();
      return eS <= end.getTime() && eE >= start.getTime();
    };

    const eventosFormatados: any[] = [];
    const localReservaSet = new Set();

    todasRequisicoes.forEach(req => {
      if (['CANCELADO', 'DEVOLVIDO', 'RECUSADO'].includes(req.status)) return;
      if (checkOverlap(req.dataInicioEvento, req.dataFimEvento)) {
        if (req.localId) {
          localReservaSet.add(`${req.localId}-${new Date(req.dataInicioEvento).getTime()}`);
        }
        
        const allowedCategories = new Set(categorias.map(c => c.id));
        const filteredItens = (req.itens || []).filter((i: any) => i.equipamento?.categoriaId && allowedCategories.has(i.equipamento.categoriaId));
        
        if (filteredItens.length === 0 && !req.localId) return;

        eventosFormatados.push({
          id: req.id,
          tipo: 'REQUISICAO',
          status: req.status,
          solicitante: req.solicitanteNome,
          departamento: req.departamento,
          usuarioCor: req.usuario?.corPersonalizada,
          inicio: new Date(req.dataInicioEvento),
          fim: new Date(req.dataFimEvento),
          local: req.local?.nome,
          localId: req.localId,
          itens: filteredItens.map((i: any) => i.equipamento?.nome).join(', '),
          rawItens: filteredItens
        });
      }
    });

    todasReservas.forEach(res => {
      if (res.status !== 'CONFIRMADA') return;
      const ch = `${res.localId}-${new Date(res.dataInicio).getTime()}`;
      if (localReservaSet.has(ch)) return; 

      if (checkOverlap(res.dataInicio, res.dataFim)) {
        eventosFormatados.push({
          id: res.id,
          tipo: 'RESERVA_LOCAL',
          status: res.status,
          solicitante: res.usuario?.nome || 'Usuário',
          departamento: res.usuario?.departamento,
          usuarioCor: res.usuario?.corPersonalizada,
          inicio: new Date(res.dataInicio),
          fim: new Date(res.dataFim),
          local: res.local?.nome,
          localId: res.localId,
          itens: null,
          rawItens: []
        });
      }
    });

    return eventosFormatados.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  }, [calendarDays, todasRequisicoes, todasReservas, categorias]);

  useEffect(() => {
    if (token) {
      if (user?.role === 'ADMIN' || user?.role === 'ESTOQUISTA') {
        fetch(api('/auth/users'), { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setUsuarios(data);
          })
          .catch(console.error);
      }

      fetch(api('/locais'), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setLocais)
        .catch(console.error);

      fetch(api('/categorias'), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setCategorias)
        .catch(console.error);
        
      carregarTodasRequisicoes();

      fetch(api('/reservas-locais'), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(setTodasReservas)
        .catch(console.error);
        
      fetch(api('/equipamentos'), { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          const disponiveis = data.filter((e: Equipamento & { statusCondicao: string }) => e.statusCondicao !== 'COM_DEFEITO');
          
          const groups: Record<string, EqGroup> = {};
          disponiveis.forEach((eq: Equipamento) => {
            if (!groups[eq.nome]) {
              groups[eq.nome] = {
                nome: eq.nome,
                fotoUrl: eq.fotoUrl,
                categoriaId: eq.categoriaId,
                idsDisponiveis: []
              };
            }
            groups[eq.nome].idsDisponiveis.push(eq.id);
          });
          setEqGroups(Object.values(groups));
        })
        .catch(console.error);
    }
  }, [token, user?.role, carregarTodasRequisicoes]);

  const handleUpdateCarrinho = (nome: string, delta: number, max: number) => {
    setCarrinho(prev => {
      const current = prev[nome] || 0;
      const next = current + delta;
      if (next < 0 || next > max) return prev;
      const copy = { ...prev };
      copy[nome] = next;
      if (next === 0) delete copy[nome];
      return copy;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);

    const orgDate = horarioOrganizacao ? new Date(horarioOrganizacao) : new Date(horarioInicio);
    const inicioDate = new Date(horarioInicio);
    const terminoDate = new Date(horarioTermino);

    // Converter carrinho em IDs
    const equipamentosIds: string[] = [];
    Object.keys(carrinho).forEach(nome => {
      const qtd = carrinho[nome];
      const group = eqGroups.find(g => g.nome === nome);
      if (group) {
        // Pega os primeiros 'qtd' IDs disponíveis
        const ids = group.idsDisponiveis.slice(0, qtd);
        equipamentosIds.push(...ids);
      }
    });

    if ((user?.role === 'ADMIN' || user?.role === 'ESTOQUISTA') && !targetUserId) {
      setLoading(false);
      return toast.error('Selecione para quem é esta solicitação.');
    }

    if (targetUserId === 'EXTERNAL' && (!extNome || !extDepto)) {
      setLoading(false);
      return toast.error('Preencha Nome e Departamento para a solicitação externa.');
    }

    const targetUserObj = usuarios.find(u => u.id === targetUserId);
    const finalNome = targetUserId === 'EXTERNAL' ? extNome : (targetUserObj ? targetUserObj.nome : user?.nome);
    const finalEmail = targetUserId === 'EXTERNAL' ? undefined : (targetUserObj ? targetUserObj.email : user?.email);
    const finalDepto = targetUserId === 'EXTERNAL' ? extDepto : (targetUserObj ? targetUserObj.departamento : user?.departamento);
    const finalTargetUserId = (targetUserId === 'SELF' || targetUserId === 'EXTERNAL' || targetUserId === '') ? undefined : targetUserId;

    try {
      const res = await fetch(api('/requisicoes'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          localId: localId || undefined,
          equipamentosIds,
          materialNecessario,
          horarioOrganizacao: orgDate.toISOString(),
          dataInicioEvento: inicioDate.toISOString(),
          dataFimEvento: terminoDate.toISOString(),
          dataRetiradaSugerida: orgDate.toISOString(),
          solicitanteNome: finalNome,
          solicitanteEmail: finalEmail,
          solicitanteWhatsapp,
          departamento: finalDepto,
          targetUserId: finalTargetUserId
        })
      });

      if (res.ok) {
        const jsonRes = await res.json();
        setSucesso(true);
        setShowModal(false);
        carregarTodasRequisicoes();
        if (jsonRes.warning) {
          toast.error(jsonRes.warning, { duration: 10000 });
        } else {
          toast.success('Solicitação enviada com sucesso!');
        }
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao realizar solicitação. O local pode já estar reservado.');
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  if (sucesso) {
    setTimeout(() => {
      setSucesso(false);
      setLocalId('');
      setCarrinho({});
      setMaterialNecessario('');
      setTargetUserId('');
      setExtNome('');
      setExtDepto('');
      setSolicitanteWhatsapp('');
    }, 100);
  }
  // Calcula os eventos e reservas que ocorrem no dateRange selecionado
  const eventosDoDia = React.useMemo(() => {
    if (!dateRange?.from) return [];
    
    const start = new Date(dateRange.from);
    start.setHours(0,0,0,0);
    
    const end = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
    end.setHours(23,59,59,999);

    const checkOverlap = (evStart: string|Date, evEnd: string|Date) => {
      const eS = new Date(evStart).getTime();
      const eE = new Date(evEnd).getTime();
      return eS <= end.getTime() && eE >= start.getTime();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventosFormatados: any[] = [];
    const localReservaSet = new Set(); // Para evitar duplicidade de reservas vs requisicoes

    todasRequisicoes.forEach(req => {
      if (['CANCELADO', 'DEVOLVIDO', 'RECUSADO'].includes(req.status)) return;
      if (checkOverlap(req.dataInicioEvento, req.dataFimEvento)) {
        if (req.localId) {
          // Usa uma chave simples para tentar deduzir se a reserva local é originada daqui
          localReservaSet.add(`${req.localId}-${new Date(req.dataInicioEvento).getTime()}`);
        }
        
        // Filtrar itens de acordo com as categorias visíveis para o usuário atual
        const allowedCategories = new Set(categorias.map(c => c.id));
        const filteredItens = (req.itens || []).filter((i: ItemRequisicao) => i.equipamento?.categoriaId && allowedCategories.has(i.equipamento.categoriaId));
        
        // Se a requisição não tem itens visíveis e não tem local, omitir do calendário
        if (filteredItens.length === 0 && !req.localId) return;

        eventosFormatados.push({
          id: req.id,
          tipo: 'REQUISICAO',
          status: req.status,
          solicitante: req.solicitanteNome,
          departamento: req.departamento,
          usuarioCor: req.usuario?.corPersonalizada,
          inicio: new Date(req.dataInicioEvento),
          fim: new Date(req.dataFimEvento),
          local: req.local?.nome,
          localId: req.localId,
          itens: filteredItens.map((i: ItemRequisicao) => i.equipamento?.nome).join(', '),
          rawItens: filteredItens
        });
      }
    });

    // Processar Reservas Locais
    todasReservas.forEach(res => {
      if (res.status !== 'CONFIRMADA') return;
      const ch = `${res.localId}-${new Date(res.dataInicio).getTime()}`;
      if (localReservaSet.has(ch)) return; // Provavelmente já adicionado via Requisicao

      if (checkOverlap(res.dataInicio, res.dataFim)) {
        eventosFormatados.push({
          id: res.id,
          tipo: 'RESERVA_LOCAL',
          status: res.status,
          solicitante: res.usuario?.nome || 'Usuário',
          departamento: res.usuario?.departamento,
          usuarioCor: res.usuario?.corPersonalizada,
          inicio: new Date(res.dataInicio),
          fim: new Date(res.dataFim),
          local: res.local?.nome,
          localId: res.localId,
          itens: null,
          rawItens: []
        });
      }
    });

    return eventosFormatados.sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
  }, [dateRange, todasRequisicoes, todasReservas]);

  const getLocalAviso = (lId: string) => {
    const evs = eventosDoDia.filter(e => e.localId === lId);
    if (evs.length === 0) return null;
    return 'Ocupado ' + evs.map(e => `${e.inicio.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} às ${e.fim.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`).join(' | ');
  };

  const getEquipamentoAviso = (groupNome: string, totalCount: number) => {
    const evs = eventosDoDia.filter(e => e.rawItens?.some((i:ItemRequisicao) => i.equipamento?.nome === groupNome));
    if (evs.length === 0) return null;
    
    let maxBusy = 0;
    evs.forEach(e => {
       const count = e.rawItens.filter((i:ItemRequisicao) => i.equipamento?.nome === groupNome).length;
       if (count > maxBusy) maxBusy = count;
    });

    if (maxBusy >= totalCount) {
       return `Esgotado ` + evs.map(e => `${e.inicio.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} às ${e.fim.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`).join(' | ');
    } else if (maxBusy > 0) {
       return `${maxBusy} em uso ` + evs.map(e => `${e.inicio.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})} às ${e.fim.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`).join(' | ');
    }
    return null;
  };

  // Contagem de itens no carrinho
  const totalItensCarrinho = Object.values(carrinho).reduce((acc, curr) => acc + curr, 0);

  // Helper de cor por status
  const getEventColor = (status: string) => {
    switch(status) {
      case 'PENDENTE': return 'bg-amber-100 text-amber-800';
      case 'AGUARDANDO_SEPARACAO': return 'bg-sky-100 text-sky-800';
      case 'EM_SEPARACAO': return 'bg-indigo-100 text-indigo-800';
      case 'AGUARDANDO_ACEITE':
      case 'AGUARDANDO_DEVOLUCAO': return 'bg-purple-100 text-purple-800';
      case 'EMPRESTADO': return 'bg-emerald-100 text-emerald-800';
      case 'DEVOLVIDO': return 'bg-slate-100 text-slate-800';
      case 'CANCELADO':
      case 'RECUSADO': return 'bg-rose-100 text-rose-800';
      case 'CONFIRMADA': return 'bg-blue-100 text-blue-800'; // Reservas Locais
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  // Agrupa eventos por data formatada
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-6">
      
      {/* Header do Calendário */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 p-2 rounded-xl"><CalendarIcon size={24} /></div>
          <div>
            <h1 className="text-xl font-bold text-slate-800 capitalize">
              {currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setCurrentMonth(new Date())}>Hoje</Button>
          <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="p-1 hover:bg-white rounded transition-colors"><ChevronLeft size={20}/></button>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="p-1 hover:bg-white rounded transition-colors"><ChevronRight size={20}/></button>
          </div>
          <Button onClick={() => { setDateRange(undefined); setShowModal(true); }} className="bg-slate-900 text-white rounded-xl h-10 px-4 ml-4 hover:bg-slate-800">
            <PlusIcon size={18} className="mr-2" /> Solicitar Evento
          </Button>
        </div>
      </div>

      {/* Grade Mensal */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
            <div key={d} className="py-3 text-center text-sm font-bold text-slate-500 uppercase tracking-wide">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr bg-slate-200 gap-px">
          {calendarDays.map((date, idx) => {
            const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
            const isToday = date.toDateString() === new Date().toDateString();
            
            const dayEvents = eventosDoMes.filter(ev => {
              const eS = ev.inicio.getTime();
              const eE = ev.fim.getTime();
              const dS = new Date(date).setHours(0,0,0,0);
              const dE = new Date(date).setHours(23,59,59,999);
              return eS <= dE && eE >= dS;
            });

            return (
              <div key={idx} 
                className={`min-h-[120px] bg-white p-1 flex flex-col transition-colors hover:bg-slate-50 cursor-pointer ${!isCurrentMonth ? 'opacity-50 bg-slate-50' : ''}`}
                onClick={() => {
                  setDateRange({ from: date, to: date });
                  setShowModal(true);
                }}
              >
                <div className="flex justify-center mb-1 mt-1">
                  <div className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-blue-600 text-white' : 'text-slate-700'}`}>
                    {date.getDate()}
                  </div>
                </div>
                <div className="flex flex-col gap-1 overflow-y-auto max-h-[80px] scrollbar-thin px-0.5">
                  {dayEvents.slice(0, 4).map((ev, i) => (
                    <div key={`${ev.id}-${i}`}
                      onClick={(e) => { e.stopPropagation(); setViewingEvent(ev); }}
                      className={`text-[10px] font-semibold px-1.5 py-1 rounded truncate shadow-sm hover:brightness-95 transition-all ${ev.usuarioCor ? '' : getEventColor(ev.status)}`}
                      style={ev.usuarioCor ? { backgroundColor: ev.usuarioCor, color: '#fff' } : undefined}
                      title={`${ev.solicitante} - ${ev.inicio.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})}`}
                    >
                      {ev.inicio.toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})} {ev.solicitante.split(' ')[0]}
                    </div>
                  ))}
                  {dayEvents.length > 4 && (
                    <div className="text-[10px] text-slate-500 font-bold px-1 text-center hover:text-slate-700 transition-colors">+{dayEvents.length - 4} mais</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {showModal && dateRange?.from && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }} className="bg-slate-50 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden">
              
              <div className="bg-white border-b border-slate-200 p-6 flex justify-between items-center z-10 shrink-0">
                <div>
                  <h2 className="text-xl font-bold text-slate-800">Solicitação para o Evento</h2>
                  <p className="text-slate-500 text-sm">Período: <span className="font-semibold text-blue-600">{dateRange?.from?.toLocaleDateString('pt-BR')}{dateRange?.to && dateRange.from.getTime() !== dateRange.to.getTime() ? ` até ${dateRange.to.toLocaleDateString('pt-BR')}` : ''}</span></p>
                </div>
                <div className="flex items-center gap-4">
                  {totalItensCarrinho > 0 && (
                    <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold flex items-center gap-2">
                      <Package size={18} /> {totalItensCarrinho} itens no carrinho
                    </div>
                  )}
                  <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 p-2 bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <form id="solicitacaoForm" onSubmit={handleSubmit} className="space-y-8">
                  
                  {/* 0. PARA QUEM? */}
                  {(user?.role === 'ADMIN' || user?.role === 'ESTOQUISTA') && (
                    <div className="bg-blue-50 p-6 rounded-2xl border-2 border-blue-200 shadow-sm">
                      <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">Para quem é esta solicitação? *</h3>
                      
                      <select 
                        value={targetUserId} 
                        onChange={e => {
                          setTargetUserId(e.target.value);
                          const selected = usuarios.find(u => u.id === e.target.value);
                          if (selected && selected.whatsapp) {
                            setSolicitanteWhatsapp(selected.whatsapp);
                          } else if (e.target.value === 'EXTERNAL' || e.target.value === 'SELF' || e.target.value === '') {
                            setSolicitanteWhatsapp('');
                          }
                        }}
                        className="w-full rounded-xl border-blue-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-4 bg-white mb-4 text-base font-medium text-slate-700"
                        required
                      >
                        <option value="" disabled>Selecione uma opção...</option>
                        <option value="SELF">Para mim mesmo ({user?.nome})</option>
                        <option value="EXTERNAL">Departamento / Evento Externo (Sem Login)</option>
                        <optgroup label="Usuários Cadastrados">
                          {usuarios.map(u => (
                            <option key={u.id} value={u.id}>{u.nome} ({u.departamento || 'Sem depto'})</option>
                          ))}
                        </optgroup>
                      </select>

                      {targetUserId === 'EXTERNAL' && (
                        <div className="space-y-4 bg-white p-4 border border-blue-100 rounded-xl">
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Responsável / Evento *</label>
                            <input type="text" value={extNome} onChange={e => setExtNome(e.target.value)} required placeholder="Ex: Evento de Fim de Ano" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Departamento Associado *</label>
                            <input type="text" value={extDepto} onChange={e => setExtDepto(e.target.value)} required placeholder="Ex: Marketing Externo" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp (com DDD) (Opcional)</label>
                            <input type="text" value={solicitanteWhatsapp} onChange={e => setSolicitanteWhatsapp(e.target.value)} placeholder="Ex: 11999999999" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3" />
                          </div>
                        </div>
                      )}

                      {targetUserId !== '' && targetUserId !== 'EXTERNAL' && targetUserId !== 'SELF' && (
                        <div className="bg-white p-4 border border-blue-100 rounded-xl">
                          <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp de Contato (Opcional)</label>
                          <input type="text" value={solicitanteWhatsapp} onChange={e => setSolicitanteWhatsapp(e.target.value)} placeholder="Ex: 11999999999" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3" />
                        </div>
                      )}
                    </div>
                  )}

                  {/* 1. HORÁRIOS */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Clock size={20} className="text-blue-600"/> Horários do Evento</h3>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                      <SplitDateTimeField 
                        label="Montagem (Opcional)" 
                        icon={Wrench} 
                        value={horarioOrganizacao} 
                        onChange={setHorarioOrganizacao}
                        bgClass="bg-amber-50/60" 
                        borderClass="border-amber-200"
                        textClass="text-amber-900"
                        themeClass="focus:border-amber-500 focus:ring-amber-500"
                      />
                      <SplitDateTimeField 
                        label="Início do Evento" 
                        icon={Play} 
                        required={true}
                        value={horarioInicio} 
                        onChange={setHorarioInicio}
                        bgClass="bg-emerald-50/60" 
                        borderClass="border-emerald-200"
                        textClass="text-emerald-900"
                        themeClass="focus:border-emerald-500 focus:ring-emerald-500"
                      />
                      <SplitDateTimeField 
                        label="Término do Evento" 
                        icon={Square} 
                        required={true}
                        value={horarioTermino} 
                        onChange={setHorarioTermino}
                        bgClass="bg-rose-50/60" 
                        borderClass="border-rose-200"
                        textClass="text-rose-900"
                        themeClass="focus:border-rose-500 focus:ring-rose-500"
                      />
                    </div>
                  </div>

                  {/* 2. LOCAIS (Cards) */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><MapPin size={20} className="text-emerald-600"/> Local do Evento (Opcional)</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      <div 
                        onClick={() => setLocalId('')}
                        className={`cursor-pointer rounded-xl border-2 p-4 flex items-center justify-center text-center transition-all ${!localId ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-200 bg-slate-50'}`}
                      >
                        <span className={`font-medium ${!localId ? 'text-emerald-700' : 'text-slate-500'}`}>Não reservar / Outro local</span>
                      </div>
                      {locais.map(l => {
                        const aviso = getLocalAviso(l.id);
                        return (
                          <div 
                            key={l.id}
                            onClick={() => setLocalId(l.id)}
                            className={`cursor-pointer rounded-xl border-2 overflow-hidden transition-all flex flex-col relative ${localId === l.id ? 'border-emerald-500 ring-4 ring-emerald-500/20' : 'border-slate-200 hover:border-emerald-300'}`}
                          >
                            <div className="h-24 bg-slate-100 relative">
                              {l.fotoUrl ? (
                                <img src={l.fotoUrl?.startsWith('/uploads') ? api(l.fotoUrl) : l.fotoUrl} alt={l.nome} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={32}/></div>
                              )}
                              {aviso && (
                                <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center p-2 text-center backdrop-blur-[1px]">
                                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded shadow-sm">{aviso}</span>
                                </div>
                              )}
                            </div>
                            <div className="p-3 bg-white flex flex-col justify-between flex-1">
                              <h4 className="font-bold text-slate-800 text-sm leading-tight">{l.nome}</h4>
                              <p className="text-xs text-slate-500 mt-1">Capacidade: {l.capacidade}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. EQUIPAMENTOS (Agrupados) */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Package size={20} className="text-teal-600"/> Equipamentos</h3>
                    
                    {/* Filtro de Categoria */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      <button
                        type="button"
                        onClick={() => setCategoriaSelecionada(null)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!categoriaSelecionada ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                      >
                        Todos
                      </button>
                      {categorias.map(cat => (
                        <button
                          type="button"
                          key={cat.id}
                          onClick={() => setCategoriaSelecionada(cat.id)}
                          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${categoriaSelecionada === cat.id ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                        >
                          {cat.nome}
                        </button>
                      ))}
                    </div>

                    {/* Grid de Equipamentos */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {eqGroups.filter(g => !categoriaSelecionada || g.categoriaId === categoriaSelecionada).length === 0 && (
                        <p className="text-slate-500 col-span-full py-4 text-center">Nenhum equipamento disponível nesta categoria.</p>
                      )}
                      
                      {eqGroups
                        .filter(g => !categoriaSelecionada || g.categoriaId === categoriaSelecionada)
                        .map(group => {
                          const max = group.idsDisponiveis.length;
                          const count = carrinho[group.nome] || 0;
                          const aviso = getEquipamentoAviso(group.nome, max);
                          
                          return (
                            <div key={group.nome} className={`border-2 rounded-2xl overflow-hidden flex flex-col transition-colors relative ${count > 0 ? 'border-teal-500 bg-teal-50/30' : 'border-slate-100 bg-white hover:border-teal-200'}`}>
                              <div className="h-32 bg-slate-100 relative">
                                {group.fotoUrl ? (
                                  <img 
                                    src={group.fotoUrl.startsWith('/uploads') ? api(group.fotoUrl) : group.fotoUrl} 
                                    alt={group.nome} 
                                    className="w-full h-full object-cover" 
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={40}/></div>
                                )}
                                {aviso && (
                                  <div className="absolute inset-0 bg-slate-900/60 flex items-center justify-center p-2 text-center backdrop-blur-[1px]">
                                    <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-1 rounded shadow-sm">{aviso}</span>
                                  </div>
                                )}
                                {count > 0 && (
                                  <div className="absolute top-2 right-2 bg-teal-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm shadow-md">
                                    {count}
                                  </div>
                                )}
                              </div>
                              <div className="p-4 flex flex-col flex-1">
                                <h4 className="font-bold text-slate-800 text-sm mb-1 leading-tight">{group.nome}</h4>
                                <p className="text-xs text-slate-500 mb-4">Disponível: <span className="font-bold">{max}</span></p>
                                
                                <div className="mt-auto flex items-center justify-between bg-slate-100 rounded-xl p-1">
                                  <button 
                                    type="button" 
                                    onClick={() => handleUpdateCarrinho(group.nome, -1, max)}
                                    disabled={count === 0}
                                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-white text-slate-600 shadow-sm disabled:opacity-50 disabled:shadow-none hover:bg-slate-50 transition-colors"
                                  >
                                    <Minus size={18} />
                                  </button>
                                  <span className="font-bold text-slate-800 min-w-[2rem] text-center">{count}</span>
                                  <button 
                                    type="button" 
                                    onClick={() => handleUpdateCarrinho(group.nome, 1, max)}
                                    disabled={count === max}
                                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-white text-slate-600 shadow-sm disabled:opacity-50 disabled:shadow-none hover:bg-slate-50 transition-colors"
                                  >
                                    <Plus size={18} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                      })}
                    </div>
                  </div>

                  {/* 4. OBSERVAÇÕES */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Material Necessário Adicional</label>
                    <textarea 
                      rows={3} 
                      value={materialNecessario} 
                      onChange={e => setMaterialNecessario(e.target.value)} 
                      placeholder="Descreva cadeiras, mesas, água, ou qualquer outro material que não esteja na lista de equipamentos..."
                      className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 resize-none p-4 bg-slate-50"
                    />
                  </div>

                </form>
              </div>

              <div className="bg-white border-t border-slate-200 p-6 flex justify-end gap-3 shrink-0 rounded-b-3xl">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 rounded-xl font-bold text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button type="submit" form="solicitacaoForm" disabled={loading} className="px-8 py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/30 transition-all flex items-center gap-2">
                  {loading ? 'Processando...' : 'Confirmar Solicitação'}
                </button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {viewingEvent && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
              <button onClick={() => setViewingEvent(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-2 bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
              <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2"><CalendarIcon className="text-blue-600"/> Detalhes do Evento</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">Solicitante</p>
                    <p className="font-bold text-slate-800">{viewingEvent.solicitante || 'N/A'}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">Departamento</p>
                    <p className="font-bold text-slate-800">{viewingEvent.departamento || 'N/A'}</p>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                  <Clock className="text-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">Período</p>
                    <p className="font-bold text-slate-800 text-sm">{viewingEvent.inicio.toLocaleString('pt-BR')} até {viewingEvent.fim.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
                {viewingEvent.local && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center gap-3">
                    <MapPin className="text-blue-500 shrink-0" />
                    <div>
                      <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">Local do Evento</p>
                      <p className="font-bold text-slate-800 text-sm">{viewingEvent.local}</p>
                    </div>
                  </div>
                )}
                {viewingEvent.itens && viewingEvent.itens.length > 0 && (
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 mb-2 font-bold uppercase tracking-wider flex items-center gap-2"><Package size={14}/> Equipamentos</p>
                    <p className="text-sm font-medium text-slate-700 leading-relaxed">{viewingEvent.itens}</p>
                  </div>
                )}
                <div className="pt-4 flex justify-end">
                  <Button onClick={() => setViewingEvent(null)} className="rounded-xl px-6 bg-slate-800 text-white hover:bg-slate-900 transition-colors">Fechar</Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
