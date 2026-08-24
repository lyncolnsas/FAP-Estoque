import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { Shield, Key, CheckCircle, AlertTriangle } from 'lucide-react';

export default function Perfil() {
  const { user, token } = useAuth();
  
  const [senhaAtual, setSenhaAtual] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (novaSenha !== confirmarSenha) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }
    
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const res = await fetch(api('/auth/me/password'), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ senhaAtual, novaSenha })
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Erro ao alterar senha');
      
      setMessage('Senha alterada com sucesso!');
      setSenhaAtual('');
      setNovaSenha('');
      setConfirmarSenha('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 pb-24 md:pb-6 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800">Meu Perfil</h1>
        <p className="text-slate-500 mt-1">Visualize suas informações e gerencie sua segurança</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-6">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Shield className="text-blue-600" size={20} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800">Dados da Conta</h2>
              <p className="text-sm text-slate-500">Suas informações de acesso</p>
            </div>
          </div>
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-200 text-slate-700">
            {user?.role}
          </span>
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Nome de Usuário</label>
            <div className="text-slate-800 font-medium px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              {user?.nome}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">Setor/Departamento</label>
            <div className="text-slate-800 font-medium px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              {user?.departamento || 'Não informado'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">E-mail</label>
            <div className="text-slate-800 font-medium px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              {user?.email || 'Não informado'}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-500 mb-1">WhatsApp</label>
            <div className="text-slate-800 font-medium px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              {user?.whatsapp || 'Não informado'}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 bg-yellow-50 border-t border-yellow-100">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <AlertTriangle size={16} />
            Para alterar seus dados cadastrais, solicite ao Administrador.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
            <Key className="text-slate-600" size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-800">Alterar Senha</h2>
            <p className="text-sm text-slate-500">Atualize sua senha de acesso</p>
          </div>
        </div>

        <form onSubmit={handleChangePassword} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
              <AlertTriangle size={18} />
              {error}
            </div>
          )}
          {message && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg flex items-center gap-2">
              <CheckCircle size={18} />
              {message}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Senha Atual</label>
            <input 
              type="password" 
              required
              value={senhaAtual}
              onChange={e => setSenhaAtual(e.target.value)}
              className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2.5" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
            <input 
              type="password" 
              required
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2.5" 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha</label>
            <input 
              type="password" 
              required
              value={confirmarSenha}
              onChange={e => setConfirmarSenha(e.target.value)}
              className="w-full rounded-xl border-slate-200 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-4 py-2.5" 
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button 
              type="submit" 
              disabled={loading}
              className="px-6 py-2.5 bg-slate-900 text-white font-medium rounded-xl hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Salvando...' : 'Salvar Nova Senha'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
