import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { Layers, Plus, Trash2, Edit2, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';

export default function AdminCategorias() {
  const { token, user } = useAuth();
  const [categorias, setCategorias] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  // Form states para Categorias
  const [novaCategoria, setNovaCategoria] = useState('');
  const [editCategoriaId, setEditCategoriaId] = useState<string | null>(null);
  const [editCategoriaNome, setEditCategoriaNome] = useState('');

  // Form states para Tipos
  const [novoTipoPorCat, setNovoTipoPorCat] = useState<{[key: string]: string}>({});
  const [editTipoId, setEditTipoId] = useState<string | null>(null);
  const [editTipoNome, setEditTipoNome] = useState('');

  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      carregarCategorias();
    }
  }, [token, user]);

  const carregarCategorias = async () => {
    try {
      const res = await fetch(api('/categorias'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setCategorias(await res.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  // ==========================================
  // AÇÕES CATEGORIA
  // ==========================================
  const handleCriarCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novaCategoria.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(api('/categorias'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome: novaCategoria })
      });
      if (res.ok) {
        toast.success('Categoria criada com sucesso!');
        setNovaCategoria('');
        carregarCategorias();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao criar categoria');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEditCategoria = async (id: string) => {
    if (!editCategoriaNome.trim()) {
      setEditCategoriaId(null);
      return;
    }
    try {
      const res = await fetch(api(`/categorias/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome: editCategoriaNome })
      });
      if (res.ok) {
        toast.success('Categoria atualizada com sucesso!');
        setEditCategoriaId(null);
        carregarCategorias();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao atualizar categoria');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    }
  };

  const handleDeleteCategoria = (id: string) => {
    toast.warning('Tem certeza? Equipamentos e tipos vinculados impedirão a exclusão.', {
      action: {
        label: 'Excluir',
        onClick: async () => {
          try {
            const res = await fetch(api(`/categorias/${id}`), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              toast.success('Categoria excluída com sucesso!');
              carregarCategorias();
            } else {
              const data = await res.json();
              toast.error(data.error || 'Erro ao excluir categoria');
            }
          } catch (e) {
            toast.error('Erro de conexão ao excluir categoria');
          }
        }
      }
    });
  };

  // ==========================================
  // AÇÕES TIPOS
  // ==========================================
  const handleCriarTipo = async (categoriaId: string) => {
    const nome = novoTipoPorCat[categoriaId];
    if (!nome?.trim()) return;
    try {
      const res = await fetch(api(`/categorias/${categoriaId}/tipos`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome })
      });
      if (res.ok) {
        toast.success('Tipo de equipamento cadastrado com sucesso!');
        setNovoTipoPorCat(prev => ({ ...prev, [categoriaId]: '' }));
        carregarCategorias();
        setExpandedCat(categoriaId); // expand if not already
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao cadastrar tipo');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    }
  };

  const handleEditTipo = async (id: string) => {
    if (!editTipoNome.trim()) {
      setEditTipoId(null);
      return;
    }
    try {
      const res = await fetch(api(`/categorias/tipos/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nome: editTipoNome })
      });
      if (res.ok) {
        toast.success('Tipo de equipamento atualizado!');
        setEditTipoId(null);
        carregarCategorias();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao editar tipo');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    }
  };

  const handleDeleteTipo = (id: string) => {
    toast.warning('Excluir este tipo de equipamento?', {
      action: {
        label: 'Excluir',
        onClick: async () => {
          try {
            const res = await fetch(api(`/categorias/tipos/${id}`), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              toast.success('Tipo de equipamento excluído!');
              carregarCategorias();
            } else {
              const data = await res.json();
              toast.error(data.error || 'Erro ao excluir tipo');
            }
          } catch (e) {
            toast.error('Erro de conexão ao excluir tipo');
          }
        }
      }
    });
  };

  if (user?.role !== 'ADMIN') return <div className="text-center mt-20 text-red-500 font-bold">Acesso Negado</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div className="flex items-center gap-3">
          <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
            <Layers size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Categorias e Tipos</h1>
            <p className="text-slate-500 mt-0.5">Gerencie a classificação do acervo de equipamentos.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Nova Categoria</h2>
        <form onSubmit={handleCriarCategoria} className="flex gap-3 mb-6">
          <input 
            type="text" 
            placeholder="Ex: Áudio, Iluminação, Vídeo..." 
            value={novaCategoria} 
            onChange={e => setNovaCategoria(e.target.value)} 
            className="flex-1 rounded-xl border-slate-200 focus:border-blue-500 focus:ring-blue-500 px-4 py-2.5 shadow-sm text-sm"
          />
          <button type="submit" disabled={loading} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl hover:bg-blue-700 flex items-center gap-2 transition-colors shadow-sm shadow-blue-500/20 font-medium text-sm whitespace-nowrap">
            <Plus size={18} /> Adicionar
          </button>
        </form>

        <div className="space-y-3">
          {categorias.map(cat => (
            <div key={cat.id} className="border border-slate-200 rounded-2xl overflow-hidden bg-slate-50/50 hover:border-slate-300 transition-colors">
              <div className="flex items-center justify-between p-4 bg-white">
                
                <div className="flex items-center gap-3 flex-1">
                  <button onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)} className="flex items-center gap-1 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-colors font-medium">
                    {expandedCat === cat.id ? <><ChevronUp size={16} /> Ocultar Tipos</> : <><ChevronDown size={16} /> Ver Tipos / Cadastrar</>}
                  </button>
                  {editCategoriaId === cat.id ? (
                    <input 
                      type="text" 
                      value={editCategoriaNome} 
                      onChange={e => setEditCategoriaNome(e.target.value)} 
                      onBlur={() => handleEditCategoria(cat.id)}
                      onKeyDown={e => e.key === 'Enter' && handleEditCategoria(cat.id)}
                      className="border-slate-300 rounded px-2 py-1 text-sm font-bold"
                      autoFocus
                    />
                  ) : (
                    <span className="font-bold text-slate-800 text-lg cursor-pointer hover:text-blue-600" onClick={() => setExpandedCat(expandedCat === cat.id ? null : cat.id)}>
                      {cat.nome}
                    </span>
                  )}
                  <span className="bg-slate-100 text-slate-500 text-xs px-2 py-1 rounded-full font-medium">{cat.tipos?.length || 0} Tipos</span>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditCategoriaId(cat.id); setEditCategoriaNome(cat.nome); }} className="p-2 text-slate-400 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 rounded-lg transition-colors">
                    <Edit2 size={16} />
                  </button>
                  <button onClick={() => handleDeleteCategoria(cat.id)} className="p-2 text-slate-400 hover:text-red-600 bg-slate-50 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {expandedCat === cat.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden border-t border-slate-200">
                    <div className="p-4 space-y-3 bg-slate-50/50">
                      
                      {/* Lista de Tipos */}
                      {cat.tipos?.map((tipo: any) => (
                        <div key={tipo.id} className="flex items-center justify-between bg-white p-3 rounded-lg border border-slate-100 shadow-sm ml-6">
                          <div className="flex items-center gap-2 flex-1">
                            <Tag size={16} className="text-slate-400" />
                            {editTipoId === tipo.id ? (
                              <input 
                                type="text" 
                                value={editTipoNome} 
                                onChange={e => setEditTipoNome(e.target.value)} 
                                onBlur={() => handleEditTipo(tipo.id)}
                                onKeyDown={e => e.key === 'Enter' && handleEditTipo(tipo.id)}
                                className="border-slate-300 rounded px-2 py-1 text-sm w-full max-w-xs"
                                autoFocus
                              />
                            ) : (
                              <span className="text-slate-700">{tipo.nome}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => { setEditTipoId(tipo.id); setEditTipoNome(tipo.nome); }} className="p-1.5 text-slate-400 hover:text-blue-600 rounded transition-colors">
                              <Edit2 size={14} />
                            </button>
                            <button onClick={() => handleDeleteTipo(tipo.id)} className="p-1.5 text-slate-400 hover:text-red-600 rounded transition-colors">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}

                      {cat.tipos?.length === 0 && (
                        <p className="text-sm text-slate-500 text-center py-2">Nenhum tipo cadastrado nesta categoria.</p>
                      )}

                      {/* Add Tipo Input */}
                      <div className="flex gap-2 ml-6 mt-2">
                        <input 
                          type="text" 
                          placeholder="Novo tipo (ex: Microfone, Refletor...)" 
                          value={novoTipoPorCat[cat.id] || ''} 
                          onChange={e => setNovoTipoPorCat({...novoTipoPorCat, [cat.id]: e.target.value})}
                          onKeyDown={e => e.key === 'Enter' && handleCriarTipo(cat.id)}
                          className="flex-1 rounded-lg border-slate-200 text-sm focus:border-blue-500 focus:ring-blue-500"
                        />
                        <button onClick={() => handleCriarTipo(cat.id)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm hover:bg-slate-300 transition-colors font-medium">
                          Adicionar
                        </button>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          ))}
          {categorias.length === 0 && !loading && (
            <div className="text-center py-10 text-slate-500">Nenhuma categoria cadastrada.</div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
