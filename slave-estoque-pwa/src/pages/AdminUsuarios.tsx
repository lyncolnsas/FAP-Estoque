import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { 
  ShieldAlert, UserPlus, Users, Building, Edit2, Trash2, X, 
  CheckCircle2, Key, RefreshCw, UserCheck, Phone
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from 'sonner';

interface CategoriaAdmin {
  id: string;
  nome: string;
}

interface UsuarioAdmin {
  id: string;
  nome: string;
  email: string;
  departamento?: string;
  whatsapp?: string;
  fotoPerfilUrl?: string;
  corPersonalizada?: string;
  role: string;
  categoriasPermitidas?: CategoriaAdmin[];
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [tabFiltro, setTabFiltro] = useState<'TODOS' | 'SISTEMA' | 'AVULSOS'>('TODOS');
  
  // Campos do formulário
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [corPersonalizada, setCorPersonalizada] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [role, setRole] = useState('SETOR');
  const [loading, setLoading] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  // Modal de Conceder Acesso para Solicitante Avulso
  const [userParaPromover, setUserParaPromover] = useState<UsuarioAdmin | null>(null);
  const [promoteEmail, setPromoteEmail] = useState('');
  const [promoteSenha, setPromoteSenha] = useState('');
  const [promoteRole, setPromoteRole] = useState('SETOR');
  const [promoteCategorias, setPromoteCategorias] = useState<string[]>([]);
  const [promoteLoading, setPromoteLoading] = useState(false);
  
  const { token, user } = useAuth();

  const [categorias, setCategorias] = useState<CategoriaAdmin[]>([]);
  const [categoriasPermitidas, setCategoriasPermitidas] = useState<string[]>([]);
  
  const [contatosWhatsapp, setContatosWhatsapp] = useState<{name: string, number: string}[]>([]);

  const carregarContatosWhatsapp = React.useCallback(() => {
    fetch(api('/whatsapp/contacts'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setContatosWhatsapp(data);
      })
      .catch(console.error);
  }, [token]);

  const carregarUsuarios = React.useCallback(() => {
    fetch(api('/auth/users'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setUsuarios(data);
      })
      .catch(console.error);
  }, [token]);

  const carregarCategorias = React.useCallback(() => {
    fetch(api('/categorias'), {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setCategorias(data);
      })
      .catch(console.error);
  }, [token]);

  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      carregarUsuarios();
      carregarCategorias();
      carregarContatosWhatsapp();
    }
  }, [token, user, carregarUsuarios, carregarCategorias, carregarContatosWhatsapp]);

  const handleEdit = (u: UsuarioAdmin) => {
    setEditandoId(u.id);
    setNome(u.nome);
    setEmail(u.email.startsWith('avulso_') ? '' : u.email);
    setDepartamento(u.departamento || '');
    setWhatsapp(u.whatsapp || '');
    setCorPersonalizada(u.corPersonalizada || '');
    setRole(u.role);
    setSenha('');
    if (u.categoriasPermitidas) {
      setCategoriasPermitidas(u.categoriasPermitidas.map((c: CategoriaAdmin) => c.id));
    } else {
      setCategoriasPermitidas([]);
    }
  };

  const cancelarEdicao = () => {
    setEditandoId(null);
    setNome('');
    setEmail('');
    setDepartamento('');
    setWhatsapp('');
    setCorPersonalizada('');
    setRole('SETOR');
    setSenha('');
    setCategoriasPermitidas([]);
  };

  const handleCriarOuEditar = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (role === 'AVULSO' && !editandoId) {
        // Criação de solicitante avulso direto
        const res = await fetch(api('/auth/users/avulso'), {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ nome, departamento, whatsapp })
        });
        if (res.ok) {
          toast.success('Solicitante avulso cadastrado com sucesso!');
          cancelarEdicao();
          carregarUsuarios();
        } else {
          const data = await res.json();
          toast.error(data.error || 'Erro ao criar solicitante avulso');
        }
        return;
      }

      const url = editandoId ? api(`/auth/users/${editandoId}`) : api('/auth/register');
      const method = editandoId ? 'PUT' : 'POST';
      
      const payload: any = {
        nome,
        departamento,
        role,
        whatsapp,
        corPersonalizada,
        categoriasPermitidas: role === 'SETOR' ? categoriasPermitidas : undefined
      };

      if (email) payload.email = email;
      if (senha) payload.senha = senha;

      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        toast.success(editandoId ? 'Usuário atualizado com sucesso!' : 'Usuário cadastrado com sucesso!');
        cancelarEdicao();
        carregarUsuarios();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao salvar usuário');
      }
    } catch {
      toast.error('Erro de conexão ao salvar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirModalPromover = (u: UsuarioAdmin) => {
    setUserParaPromover(u);
    setPromoteEmail(u.email.startsWith('avulso_') ? '' : u.email);
    setPromoteSenha('');
    setPromoteRole('SETOR');
    setPromoteCategorias([]);
  };

  const handleConfirmarPromover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userParaPromover) return;
    setPromoteLoading(true);

    try {
      const res = await fetch(api(`/auth/users/${userParaPromover.id}/promote`), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: promoteEmail,
          senha: promoteSenha,
          role: promoteRole,
          departamento: userParaPromover.departamento,
          whatsapp: userParaPromover.whatsapp,
          categoriasPermitidas: promoteRole === 'SETOR' ? promoteCategorias : undefined
        })
      });

      if (res.ok) {
        const data = await res.json();
        toast.success(data.message || 'Acesso ao sistema liberado com sucesso!');
        setUserParaPromover(null);
        carregarUsuarios();
      } else {
        const data = await res.json();
        toast.error(data.error || 'Erro ao conceder acesso');
      }
    } catch {
      toast.error('Erro de conexão ao conceder acesso');
    } finally {
      setPromoteLoading(false);
    }
  };

  const handleSyncPhoto = async (id: string) => {
    try {
      const res = await fetch(api(`/auth/users/${id}/sync-photo`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        toast.success('Foto de perfil sincronizada do WhatsApp!');
        carregarUsuarios();
      } else {
        const data = await res.json();
        toast.warning(data.error || 'Não foi possível encontrar a foto no WhatsApp.');
      }
    } catch {
      toast.error('Erro ao comunicar com o servidor.');
    }
  };

  const handleDelete = (id: string) => {
    toast.warning('Tem certeza que deseja excluir este registro? As requisições e históricos vinculados ficarão sem usuário associado.', {
      action: {
        label: 'Excluir',
        onClick: async () => {
          try {
            const res = await fetch(api(`/auth/users/${id}`), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              toast.success('Registro excluído com sucesso!');
              carregarUsuarios();
            } else {
              const data = await res.json();
              toast.error(data.error || 'Erro ao excluir');
            }
          } catch {
            toast.error('Erro de conexão ao excluir');
          }
        }
      }
    });
  };

  const usuariosFiltrados = usuarios.filter(u => {
    if (tabFiltro === 'SISTEMA') return u.role !== 'AVULSO';
    if (tabFiltro === 'AVULSOS') return u.role === 'AVULSO';
    return true;
  });

  const totalSistema = usuarios.filter(u => u.role !== 'AVULSO').length;
  const totalAvulsos = usuarios.filter(u => u.role === 'AVULSO').length;

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
      
      {/* CABEÇALHO COM CONTADORES */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Usuários & Solicitantes</h1>
          <p className="text-slate-500 mt-1">Gerencie os acessos do sistema e o cadastro de solicitantes avulsos para empréstimos.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
            <Users size={18} /> {totalSistema} Usuários com Login
          </div>
          <div className="bg-amber-50 text-amber-700 px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2">
            <UserCheck size={18} /> {totalAvulsos} Solicitantes Avulsos
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* FORMULÁRIO LATERAL */}
        <div className="lg:col-span-1">
          <form onSubmit={handleCriarOuEditar} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 relative">
            {editandoId && (
              <button type="button" onClick={cancelarEdicao} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            )}
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              {editandoId ? 'Editar Cadastro' : 'Novo Cadastro'}
            </h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo / Solicitante *</label>
              <input 
                required 
                value={nome} 
                onChange={e => {
                  const val = e.target.value;
                  setNome(val);
                  const contato = contatosWhatsapp.find(c => c.name === val);
                  if (contato && !whatsapp) {
                    setWhatsapp(contato.number);
                  }
                }} 
                list="contatosList" 
                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" 
                placeholder="Ex: Thiago Ferreira ou Setor TI" 
              />
              <datalist id="contatosList">
                {contatosWhatsapp.map((c, i) => (
                  <option key={i} value={c.name}>{c.number}</option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Departamento / Setor</label>
              <input 
                value={departamento} 
                onChange={e => setDepartamento(e.target.value)} 
                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" 
                placeholder="Ex: Escolar, Eventos, Comunicação..." 
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp (para fotos e avisos)</label>
              <input 
                type="text" 
                value={whatsapp} 
                onChange={e => setWhatsapp(e.target.value)} 
                list="contatosNumberList" 
                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" 
                placeholder="Ex: 11999999999" 
              />
              <datalist id="contatosNumberList">
                {contatosWhatsapp.map((c, i) => (
                  <option key={i} value={c.number}>{c.name}</option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Acesso / Perfil</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value)} 
                className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2"
              >
                <option value="AVULSO">📋 Solicitante Avulso (Sem Login no Painel)</option>
                <option value="SETOR">👤 Setor / Solicitante com Login</option>
                <option value="ESTOQUISTA">📦 Estoquista (Scanner e Controle)</option>
                <option value="ADMIN">🛡️ Administrador Geral</option>
              </select>
            </div>

            {role !== 'AVULSO' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">E-mail (Login) *</label>
                  <input 
                    required={role !== 'AVULSO'} 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" 
                    placeholder="Ex: thiago@empresa.com" 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {editandoId ? 'Nova Senha (Deixe em branco para manter)' : 'Senha de Acesso *'}
                  </label>
                  <input 
                    required={!editandoId && role !== 'AVULSO'} 
                    type="password" 
                    value={senha} 
                    onChange={e => setSenha(e.target.value)} 
                    className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" 
                    placeholder="Mínimo 6 caracteres" 
                    minLength={6} 
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Cor no Calendário</label>
                  <div className="flex items-center gap-3">
                    <input type="color" value={corPersonalizada} onChange={e => setCorPersonalizada(e.target.value)} className="w-12 h-10 rounded cursor-pointer border-0 p-0" />
                    <span className="text-xs text-slate-500">Destaque este usuário no calendário.</span>
                    {corPersonalizada && <button type="button" onClick={() => setCorPersonalizada('')} className="text-xs text-red-500 hover:text-red-700 font-bold">Limpar</button>}
                  </div>
                </div>

                {role === 'SETOR' && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-slate-700 mb-2">Categorias Permitidas</label>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                      {categorias.map(cat => (
                        <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                          <input 
                            type="checkbox" 
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            checked={categoriasPermitidas.includes(cat.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCategoriasPermitidas([...categoriasPermitidas, cat.id]);
                              } else {
                                setCategoriasPermitidas(categoriasPermitidas.filter(id => id !== cat.id));
                              }
                            }}
                          />
                          <span className="text-sm text-slate-700">{cat.nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <button 
              disabled={loading} 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 mt-4"
            >
              {loading ? 'Salvando...' : editandoId ? <><CheckCircle2 size={20} /> Salvar Alterações</> : <><UserPlus size={20} /> Salvar Cadastro</>}
            </button>
          </form>
        </div>

        {/* TABELA DE LISTAGEM E AÇÕES */}
        <div className="lg:col-span-2 space-y-4">
          {/* ABAS DE FILTRO */}
          <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl">
            <button
              onClick={() => setTabFiltro('TODOS')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tabFiltro === 'TODOS' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Todos ({usuarios.length})
            </button>
            <button
              onClick={() => setTabFiltro('SISTEMA')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tabFiltro === 'SISTEMA' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Usuários com Login ({totalSistema})
            </button>
            <button
              onClick={() => setTabFiltro('AVULSOS')}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${tabFiltro === 'AVULSOS' ? 'bg-white text-amber-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              Solicitantes Avulsos ({totalAvulsos})
            </button>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="hidden md:table-header-group bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Nome / Solicitante</th>
                  <th className="px-6 py-4">Contato</th>
                  <th className="px-6 py-4">Tipo / Perfil</th>
                  <th className="px-6 py-4">Departamento</th>
                  <th className="px-6 py-4 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 block md:table-row-group">
                {usuariosFiltrados.map((u) => (
                  <tr key={u.id} className={`block md:table-row hover:bg-slate-50 transition-colors border-b border-slate-100 md:border-b-0 ${editandoId === u.id ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell">
                      <div className="flex items-center gap-3">
                        {u.fotoPerfilUrl ? (
                          <img
                            src={u.fotoPerfilUrl}
                            alt={u.nome}
                            className="w-10 h-10 rounded-full object-cover shrink-0 border border-slate-200 shadow-sm"
                            onError={(e) => { (e.target as any).style.display = 'none'; }}
                          />
                        ) : (
                          <div 
                            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0" 
                            style={{ backgroundColor: u.corPersonalizada || (u.role === 'AVULSO' ? '#fef3c7' : '#e0e7ff'), color: u.corPersonalizada ? '#fff' : (u.role === 'AVULSO' ? '#d97706' : '#4f46e5') }}
                          >
                            {u.nome?.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="font-semibold text-slate-900">{u.nome}</div>
                          {u.role === 'AVULSO' && (
                            <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded">
                              Avulso
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Contato</span>
                        <div>
                          <div className="text-slate-700">{u.role === 'AVULSO' ? 'Sem e-mail de login' : u.email}</div>
                          <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            {u.whatsapp ? <><Phone size={12} className="text-emerald-500" /> {u.whatsapp}</> : '-'}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                      <div className="flex justify-between items-center md:block">
                        <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Perfil</span>
                        <div>
                          {u.role === 'ADMIN' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Administrador</span>}
                          {u.role === 'ESTOQUISTA' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Estoquista</span>}
                          {u.role === 'SETOR' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Setor com Acesso</span>}
                          {u.role === 'AVULSO' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">Solicitante Avulso</span>}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                      <div className="flex justify-between items-center md:block">
                        <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Departamento</span>
                        <div className="text-slate-500 flex items-center gap-1">
                          {u.departamento ? <><Building size={14}/> {u.departamento}</> : '-'}
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell border-t md:border-t-0 border-slate-50">
                      <div className="flex justify-end items-center gap-1.5 flex-wrap">
                        {/* Botão Dar Acesso ao Sistema se for Avulso */}
                        {u.role === 'AVULSO' && (
                          <button 
                            onClick={() => handleAbrirModalPromover(u)} 
                            className="flex items-center gap-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            title="Conceder Login e Senha"
                          >
                            <Key size={14} /> Dar Acesso
                          </button>
                        )}

                        {/* Sincronizar Foto do WhatsApp */}
                        {u.whatsapp && (
                          <button 
                            onClick={() => handleSyncPhoto(u.id)} 
                            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Sincronizar Foto do WhatsApp"
                          >
                            <RefreshCw size={15} />
                          </button>
                        )}

                        <button 
                          onClick={() => handleEdit(u)} 
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors font-medium" 
                          title="Editar Dados"
                        >
                          <Edit2 size={16} />
                        </button>

                        <button 
                          onClick={() => handleDelete(u.id)} 
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium" 
                          title="Excluir"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {usuariosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      Nenhum registro encontrado nesta categoria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL CONCEDER ACESSO AO SISTEMA */}
      {userParaPromover && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }} 
            animate={{ scale: 1, opacity: 1 }} 
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-lg">
                <Key size={20} /> Conceder Acesso ao Sistema
              </div>
              <button onClick={() => setUserParaPromover(null)} className="text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            </div>

            <p className="text-sm text-slate-600">
              Defina as credenciais de login para <strong>{userParaPromover.nome}</strong>. O histórico de empréstimos anteriores será mantido integralmente na conta dele.
            </p>

            <form onSubmit={handleConfirmarPromover} className="space-y-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">E-mail de Login *</label>
                <input 
                  required 
                  type="email" 
                  value={promoteEmail} 
                  onChange={e => setPromoteEmail(e.target.value)} 
                  placeholder="Ex: thiago@escola.com" 
                  className="w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha de Acesso *</label>
                <input 
                  required 
                  type="password" 
                  value={promoteSenha} 
                  onChange={e => setPromoteSenha(e.target.value)} 
                  placeholder="Mínimo 6 caracteres" 
                  minLength={6} 
                  className="w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5" 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Perfil de Acesso *</label>
                <select 
                  value={promoteRole} 
                  onChange={e => setPromoteRole(e.target.value)} 
                  className="w-full rounded-xl border-slate-200 shadow-sm focus:border-emerald-500 focus:ring-emerald-500 text-sm px-4 py-2.5"
                >
                  <option value="SETOR">👤 Setor / Solicitante</option>
                  <option value="ESTOQUISTA">📦 Estoquista (Scanner e Separação)</option>
                  <option value="ADMIN">🛡️ Administrador Geral</option>
                </select>
              </div>

              {promoteRole === 'SETOR' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Categorias de Equipamentos Permitidas</label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
                    {categorias.map(cat => (
                      <label key={cat.id} className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 p-1 rounded">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                          checked={promoteCategorias.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPromoteCategorias([...promoteCategorias, cat.id]);
                            } else {
                              setPromoteCategorias(promoteCategorias.filter(id => id !== cat.id));
                            }
                          }}
                        />
                        <span className="text-sm text-slate-700">{cat.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  type="button" 
                  onClick={() => setUserParaPromover(null)} 
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={promoteLoading} 
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-sm"
                >
                  {promoteLoading ? 'Salvando...' : <><CheckCircle2 size={18} /> Liberar Acesso</>}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
