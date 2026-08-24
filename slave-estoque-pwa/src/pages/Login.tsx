import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ShieldCheck, LogIn, Lock, Mail, Package } from 'lucide-react';
import { api } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [error, setError] = useState('');
  const [showDefaultAdminHelp, setShowDefaultAdminHelp] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  React.useEffect(() => {
    fetch(api('/auth/check-default-admin'))
      .then(res => res.json())
      .then(data => {
        setShowDefaultAdminHelp(data.hasDefaultAdmin);
      })
      .catch(console.error);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch(api('/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, senha })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erro ao logar');

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 relative overflow-hidden">
      {/* Elementos decorativos de fundo */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-100/50 blur-3xl"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-100/50 blur-3xl"></div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="bg-white border border-slate-100 p-8 sm:p-10 rounded-[2rem] shadow-xl shadow-slate-200/50 max-w-md w-full relative z-10 m-4"
      >
        <div className="flex justify-center mb-8">
          <div className="bg-blue-600 p-3 rounded-2xl shadow-lg shadow-blue-500/30">
            <Package size={40} className="text-white" />
          </div>
        </div>
        
        <h2 className="text-2xl sm:text-3xl font-bold text-center text-slate-800 tracking-tight mb-2">
          Estoque<span className="text-blue-600">PRO</span>
        </h2>
        <p className="text-center text-slate-500 mb-8 font-medium">Faça login para gerenciar o acervo.</p>

        {error && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-xl text-sm mb-6 text-center font-medium flex items-center justify-center gap-2"
          >
            <ShieldCheck size={18} />
            {error}
          </motion.div>
        )}

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Nome de Usuário ou E-mail</label>
            <div className="relative group">
              <Mail className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input 
                type="text" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                placeholder="Ex: joao.silva ou admin@admin.com"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5 ml-1">Senha</label>
            <div className="relative group">
              <Lock className="absolute left-3.5 top-3 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input 
                type="password" 
                required
                value={senha}
                onChange={e => setSenha(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 pl-10 pr-4 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                placeholder="••••••••"
              />
            </div>
          </div>

          <motion.button 
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 mt-6"
          >
            <LogIn size={20} /> Entrar no Sistema
          </motion.button>
        </form>

        {showDefaultAdminHelp && (
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm font-medium text-slate-500">Primeiro Acesso?</p>
            <p className="text-xs text-slate-400 mt-1">Use <span className="font-semibold text-slate-600">admin@admin.com</span> e senha <span className="font-semibold text-slate-600">123</span></p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
