import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Check, ShieldAlert, FileSignature } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { toast } from 'sonner';

export default function TelaAceite() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    fetch(api(`/requisicoes/aceite/${token}`))
      .then(res => {
        if (!res.ok) throw new Error('Token inválido ou expirado');
        return res.json();
      })
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  const handleAceite = async () => {
    try {
      const res = await fetch(api(`/requisicoes/aceite/${token}`), { method: 'POST' });
      if (res.ok) {
        setAccepted(true);
        toast.success('Termo aceito com sucesso!');
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || 'Erro ao confirmar aceite');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    }
  };

  if (loading) return (
    <div className="flex justify-center p-12">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (error) return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center p-8 text-red-400 font-medium bg-red-500/10 rounded-xl max-w-md mx-auto border border-red-500/20">
      {error}
    </motion.div>
  );

  if (accepted) {
    return (
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-surface backdrop-blur-xl rounded-2xl shadow-2xl p-8 max-w-lg mx-auto text-center border-t-4 border-accent"
      >
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
          className="w-20 h-20 bg-accent/20 text-accent rounded-full flex items-center justify-center mx-auto mb-6 border border-accent/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]"
        >
          <Check size={40} />
        </motion.div>
        <h2 className="text-3xl font-bold mb-3 text-white">Termo Aceito!</h2>
        <p className="text-secondary text-lg">O empréstimo foi liberado com sucesso. Você já pode retirar os equipamentos no estoque.</p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-surface backdrop-blur-xl rounded-2xl shadow-2xl p-6 md:p-8 max-w-2xl mx-auto border border-white/10"
    >
      <div className="flex items-center gap-4 mb-8 border-b border-white/10 pb-6">
        <div className="p-3 bg-primary/20 rounded-xl border border-primary/30">
          <FileSignature className="text-primary" size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Termo de Responsabilidade</h2>
          <p className="text-secondary text-sm">Assinatura Digital de Retirada</p>
        </div>
      </div>

      <div className="space-y-6 text-gray-300 mb-8">
        <div className="bg-background/50 p-5 rounded-xl border border-white/5">
          <p className="mb-2">Olá, <strong className="text-white">{data?.solicitanteNome}</strong>,</p>
          <p>Você está solicitando a retirada dos equipamentos abaixo para o evento em <strong className="text-white">{data?.localEvento}</strong>.</p>
        </div>
        
        <div className="bg-background/30 border border-white/10 rounded-xl overflow-hidden shadow-inner">
          <div className="bg-white/5 px-4 py-3 border-b border-white/10 font-semibold text-white flex justify-between">
            <span>Lista de Materiais</span>
            <span className="text-primary">{data?.itens?.length} itens</span>
          </div>
          <ul className="divide-y divide-white/5">
            {data?.itens?.map((item: any) => (
              <li key={item.id} className="p-4 hover:bg-white/5 transition-colors flex justify-between items-center">
                <div className="flex items-center gap-3">
                  {item.equipamento.fotoUrl ? (
                    <img 
                      src={item.equipamento.fotoUrl.startsWith('/uploads') ? api(item.equipamento.fotoUrl) : item.equipamento.fotoUrl} 
                      alt={item.equipamento.nome} 
                      className="w-12 h-12 object-cover rounded-lg bg-white/5" 
                    />
                  ) : (
                    <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center text-white/30 text-xl">
                      📦
                    </div>
                  )}
                  <div>
                    <div className="font-medium text-white">{item.equipamento.nome}</div>
                    <div className="text-xs text-secondary font-mono mt-1">{item.equipamento.codigoPatrimonio}</div>
                  </div>
                </div>
                {item.equipamento.statusCondicao === 'COM_AVARIA' && (
                  <span className="text-xs bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 px-3 py-1 rounded-full font-medium flex items-center gap-1">
                    <ShieldAlert size={12}/> Avaria
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="text-sm bg-primary/10 border border-primary/20 text-primary-light p-5 rounded-xl leading-relaxed flex gap-3 items-start">
          <ShieldAlert className="shrink-0 mt-0.5 text-primary" size={18} />
          <p>Declaro que conferi os equipamentos descritos acima e me responsabilizo pela integridade e devolução dos mesmos no prazo estipulado sob as penas do regimento interno.</p>
        </div>
      </div>

      <motion.button 
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleAceite}
        className="w-full bg-gradient-to-r from-accent to-emerald-600 hover:from-emerald-600 hover:to-accent text-white font-bold py-4 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all flex items-center justify-center gap-3 text-lg"
      >
        <Check size={24} /> Confirmar e Aceitar Empréstimo
      </motion.button>
    </motion.div>
  );
}
