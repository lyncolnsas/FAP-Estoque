import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, Link } from 'react-router-dom';
import { Package, AlertOctagon, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';

export default function InfoEquipamento() {
  const { codigo } = useParams();
  const [equipamento, setEquipamento] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    fetch(api(`/equipamentos/${codigo}/info`))
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setEquipamento(data);
        setLoading(false);
      })
      .catch(() => {
        setErro(true);
        setLoading(false);
      });
  }, [codigo]);

  if (loading) {
    return <div className="text-center mt-20">Carregando informações...</div>;
  }

  if (erro || !equipamento) {
    return (
      <div className="max-w-md mx-auto mt-20 bg-white p-8 rounded-3xl shadow-sm border border-slate-100 text-center">
        <AlertOctagon size={48} className="mx-auto text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-slate-800">Equipamento não encontrado</h2>
        <p className="text-slate-500 mt-2">O código {codigo} não consta no nosso acervo.</p>
        <Link to="/" className="inline-block mt-6 text-blue-600 font-medium">Voltar ao Início</Link>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-xl mx-auto space-y-6">
      
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="h-48 bg-slate-100 relative">
          {equipamento.fotoUrl ? (
            <img src={equipamento.fotoUrl.startsWith('/uploads') ? api(equipamento.fotoUrl) : equipamento.fotoUrl} alt={equipamento.nome} className="w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
              <Package size={48} className="mb-2 opacity-50" />
              <span className="text-sm font-medium">Sem foto</span>
            </div>
          )}
        </div>

        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">{equipamento.nome}</h1>
              <p className="text-slate-500 font-mono text-sm mt-1">Patrimônio: {equipamento.codigoPatrimonio}</p>
            </div>
            
            {equipamento.statusCondicao === 'DISPONIVEL' && <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-emerald-100 text-emerald-800"><CheckCircle2 size={16} className="mr-1"/> Disponível</span>}
            {equipamento.statusCondicao === 'EMPRESTADO' && <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-amber-100 text-amber-800">Em Uso</span>}
            {equipamento.statusCondicao === 'COM_DEFEITO' && <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-red-100 text-red-800"><AlertOctagon size={16} className="mr-1"/> Com Defeito</span>}
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Categoria:</span>
              <span className="font-medium text-slate-800">{equipamento.categoria}</span>
            </div>
            {equipamento.ItemRequisicao && equipamento.ItemRequisicao.length > 0 && equipamento.statusCondicao === 'EMPRESTADO' && (
              <div className="flex justify-between text-sm border-t border-slate-200 pt-3">
                <span className="text-slate-500">Com quem:</span>
                <span className="font-medium text-slate-800 text-right">
                  {equipamento.ItemRequisicao[0].requisicao.solicitanteNome}<br/>
                  <span className="text-xs text-slate-500">({equipamento.ItemRequisicao[0].requisicao.departamento})</span>
                </span>
              </div>
            )}
            
            {equipamento.statusCondicao === 'COM_DEFEITO' && equipamento.historicoAvarias && equipamento.historicoAvarias.length > 0 && (
              <div className="mt-4 border-t border-slate-200 pt-4">
                <h3 className="text-sm font-bold text-red-800 flex items-center gap-2 mb-2">
                  <AlertOctagon size={16} /> Defeitos Registrados:
                </h3>
                <ul className="space-y-2">
                  {equipamento.historicoAvarias.map((avaria: any) => (
                    <li key={avaria.id} className="bg-red-50 p-3 rounded-lg border border-red-100 text-sm">
                      <strong className="text-red-900 block">{avaria.tipoAvaria ? avaria.tipoAvaria.nome : 'Avaria Geral'}</strong>
                      {avaria.descricao && <span className="text-red-700 mt-1 block">{avaria.descricao}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>

    </motion.div>
  );
}
