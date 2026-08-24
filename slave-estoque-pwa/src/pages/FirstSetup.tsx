import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import { ShieldAlert, CheckCircle, Lock, Mail } from 'lucide-react';
import { api } from '../lib/api';

export default function FirstSetup() {
  const [novoEmail, setNovoEmail] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { logout, token } = useAuth();
  const navigate = useNavigate();

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (novaSenha !== confirmarSenha) {
      return setError('As senhas não coincidem.');
    }

    if (novaSenha.length < 6) {
      return setError('A senha deve ter pelo menos 6 caracteres.');
    }

    if (novoEmail === 'admin@admin.com') {
      return setError('Você deve escolher um e-mail diferente do e-mail padrão.');
    }

    try {
      const res = await fetch(api('/auth/setup-admin'), {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ novoEmail, novaSenha })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao configurar admin');

      setSuccess('Administrador configurado com sucesso! Redirecionando para novo login...');
      setTimeout(() => {
        logout();
        navigate('/login');
      }, 3000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white max-w-md w-full rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="bg-amber-500 p-6 text-center">
          <ShieldAlert size={48} className="mx-auto text-white mb-2" />
          <h2 className="text-2xl font-bold text-white">Configuração Inicial</h2>
          <p className="text-amber-100 mt-1">Por segurança, altere as credenciais do sistema.</p>
        </div>

        <div className="p-6 sm:p-8">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 font-medium text-center">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-green-50 text-green-700 p-3 rounded-lg text-sm mb-4 font-medium text-center flex flex-col items-center gap-2">
              <CheckCircle size={24} />
              {success}
            </div>
          )}

          {!success && (
            <form onSubmit={handleSetup} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Novo E-mail de Administrador</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input 
                    type="email" 
                    required
                    value={novoEmail}
                    onChange={e => setNovoEmail(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                    placeholder="admin@suaempresa.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    required
                    value={novaSenha}
                    onChange={e => setNovaSenha(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Confirmar Nova Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 text-slate-400" size={18} />
                  <input 
                    type="password" 
                    required
                    value={confirmarSenha}
                    onChange={e => setConfirmarSenha(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button 
                type="submit"
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-lg shadow-md transition-all flex items-center justify-center gap-2 mt-2"
              >
                Salvar e Sair
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
