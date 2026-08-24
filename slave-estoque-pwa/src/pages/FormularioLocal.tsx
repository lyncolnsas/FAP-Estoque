import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Calendar, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { toast } from 'sonner';

export default function FormularioLocal() {
  const { token } = useAuth();
  
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [locaisDisponiveis, setLocaisDisponiveis] = useState<any[]>([]);
  const [localSelecionado, setLocalSelecionado] = useState('');
  const [loading, setLoading] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  const buscarDisponibilidade = async () => {
    if (!dataInicio || !dataFim) return;
    try {
      const res = await fetch(api(`/locais/disponibilidade?inicio=${dataInicio}&fim=${dataFim}`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setLocaisDisponiveis(data);
        if (data.length === 0) setLocalSelecionado('');
      }
    } catch (error) {
      console.error('Erro ao buscar locais:', error);
    }
  };

  useEffect(() => {
    buscarDisponibilidade();
  }, [dataInicio, dataFim]);

  const handleReservar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localSelecionado) return toast.error('Selecione um local');
    
    setLoading(true);
    try {
      const res = await fetch(api('/reservas-locais'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ localId: localSelecionado, dataInicio, dataFim })
      });

      if (res.ok) {
        setSucesso(true);
        toast.success('Reserva confirmada com sucesso!');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Erro ao reservar');
      }
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setLoading(false);
    }
  };

  if (sucesso) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-md mx-auto mt-20 bg-white p-8 rounded-3xl shadow-xl text-center space-y-4">
        <CheckCircle size={64} className="text-emerald-500 mx-auto" />
        <h2 className="text-3xl font-bold text-slate-800">Local Reservado!</h2>
        <p className="text-slate-500">Sua reserva foi confirmada com sucesso para as datas solicitadas.</p>
        <button onClick={() => window.location.href = '/'} className="mt-6 w-full bg-slate-800 text-white font-medium py-3 rounded-xl hover:bg-slate-900 transition-colors">Voltar ao Início</button>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
        <div className="bg-teal-50 text-teal-600 p-3 rounded-xl"><MapPin size={28} /></div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reserva de Espaço</h1>
          <p className="text-slate-500">Consulte a disponibilidade e reserve auditórios ou salas.</p>
        </div>
      </div>

      <form onSubmit={handleReservar} className="space-y-8">
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
          <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Calendar size={20}/> 1. Escolha o Período</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data e Hora de Início</label>
              <input required type="datetime-local" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-teal-500 focus:ring-teal-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data e Hora de Término</label>
              <input required type="datetime-local" value={dataFim} onChange={e => setDataFim(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-teal-500 focus:ring-teal-500" />
            </div>
          </div>
        </div>

        {dataInicio && dataFim && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><MapPin size={20}/> 2. Locais Disponíveis</h3>
            
            {locaisDisponiveis.length === 0 ? (
              <div className="p-4 bg-amber-50 text-amber-800 rounded-xl border border-amber-100">
                Nenhum local está livre neste período. Tente alterar as datas.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {locaisDisponiveis.map(local => (
                  <div 
                    key={local.id} 
                    onClick={() => setLocalSelecionado(local.id)}
                    className={`cursor-pointer rounded-xl border-2 overflow-hidden transition-all ${localSelecionado === local.id ? 'border-teal-600 bg-teal-50/50 shadow-md ring-2 ring-teal-600 ring-offset-2' : 'border-slate-200 hover:border-teal-300'}`}
                  >
                    <div className="h-32 bg-slate-100 relative">
                      {local.fotoUrl ? (
                        <img src={local.fotoUrl?.startsWith('/uploads') ? api(local.fotoUrl) : local.fotoUrl} alt={local.nome} className="w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center text-slate-300">Sem Foto</div>
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="font-bold text-slate-800">{local.nome}</h4>
                      <p className="text-sm text-slate-500">Capacidade: {local.capacidade} pessoas</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        <button 
          type="submit" 
          disabled={loading || !localSelecionado} 
          className="w-full bg-teal-600 hover:bg-teal-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl shadow-md transition-all text-lg"
        >
          {loading ? 'Confirmando...' : 'Confirmar Reserva'}
        </button>

      </form>
    </motion.div>
  );
}
