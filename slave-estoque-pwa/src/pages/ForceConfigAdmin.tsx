import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/api';
import { motion } from 'framer-motion';
import { ShieldAlert, User, Lock, Save, LogOut } from 'lucide-react';

export function ForceConfigAdmin() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user || user.email !== 'admin@admin.com') {
    navigate('/admin/dashboard');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!newEmail || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }

    if (newEmail === 'admin@admin.com') {
      setError('Você não pode manter o e-mail padrão. Escolha outro.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(api('/auth/setup-admin'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('@SlaveEstoque:token')}`
        },
        body: JSON.stringify({
          novoEmail: newEmail,
          novaSenha: newPassword
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Erro ao atualizar credenciais.');
      }
      
      logout();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar credenciais. Tente novamente.');
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-red-100/50 blur-3xl"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-xl shadow-slate-200/50 max-w-lg w-full relative z-10 m-4"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="bg-red-100 p-4 rounded-full mb-4">
            <ShieldAlert size={48} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 text-center">Configuração Obrigatória</h2>
          <p className="text-slate-500 text-center mt-2 font-medium">
            Por motivos de segurança, você deve alterar o e-mail e a senha do administrador padrão antes de continuar.
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm mb-6 font-medium text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Novo E-mail (Usuário)</label>
            <div className="relative group">
              <User className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input 
                type="email" 
                required
                value={newEmail}
                onChange={e => setNewEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                placeholder="Ex: seu.nome@empresa.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Nova Senha</label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input 
                type="password" 
                required
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                placeholder="No mínimo 6 caracteres"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Confirmar Nova Senha</label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input 
                type="password" 
                required
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                placeholder="Repita a senha"
              />
            </div>
          </div>

          <div className="flex gap-4 mt-8">
            <button 
              type="button"
              onClick={logout}
              className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <LogOut size={20} /> Sair
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="flex-[2] bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2"
            >
              <Save size={20} /> 
              {loading ? 'Salvando...' : 'Salvar e Continuar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
