import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Plus, ShieldAlert, Image as ImageIcon, MapPin, Edit2, Trash2, X } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';

export default function AdminLocais() {
  const [locais, setLocais] = useState<any[]>([]);
  const [nome, setNome] = useState('');
  const [capacidade, setCapacidade] = useState('');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const { token, user } = useAuth();

  const carregarLocais = () => {
    fetch(api('/locais'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(setLocais)
      .catch(console.error);
  };

  useEffect(() => {
    if (token && user?.role === 'ADMIN') carregarLocais();
  }, [token, user]);

  const handleEditClick = (local: any) => {
    setEditingId(local.id);
    setNome(local.nome);
    setCapacidade(local.capacidade.toString());
    setFotoFile(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setNome('');
    setCapacidade('');
    setFotoFile(null);
  };

  const handleExcluir = (id: string) => {
    toast.warning('Deseja realmente excluir este local?', {
      action: {
        label: 'Excluir',
        onClick: async () => {
          try {
            const res = await fetch(api(`/locais/${id}`), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              toast.success('Local excluído com sucesso');
              carregarLocais();
            } else {
              const errorData = await res.json();
              toast.error(errorData.error || 'Erro ao excluir local');
            }
          } catch {
            toast.error('Erro de conexão ao excluir local');
          }
        }
      }
    });
  };

  const handleCriar = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);
    try {
      let fotoUrl = undefined;

      if (fotoFile) {
        const formData = new FormData();
        formData.append('file', fotoFile);
        const uploadRes = await fetch(api('/upload'), {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData
        });
        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          fotoUrl = uploadData.url;
        }
      }

      const method = editingId ? 'PUT' : 'POST';
      const url = editingId ? api(`/locais/${editingId}`) : api('/locais');

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nome, capacidade: Number(capacidade), fotoUrl })
      });
      
      if (res.ok) {
        toast.success(editingId ? 'Local atualizado com sucesso!' : 'Local cadastrado com sucesso!');
        cancelEdit();
        carregarLocais();
      } else {
        const err = await res.json();
        toast.error(editingId ? `Erro ao atualizar local: ${err.error || err.details || ''}` : 'Erro ao criar local');
      }
    } catch {
      toast.error('Erro de conexão ao salvar local');
    } finally {
      setIsUploading(false);
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto space-y-8">
      
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Locais</h1>
          <p className="text-slate-500 mt-1">Gerencie auditórios, salas e espaços disponíveis para reserva.</p>
        </div>
        <div className="bg-teal-50 text-teal-600 p-3 rounded-xl">
          <MapPin size={24} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleCriar} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4">
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editingId ? 'Editar Local' : 'Novo Local'}</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Foto do Espaço</label>
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center cursor-pointer hover:bg-slate-50 transition-colors relative overflow-hidden">
                <input type="file" accept="image/*" onChange={e => setFotoFile(e.target.files?.[0] || null)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
                {fotoFile ? (
                   <span className="text-sm font-medium text-blue-600 flex items-center justify-center gap-2">
                     <ImageIcon size={16}/> {fotoFile.name}
                   </span>
                ) : (
                  <span className="text-sm text-slate-500 flex flex-col items-center gap-1">
                    <ImageIcon size={20} className="text-slate-400"/>
                    Clique ou arraste uma foto
                  </span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Local</label>
              <input required value={nome} onChange={e => setNome(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm px-4 py-2" placeholder="Ex: Auditório Principal" />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Capacidade (Pessoas)</label>
              <input required type="number" value={capacidade} onChange={e => setCapacidade(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm px-4 py-2" placeholder="Ex: 150" />
            </div>

            <div className="flex gap-2 mt-4">
              <button disabled={isUploading} type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2">
                {isUploading ? 'Salvando...' : (editingId ? <><Edit2 size={20} /> Atualizar</> : <><Plus size={20} /> Cadastrar</>)}
              </button>
              {editingId && (
                <button type="button" onClick={cancelEdit} disabled={isUploading} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium rounded-xl transition-colors flex items-center justify-center">
                  <X size={20} />
                </button>
              )}
            </div>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {locais.map((local) => (
              <div key={local.id} className="group bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-md hover:border-slate-200 transition-all duration-200">
                <div className="h-44 bg-slate-100 relative overflow-hidden">
                  {local.fotoUrl ? (
                    <img src={local.fotoUrl.startsWith('/uploads') ? api(local.fotoUrl) : local.fotoUrl} alt={local.nome} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-slate-300">
                      <ImageIcon size={48} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                </div>
                <div className="p-4 relative flex-1">
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={() => handleEditClick(local)} className="p-1.5 bg-white/80 backdrop-blur-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors shadow-sm">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => handleExcluir(local.id)} className="p-1.5 bg-white/80 backdrop-blur-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors shadow-sm">
                      <Trash2 size={16} />
                    </button>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg pr-20 leading-tight">{local.nome}</h3>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="bg-teal-50 text-teal-700 text-xs font-semibold px-2.5 py-1 rounded-full border border-teal-100">
                      {local.capacidade} pessoas
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {locais.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200">
                <MapPin size={32} className="mx-auto mb-2 text-slate-300" />
                Nenhum local cadastrado ainda.
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
