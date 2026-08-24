import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ShieldAlert, Edit2, Trash2, CheckCircle2, X } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';

export default function AdminAvarias() {
  const [tipos, setTipos] = useState<any[]>([]);
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const { token, user } = useAuth();

  const carregarTipos = () => {
    fetch(api('/tipos-avaria'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setTipos)
      .catch(console.error);
  };

  useEffect(() => {
    if (token) carregarTipos();
  }, [token]);

  const handleEdit = (tipo: any) => {
    setEditandoId(tipo.id);
    setNome(tipo.nome);
    setDescricao(tipo.descricao || '');
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNome('');
    setDescricao('');
  };

  const handleDelete = (id: string) => {
    toast.warning('Deseja realmente excluir este tipo de avaria?', {
      action: {
        label: 'Excluir',
        onClick: async () => {
          try {
            const res = await fetch(api(`/tipos-avaria/${id}`), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              toast.success('Tipo de avaria excluído com sucesso');
              carregarTipos();
            } else {
              toast.error('Erro ao excluir tipo de avaria');
            }
          } catch {
            toast.error('Erro ao excluir tipo de avaria');
          }
        }
      }
    });
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      let res;
      if (editandoId) {
        res = await fetch(api(`/tipos-avaria/${editandoId}`), {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ nome, descricao })
        });
      } else {
        res = await fetch(api('/tipos-avaria'), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ nome, descricao })
        });
      }
      
      if (res.ok) {
        toast.success(editandoId ? 'Tipo de avaria atualizado com sucesso' : 'Tipo de avaria cadastrado com sucesso');
        cancelarEdicao();
        carregarTipos();
      } else {
        toast.error('Erro ao salvar tipo de avaria');
      }
    } catch {
      toast.error('Erro ao salvar tipo de avaria');
    } finally {
      setIsSaving(false);
    }
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="text-center mt-20 text-red-400">
        <ShieldAlert size={48} className="mx-auto mb-4" />
        <h2 className="text-2xl font-bold">Acesso Negado</h2>
        <p>Você não tem permissão de Administrador.</p>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto space-y-8">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Tipos de Avaria</h1>
          <p className="text-slate-500 mt-1">Gerencie os possíveis defeitos que podem ser reportados.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <form onSubmit={handleSalvar} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 relative">
            {editandoId && (
              <button type="button" onClick={cancelarEdicao} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            )}
            
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editandoId ? 'Editar Tipo' : 'Novo Tipo'}</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome (Resumo do Defeito)</label>
              <input required value={nome} onChange={e => setNome(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Ex: Vermelho Queimado" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Descrição Detalhada</label>
              <textarea rows={3} value={descricao} onChange={e => setDescricao(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Ex: O led vermelho do equipamento não acende..." />
            </div>

            <button disabled={isSaving} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 mt-4">
              {isSaving ? 'Salvando...' : editandoId ? <><CheckCircle2 size={20} /> Salvar</> : <><Plus size={20} /> Cadastrar</>}
            </button>
          </form>
        </div>

        <div className="md:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="hidden md:table-header-group bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Nome da Avaria</th>
                  <th className="px-6 py-4">Descrição</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 block md:table-row-group">
                {tipos.map((tipo) => (
                  <tr key={tipo.id} className="block md:table-row hover:bg-slate-50 transition-colors border-b border-slate-100 md:border-b-0">
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0"></div>
                        <span className="font-semibold text-slate-900">{tipo.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Descrição</span>
                        <span className="text-slate-500">{tipo.descricao || '-'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-t md:border-t-0 border-slate-50">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(tipo)} className="flex-1 md:flex-none flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 p-2 rounded-lg bg-blue-50 md:bg-transparent md:hover:bg-blue-50 transition-colors font-medium">
                          <Edit2 size={16} /> <span className="md:hidden text-sm">Editar</span>
                        </button>
                        <button onClick={() => handleDelete(tipo.id)} className="flex-1 md:flex-none flex items-center justify-center gap-2 text-red-600 hover:text-red-800 p-2 rounded-lg bg-red-50 md:bg-transparent md:hover:bg-red-50 transition-colors font-medium">
                          <Trash2 size={16} /> <span className="md:hidden text-sm">Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {tipos.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-6 py-12 text-center text-slate-500">Nenhum tipo de avaria cadastrado.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
