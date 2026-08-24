import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Calendar, CheckCircle2, Clock, MapPin, Edit, Save, X } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';

export default function AdminReservas() {
  const [reservas, setReservas] = useState<any[]>([]);
  const [locais, setLocais] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'PENDENTES' | 'CONFIRMADAS'>('PENDENTES');
  
  const [editingReserva, setEditingReserva] = useState<any>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editLocalId, setEditLocalId] = useState('');
  const [editInicio, setEditInicio] = useState('');
  const [editFim, setEditFim] = useState('');

  const { token } = useAuth();

  useEffect(() => {
    carregarDados();
  }, [token]);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const res = await fetch(api('/reservas-locais'), { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (Array.isArray(data)) setReservas(data);

      const resLocais = await fetch(api('/locais'), { headers: { Authorization: `Bearer ${token}` } });
      const dataLocais = await resLocais.json();
      if (Array.isArray(dataLocais)) setLocais(dataLocais);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar reservas');
    } finally {
      setLoading(false);
    }
  };

  const handleSalvarEdicao = async () => {
    try {
      const res = await fetch(api(`/reservas-locais/${editingReserva.id}`), {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({
          status: editStatus,
          localId: editLocalId,
          dataInicio: new Date(editInicio).toISOString(),
          dataFim: new Date(editFim).toISOString()
        })
      });

      if (res.ok) {
        toast.success('Reserva atualizada com sucesso!');
        setEditingReserva(null);
        carregarDados();
      } else {
        const error = await res.json();
        toast.error(error.error || 'Erro ao atualizar reserva');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.toLocaleDateString()} às ${d.toLocaleTimeString().slice(0, 5)}`;
  };

  const pendentes = reservas.filter(r => r.status === 'AGUARDANDO');
  const confirmadas = reservas.filter(r => r.status === 'CONFIRMADA');

  const listToRender = activeTab === 'PENDENTES' ? pendentes : confirmadas;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <Calendar className="text-blue-400" size={32} />
            Gestão de Reservas de Locais
          </h2>
          <p className="text-secondary mt-1">Aprove ou edite as solicitações de espaços físicos.</p>
        </div>
      </div>

      <div className="flex border-b border-white/10 gap-6">
        <button 
          onClick={() => setActiveTab('PENDENTES')}
          className={`pb-3 font-semibold text-lg transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'PENDENTES' ? 'border-yellow-500 text-yellow-400' : 'border-transparent text-secondary hover:text-white'}`}
        >
          <Clock size={18} /> Pendentes ({pendentes.length})
        </button>
        <button 
          onClick={() => setActiveTab('CONFIRMADAS')}
          className={`pb-3 font-semibold text-lg transition-colors border-b-2 flex items-center gap-2 ${activeTab === 'CONFIRMADAS' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-secondary hover:text-white'}`}
        >
          <CheckCircle2 size={18} /> Confirmadas ({confirmadas.length})
        </button>
      </div>

      {loading ? (
        <div className="text-secondary text-center py-12">Carregando reservas...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listToRender.map((reserva) => (
            <motion.div 
              key={reserva.id}
              className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm flex flex-col hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2 text-slate-800 font-bold text-lg">
                  <MapPin size={18} className="text-blue-500" />
                  {reserva.local.nome}
                </div>
                {reserva.status === 'AGUARDANDO' && <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded-full text-xs font-semibold">Pendente</span>}
                {reserva.status === 'CONFIRMADA' && <span className="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full text-xs font-semibold">Confirmada</span>}
              </div>

              <div className="space-y-2 mb-6">
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Solicitante:</span> {reserva.usuario.nome} ({reserva.usuario.departamento || 'Sem depto'})
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Início:</span> {formatDateTime(reserva.dataInicio)}
                </div>
                <div className="text-sm text-slate-600">
                  <span className="font-semibold text-slate-800">Término:</span> {formatDateTime(reserva.dataFim)}
                </div>
              </div>

              <div className="mt-auto pt-4 border-t border-slate-100 flex gap-2">
                <button
                  onClick={() => {
                    setEditingReserva(reserva);
                    setEditStatus(reserva.status);
                    setEditLocalId(reserva.localId);
                    setEditInicio(new Date(reserva.dataInicio).toISOString().slice(0, 16));
                    setEditFim(new Date(reserva.dataFim).toISOString().slice(0, 16));
                  }}
                  className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  <Edit size={16} /> Editar
                </button>
              </div>
            </motion.div>
          ))}
          {listToRender.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-2xl border border-slate-200">
              Nenhuma reserva encontrada nesta aba.
            </div>
          )}
        </div>
      )}

      {/* Modal Edição */}
      {editingReserva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-slate-900/50 backdrop-blur-sm">
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-6 rounded-3xl w-full max-w-md shadow-2xl relative">
            <button onClick={() => setEditingReserva(null)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"><X size={24}/></button>
            <h3 className="text-xl font-bold text-slate-800 mb-4">Editar Reserva</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-600 mb-1">Local</label>
                <select value={editLocalId} onChange={e => setEditLocalId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 focus:outline-none focus:border-blue-500">
                  {locais.map(l => <option key={l.id} value={l.id}>{l.nome}</option>)}
                </select>
              </div>
              
              <div>
                <label className="block text-sm text-slate-600 mb-1">Status</label>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 focus:outline-none focus:border-blue-500">
                  <option value="AGUARDANDO">Aguardando Aprovação</option>
                  <option value="CONFIRMADA">Confirmada</option>
                  <option value="CANCELADA">Cancelada (Recusar)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Início</label>
                <input type="datetime-local" value={editInicio} onChange={e => setEditInicio(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="block text-sm text-slate-600 mb-1">Término</label>
                <input type="datetime-local" value={editFim} onChange={e => setEditFim(e.target.value)} className="w-full bg-slate-50 border border-slate-200 text-slate-800 rounded-xl p-3 focus:outline-none focus:border-blue-500" />
              </div>

              <button onClick={handleSalvarEdicao} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 mt-2">
                <Save size={18} /> Salvar Alterações
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
