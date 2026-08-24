import { motion } from 'framer-motion';
import { MapPin, Package } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function SolicitacoesHub() {
  const { user } = useAuth();

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto space-y-8 mt-10">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold text-slate-800">Olá, {user?.nome?.split(' ')[0] || 'Usuário'}!</h1>
        <p className="text-slate-500 max-w-lg mx-auto">O que você gostaria de solicitar hoje? Escolha uma das opções abaixo para iniciar o seu pedido.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        
        <Link to="/solicitar-local" className="group">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:border-teal-200 transition-all text-center h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 bg-teal-50 text-teal-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <MapPin size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Reservar Espaço</h2>
            <p className="text-slate-500">Agende auditórios, salas de reunião e outros espaços físicos para o seu evento.</p>
          </div>
        </Link>

        <Link to="/solicitar-equipamentos" className="group">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:border-blue-200 transition-all text-center h-full flex flex-col items-center justify-center space-y-4">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
              <Package size={40} />
            </div>
            <h2 className="text-2xl font-bold text-slate-800">Solicitar Equipamentos</h2>
            <p className="text-slate-500">Peça câmeras, microfones, projetores e outros materiais do acervo para uso.</p>
          </div>
        </Link>

      </div>
    </motion.div>
  );
}
