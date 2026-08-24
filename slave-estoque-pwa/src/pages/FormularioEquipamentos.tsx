import React, { useState, useEffect } from 'react';
import { Send, CheckCircle2, Package, Calendar as CalendarIcon, Minus, Plus, Image as ImageIcon } from 'lucide-react';
import { Calendar, CalendarDayButton } from '../components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';

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

export default function FormularioEquipamentos() {
  const { token, user } = useAuth();

  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [extNome, setExtNome] = useState('');
  const [extDepto, setExtDepto] = useState('');

  const [categorias, setCategorias] = useState<Categoria[]>([]);
  // @ts-ignore
  const [equipamentos, setEquipamentos] = useState<Equipamento[]>([]);
  const [eqGroups, setEqGroups] = useState<EqGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form Fields
  const [isDragging, setIsDragging] = useState(false);
  useEffect(() => { const handleUp = () => setIsDragging(false); window.addEventListener('pointerup', handleUp); return () => window.removeEventListener('pointerup', handleUp); }, []);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el) return;
    const button = el.closest('button[data-iso]');
    if (button) {
      const iso = button.getAttribute('data-iso');
      if (iso && dateRange?.from) {
        const hoverDate = new Date(iso);
        let sorted = [dateRange.from, hoverDate].sort((a, b) => a.getTime() - b.getTime());
        setDateRange({ from: sorted[0], to: sorted[1] });
      }
    }
  };

  const [solicitanteWhatsapp, setSolicitanteWhatsapp] = useState('');
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>();
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('18:00');
  const [dataRetiradaSugerida, setDataRetiradaSugerida] = useState('');

  // Cart
  const [carrinho, setCarrinho] = useState<Record<string, number>>({});
  const [categoriaSelecionada, setCategoriaSelecionada] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      if (user?.role === 'ADMIN' || user?.role === 'ESTOQUISTA') {
        fetch(api('/auth/users'), { headers: { Authorization: 'Bearer ' + token } })
          .then(res => res.json())
          .then(data => {
            if (Array.isArray(data)) setUsuarios(data);
          })
          .catch(console.error);
      }

      fetch(api('/categorias'), { headers: { Authorization: 'Bearer ' + token } })
        .then(res => res.json())
        .then(setCategorias)
        .catch(console.error);

      fetch(api('/equipamentos'), {
        headers: { Authorization: 'Bearer ' + token }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            const disponiveis = data.filter((e: any) => e.statusCondicao !== 'COM_DEFEITO' && e.permitirEmprestimo !== false);
            setEquipamentos(disponiveis);
            
            // Agrupar
            const groups: Record<string, EqGroup> = {};
            disponiveis.forEach((eq: Equipamento) => {
              if (!groups[eq.nome]) {
                groups[eq.nome] = { nome: eq.nome, fotoUrl: eq.fotoUrl, categoriaId: eq.categoriaId, idsDisponiveis: [] };
              }
              groups[eq.nome].idsDisponiveis.push(eq.id);
            });
            setEqGroups(Object.values(groups));
          }
        })
        .catch(console.error);
    }
  }, [token]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!dateRange?.from || !horaInicio || !horaFim || !dataRetiradaSugerida) {
      return toast.error('Preencha as datas e horários.');
    }
    setLoading(true);
    
    // Converter carrinho em IDs físicos
    const equipamentosIds: string[] = [];
    Object.keys(carrinho).forEach(nome => {
      const qtd = carrinho[nome];
      const group = eqGroups.find(g => g.nome === nome);
      if (group) {
        const ids = group.idsDisponiveis.slice(0, qtd);
        equipamentosIds.push(...ids);
      }
    });

    if (targetUserId === 'EXTERNAL' && (!extNome || !extDepto)) {
      setLoading(false);
      return toast.error('Preencha Nome e Departamento para a solicitação externa.');
    }

    try {
      const res = await fetch(api('/requisicoes'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
          solicitanteNome: targetUserId === 'EXTERNAL' ? extNome : (targetUserObj ? targetUserObj.nome : user?.nome),
          solicitanteEmail: targetUserId === 'EXTERNAL' ? undefined : (targetUserObj ? targetUserObj.email : user?.email),
          solicitanteWhatsapp,
          departamento: targetUserId === 'EXTERNAL' ? extDepto : (targetUserObj ? targetUserObj.departamento : user?.departamento),
          dataInicioEvento: dateRange?.from ? new Date(format(dateRange.from, 'yyyy-MM-dd') + 'T' + horaInicio + ':00').toISOString() : new Date().toISOString(),
          dataFimEvento: dateRange?.to ? new Date(format(dateRange.to, 'yyyy-MM-dd') + 'T' + horaFim + ':00').toISOString() : (dateRange?.from ? new Date(format(dateRange.from, 'yyyy-MM-dd') + 'T' + horaFim + ':00').toISOString() : new Date().toISOString()),
          dataRetiradaSugerida: new Date(dataRetiradaSugerida).toISOString(),
          equipamentosIds,
          targetUserId: targetUserId || undefined
        })
      });
      if (res.ok) {
        setSuccess(true);
        toast.success('Requisição enviada com sucesso!');
      } else {
        toast.error('Erro ao enviar requisição');
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md mx-auto mt-20 bg-white p-8 rounded-3xl shadow-xl text-center space-y-4">
        <CheckCircle2 size={64} className="text-emerald-500 mx-auto" />
        <h2 className="text-3xl font-bold text-slate-800">Requisio Enviada!</h2>
        <p className="text-slate-500">Sua solicitao de equipamentos foi registrada e o estoque notificado.</p>
        <button onClick={() => window.location.href = '/'} className="mt-6 w-full bg-slate-800 text-white font-medium py-3 rounded-xl hover:bg-slate-900 transition-colors">Voltar ao Incio</button>
      </motion.div>
    );
  }

  const totalItensCarrinho = Object.values(carrinho).reduce((acc, curr) => acc + curr, 0);
  const targetUserObj = usuarios.find(u => u.id === targetUserId);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl"><Package size={28} /></div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Solicitar Equipamentos</h1>
            <p className="text-slate-500">Adicione materiais ao seu carrinho para o evento.</p>
          </div>
        </div>
        {totalItensCarrinho > 0 && (
          <div className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full font-bold flex items-center gap-2">
            <Package size={18} /> {totalItensCarrinho} itens no carrinho
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        
        {/* DADOS SOLICITANTE */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          {(user?.role === 'ADMIN' || user?.role === 'ESTOQUISTA') && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-1">Solicitar em nome de (Opcional)</label>
              <select 
                value={targetUserId} 
                onChange={e => {
                  setTargetUserId(e.target.value);
                  const selected = usuarios.find(u => u.id === e.target.value);
                  if (selected && selected.whatsapp) {
                    setSolicitanteWhatsapp(selected.whatsapp);
                  } else if (e.target.value === 'EXTERNAL') {
                    setSolicitanteWhatsapp('');
                  }
                }}
                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3 bg-slate-50 mb-4"
              >
                <option value="">(Meu próprio usuário)</option>
                <option value="EXTERNAL">Departamento / Evento Externo (Sem Login)</option>
                <hr />
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nome} ({u.departamento || 'Sem depto'})</option>
                ))}
              </select>

              {targetUserId === 'EXTERNAL' && (
                <div className="space-y-3 mb-4 bg-slate-50 p-4 border border-slate-200 rounded-xl">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Responsável / Evento *</label>
                    <input type="text" value={extNome} onChange={e => setExtNome(e.target.value)} placeholder="Ex: Evento de Fim de Ano" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Departamento Associado *</label>
                    <input type="text" value={extDepto} onChange={e => setExtDepto(e.target.value)} placeholder="Ex: Marketing Externo" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3" />
                  </div>
                </div>
              )}
            </div>
          )}

          {targetUserId !== 'EXTERNAL' && (
            <div className="flex gap-4 items-center bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-bold">
                {targetUserObj ? targetUserObj.nome.charAt(0).toUpperCase() : (user?.nome?.charAt(0) || '?')}
              </div>
              <div>
                <p className="text-slate-800 font-medium">{targetUserObj ? targetUserObj.nome : user?.nome} <span className="text-xs text-slate-500 ml-2 font-normal">({targetUserObj ? targetUserObj.departamento : user?.departamento})</span></p>
                <p className="text-xs text-slate-500">{targetUserObj ? targetUserObj.email : user?.email}</p>
              </div>
            </div>
          )}

          <div className="pt-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp (com DDD) *</label>
            <input name="whatsapp" value={solicitanteWhatsapp} onChange={e => setSolicitanteWhatsapp(e.target.value)} required placeholder="Ex: 11999999999" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3" />
          </div>
        </div>

        {/* DATAS */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><CalendarIcon size={20}/> Datas do Evento e Retirada</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Selecione os dias do evento (arraste para selecionar)</label>
                <div className="border border-slate-200 rounded-xl p-2 inline-block touch-none" onPointerMove={handlePointerMove}>
                  <Calendar
                    mode="range"
                    selected={dateRange as any}
                    onSelect={setDateRange as any}
                    onDayMouseEnter={(day) => {
                      if (isDragging && dateRange?.from) {
                        let sorted = [dateRange.from, day].sort((a, b) => a.getTime() - b.getTime());
                        setDateRange({ from: sorted[0], to: sorted[1] });
                      }
                    }}
                    components={{
                      DayButton: (props) => (
                        <CalendarDayButton 
                          {...props} 
                          onPointerDown={() => {
                            setIsDragging(true);
                            setDateRange({ from: props.day.date, to: undefined });
                          }}
                        />
                      )
                    }}
                    className="rounded-md"
                    locale={ptBR}
                  />
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Horrio de Incio</label>
                  <input type="time" value={horaInicio} onChange={e => setHoraInicio(e.target.value)} required className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Horrio de Trmino</label>
                  <input type="time" value={horaFim} onChange={e => setHoraFim(e.target.value)} required className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data/Hora da Retirada</label>
                  <input type="datetime-local" value={dataRetiradaSugerida} onChange={e => setDataRetiradaSugerida(e.target.value)} required className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 p-3" />
                </div>
              </div>
            </div>
        </div>

        {/* CARRINHO DE EQUIPAMENTOS */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2"><Package size={20} className="text-teal-600"/> Adicionar Equipamentos</h3>
          
          {/* Categorias (Filtro) */}
          <div className="flex overflow-x-auto gap-2 pb-4 mb-4 custom-scrollbar">
            <button 
              type="button"
              onClick={() => setCategoriaSelecionada(null)}
              className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-colors text-sm ${!categoriaSelecionada ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Todas as Categorias
            </button>
            {categorias.map(cat => (
              <button 
                key={cat.id}
                type="button"
                onClick={() => setCategoriaSelecionada(cat.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap font-medium transition-colors text-sm ${categoriaSelecionada === cat.id ? 'bg-teal-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
              >
                {cat.nome}
              </button>
            ))}
          </div>

          {/* Grid de Equipamentos */}
          <div className="grid grid-cols-1 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {eqGroups.filter(g => !categoriaSelecionada || g.categoriaId === categoriaSelecionada).length === 0 && (
              <p className="text-slate-500 col-span-full py-4 text-center">Nenhum equipamento disponível nesta categoria.</p>
            )}
            
            {eqGroups
              .filter(g => !categoriaSelecionada || g.categoriaId === categoriaSelecionada)
              .map(group => {
                const max = group.idsDisponiveis.length;
                const count = carrinho[group.nome] || 0;
                
                return (
                  <div key={group.nome} className={`border-2 rounded-2xl overflow-hidden flex flex-col transition-colors ${count > 0 ? 'border-teal-500 bg-teal-50/30' : 'border-slate-100 bg-white hover:border-teal-200'}`}>
                    <div className="h-32 bg-slate-100 relative">
                      {group.fotoUrl ? (
                        <img src={group.fotoUrl?.startsWith('/uploads') ? api(group.fotoUrl) : group.fotoUrl} alt={group.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon size={40}/></div>
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

        <button 
          disabled={loading || totalItensCarrinho === 0} 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-2xl shadow-md flex items-center justify-center gap-2 transition-all text-lg"
        >
          {loading ? 'Processando...' : <><Send size={20} /> Enviar Requisição ({totalItensCarrinho} itens)</>}
        </button>
      </form>
    </motion.div>
  );
}




