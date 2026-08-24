import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Package, LayoutDashboard, Database, MapPin, Layers, Users, Settings, 
  LogOut, Menu, ClipboardList, ScanLine, CalendarClock, FileText, AlertTriangle
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';

  const navItems = [
    { name: 'Dashboard Gerencial', path: '/admin/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'ESTOQUISTA'] },
    { name: 'Solicitar Evento', path: '/', icon: CalendarClock, roles: ['ADMIN', 'ESTOQUISTA', 'SETOR'] },
    { name: 'Meus Pedidos', path: '/meus-pedidos', icon: ClipboardList, roles: ['SETOR'] },
    { name: 'Entregas', path: '/entregas', icon: ClipboardList, roles: ['ADMIN', 'ESTOQUISTA'] },
    { name: 'Scanner', path: '/scanner', icon: ScanLine, roles: ['ADMIN', 'ESTOQUISTA'] },
  ];

  const adminItems = [
    { name: 'Acervo', path: '/admin/equipamentos', icon: Database },
    { name: 'Avarias', path: '/admin/avarias', icon: AlertTriangle },
    { name: 'Relatórios', path: '/admin/relatorios', icon: FileText },
    { name: 'Reservas', path: '/admin/reservas', icon: CalendarClock },
    { name: 'Locais', path: '/admin/locais', icon: MapPin },
    { name: 'Categorias', path: '/admin/categorias', icon: Layers },
    { name: 'Usuários', path: '/admin/usuarios', icon: Users },
    { name: 'Integrações', path: '/admin/integracoes', icon: Settings },
  ];

  const filteredNavItems = navItems.filter(item => item.roles.includes(user?.role || ''));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 w-64 shadow-xl">
      <div className="p-6 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-blue-500 p-2 rounded-lg shadow-lg shadow-blue-500/20">
          <Package size={24} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">Estoque<span className="text-blue-500">PRO</span></h1>
      </div>

      <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
        {/* Módulos Principais */}
        <div>
          <h2 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Módulos</h2>
          <nav className="space-y-1">
            {filteredNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                    isActive 
                      ? 'bg-blue-500/10 text-blue-400 font-medium' 
                      : 'hover:bg-slate-800 hover:text-slate-100'
                  }`
                }
              >
                <item.icon size={20} className={location.pathname === item.path ? 'text-blue-500' : 'text-slate-400'} />
                {item.name}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Administração */}
        {isAdmin && (
          <div>
            <h2 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Administração</h2>
            <nav className="space-y-1">
              {adminItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${
                      isActive 
                        ? 'bg-blue-500/10 text-blue-400 font-medium' 
                        : 'hover:bg-slate-800 hover:text-slate-100'
                    }`
                  }
                >
                  <item.icon size={20} className={location.pathname.startsWith(item.path) ? 'text-blue-500' : 'text-slate-400'} />
                  {item.name}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 px-3 py-2 mb-4 bg-slate-800/50 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-slate-700 flex items-center justify-center text-sm font-bold text-white shadow-inner">
            {user?.nome?.substring(0, 2).toUpperCase() || 'US'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium text-white truncate">{user?.nome}</p>
            <p className="text-xs text-slate-400 truncate">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-red-400 hover:bg-red-400/10 hover:text-red-300 rounded-lg transition-colors"
        >
          <LogOut size={18} /> Sair do Sistema
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0 relative z-20">
        <SidebarContent />
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
              className="fixed inset-y-0 left-0 w-64 z-50 md:hidden"
            >
              <SidebarContent />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        {/* Mobile Top Bar */}
        <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 p-4 relative z-30 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="bg-blue-500 p-1.5 rounded-md shadow-md shadow-blue-500/20">
              <Package size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">Estoque<span className="text-blue-600">PRO</span></span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-md transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50 relative">
          {user?.email === 'admin@admin.com' && (
            <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 m-4 md:m-6 rounded shadow-sm flex items-center gap-3">
              <AlertTriangle size={24} className="text-amber-600" />
              <div>
                <p className="font-bold">Aviso de Segurança</p>
                <p className="text-sm">Você está logado com a conta padrão provisória. Por favor, acesse o menu de Usuários ou Perfil para cadastrar credenciais definitivas ou alterar esta conta.</p>
              </div>
            </div>
          )}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-6 pb-20">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
