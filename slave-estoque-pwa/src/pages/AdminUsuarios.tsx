import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, UserPlus, Users, Building, Edit2, Trash2, X, CheckCircle2 } from 'lucide-react';
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
  corPersonalizada?: string;
  role: string;
  categoriasPermitidas?: CategoriaAdmin[];
}

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [corPersonalizada, setCorPersonalizada] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [role, setRole] = useState('SETOR');
  const [loading, setLoading] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  
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
    setEmail(u.email);
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
      const url = editandoId ? api(`/auth/users/${editandoId}`) : api('/auth/register');
      const method = editandoId ? 'PUT' : 'POST';
      
      const res = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ nome, email, senha, departamento, role, whatsapp, corPersonalizada, categoriasPermitidas: role === 'SETOR' ? categoriasPermitidas : undefined })
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

  const handleDelete = (id: string) => {
    toast.warning('Tem certeza que deseja excluir este usuário? As reservas de local dele também serão excluídas e as requisições ficarão sem usuário associado.', {
      action: {
        label: 'Excluir',
        onClick: async () => {
          try {
            const res = await fetch(api(`/auth/users/${id}`), {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              toast.success('Usuário excluído com sucesso!');
              carregarUsuarios();
            } else {
              const data = await res.json();
              toast.error(data.error || 'Erro ao excluir usuário');
            }
          } catch {
            toast.error('Erro de conexão ao excluir usuário');
          }
        }
      }
    });
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
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Gestão de Usuários</h1>
          <p className="text-slate-500 mt-1">Crie contas para os setores, estoquistas ou novos administradores.</p>
        </div>
        <div className="bg-blue-50 text-blue-600 p-3 rounded-xl">
          <Users size={24} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleCriarOuEditar} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 space-y-4 relative">
            {editandoId && (
              <button type="button" onClick={cancelarEdicao} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                <X size={20} />
              </button>
            )}
            <h3 className="text-xl font-bold text-slate-800 mb-4">{editandoId ? 'Editar Acesso' : 'Novo Acesso'}</h3>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo / Setor</label>
              <input required value={nome} onChange={e => {
                const val = e.target.value;
                setNome(val);
                // Se o usuário selecionar um nome da lista, podemos auto-preencher o whatsapp correspondente
                const contatoSelecionado = contatosWhatsapp.find(c => c.name === val);
                if (contatoSelecionado && !whatsapp) {
                  setWhatsapp(contatoSelecionado.number);
                }
              }} list="contatosList" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Ex: João da Silva ou Setor de TI" />
              <datalist id="contatosList">
                {contatosWhatsapp.map((c, i) => (
                  <option key={i} value={c.name}>{c.number}</option>
                ))}
              </datalist>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail (Login)</label>
              <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Ex: joao@empresa.com" />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">{editandoId ? 'Nova Senha (Deixe em branco para manter)' : 'Senha Provisória'}</label>
              <input required={!editandoId} type="password" value={senha} onChange={e => setSenha(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Mínimo 6 caracteres" minLength={6} />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Cor no Calendário</label>
              <div className="flex items-center gap-3">
                <input type="color" value={corPersonalizada} onChange={e => setCorPersonalizada(e.target.value)} className="w-12 h-10 rounded cursor-pointer border-0 p-0" />
                <span className="text-xs text-slate-500">Selecione uma cor para destacar este usuário na agenda.</span>
                {corPersonalizada && <button type="button" onClick={() => setCorPersonalizada('')} className="text-xs text-red-500 hover:text-red-700 font-bold">Limpar</button>}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">WhatsApp (com DDD)</label>
              <input type="text" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} list="contatosNumberList" className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Ex: 11999999999" />
              <datalist id="contatosNumberList">
                {contatosWhatsapp.map((c, i) => (
                  <option key={i} value={c.number}>{c.name}</option>
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Perfil de Acesso</label>
              <select value={role} onChange={e => setRole(e.target.value)} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2">
                <option value="SETOR">Setor / Solicitante</option>
                <option value="ESTOQUISTA">Estoquista (Scanner)</option>
                <option value="ADMIN">Administrador Geral</option>
              </select>
            </div>

            <div className={`transition-all ${role === 'SETOR' ? 'block' : 'hidden'}`}>
              <label className="block text-sm font-medium text-slate-700 mb-1">Departamento (Para Setores)</label>
              <input value={departamento} onChange={e => setDepartamento(e.target.value)} required={role === 'SETOR'} className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2" placeholder="Ex: Recursos Humanos" />
            </div>

            <div className={`transition-all ${role === 'SETOR' ? 'block' : 'hidden'} mt-4`}>
              <label className="block text-sm font-medium text-slate-700 mb-2">Categorias Permitidas (Para Setores)</label>
              <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50">
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
                {categorias.length === 0 && <span className="text-sm text-slate-500">Nenhuma categoria encontrada.</span>}
              </div>
              <p className="text-xs text-slate-500 mt-1">Se nenhuma categoria for selecionada, o usuário não verá nenhum equipamento.</p>
            </div>

            <button disabled={loading} type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 mt-4">
              {loading ? 'Salvando...' : editandoId ? <><CheckCircle2 size={20} /> Salvar Alterações</> : <><UserPlus size={20} /> Cadastrar Usuário</>}
            </button>
          </form>
        </div>

        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="hidden md:table-header-group bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Nome / Setor</th>
                  <th className="px-6 py-4">E-mail / WhatsApp</th>
                  <th className="px-6 py-4">Perfil</th>
                  <th className="px-6 py-4">Departamento</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 block md:table-row-group">
                {usuarios.map((u) => (
                  <tr key={u.id} className={`block md:table-row hover:bg-slate-50 transition-colors border-b border-slate-100 md:border-b-0 ${editandoId === u.id ? 'bg-blue-50/50' : ''}`}>
                    <td className="px-4 py-3 md:px-6 md:py-4 block md:table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ backgroundColor: u.corPersonalizada || '#e2e8f0', color: u.corPersonalizada ? '#fff' : '#475569' }}>
                          {u.nome?.substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-semibold text-slate-900">{u.nome}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                      <div className="flex justify-between md:block">
                        <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Contato</span>
                        <div>
                          <div className="text-slate-700">{u.email}</div>
                          <div className="text-xs text-slate-400">{u.whatsapp || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2 md:px-6 md:py-4 block md:table-cell">
                      <div className="flex justify-between items-center md:block">
                        <span className="md:hidden text-xs font-semibold text-slate-500 uppercase">Perfil</span>
                        <div>
                          {u.role === 'ADMIN' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">Administrador</span>}
                          {u.role === 'ESTOQUISTA' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Estoquista</span>}
                          {u.role === 'SETOR' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Setor</span>}
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
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleEdit(u)} className="flex-1 md:flex-none flex items-center justify-center gap-2 text-blue-600 hover:text-blue-800 p-2 rounded-lg bg-blue-50 md:bg-transparent md:hover:bg-blue-50 transition-colors font-medium" title="Editar">
                          <Edit2 size={16} /> <span className="md:hidden text-sm">Editar</span>
                        </button>
                        <button onClick={() => handleDelete(u.id)} className="flex-1 md:flex-none flex items-center justify-center gap-2 text-red-600 hover:text-red-800 p-2 rounded-lg bg-red-50 md:bg-transparent md:hover:bg-red-50 transition-colors font-medium" title="Excluir">
                          <Trash2 size={16} /> <span className="md:hidden text-sm">Excluir</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {usuarios.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">Nenhum usuário encontrado.</td>
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
