import React, { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Package, LayoutDashboard, Database, MapPin, Layers, Users, Settings,
  LogOut, Menu, ClipboardList, ScanLine, CalendarClock, FileText,
  AlertTriangle, Truck, UserCircle, ChevronRight
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

// ─── Taxonomia de Navegação ─────────────────────────────────────────────────
// Organizada por fluxo de trabalho real, não por tecnologia ou administração.
// roles: quem vê o item | adminOnly: esconde a seção inteira para não-admins.
const NAV_SECTIONS = [
  {
    label: 'Operacional',
    items: [
      { name: 'Painel de Estoque',     path: '/admin/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'ESTOQUISTA'] },
      { name: 'Solicitações',          path: '/',                icon: CalendarClock,   roles: ['ADMIN', 'ESTOQUISTA', 'SETOR'] },
      { name: 'Meus Pedidos',          path: '/meus-pedidos',    icon: ClipboardList,   roles: ['SETOR'] },
      { name: 'Entregas & Devoluções', path: '/entregas',        icon: Truck,           roles: ['ADMIN', 'ESTOQUISTA'] },
      { name: 'Scanner QR',            path: '/scanner',         icon: ScanLine,        roles: ['ADMIN', 'ESTOQUISTA'] },
    ],
  },
  {
    label: 'Acervo',
    adminOnly: true,
    items: [
      { name: 'Equipamentos', path: '/admin/equipamentos', icon: Database,      roles: ['ADMIN'] },
      { name: 'Categorias',   path: '/admin/categorias',   icon: Layers,        roles: ['ADMIN'] },
      { name: 'Locais',       path: '/admin/locais',       icon: MapPin,        roles: ['ADMIN'] },
      { name: 'Avarias',      path: '/admin/avarias',      icon: AlertTriangle, roles: ['ADMIN'] },
    ],
  },
  {
    label: 'Sistema',
    adminOnly: true,
    items: [
      { name: 'Usuários',    path: '/admin/usuarios',    icon: Users,    roles: ['ADMIN'] },
      { name: 'Relatórios',  path: '/admin/relatorios',  icon: FileText, roles: ['ADMIN'] },
      { name: 'Integrações', path: '/admin/integracoes', icon: Settings, roles: ['ADMIN'] },
    ],
  },
];


export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isAdmin = user?.role === 'ADMIN';
  const userRole = user?.role || '';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Componente de item de navegação com indicador de ativo
  const NavItem = ({ item }: { item: { name: string; path: string; icon: React.ElementType; roles: string[] } }) => {
    // A raiz '/' só ativa quando está exatamente na raiz, para não afetar sub-rotas
    const isActive = item.path === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(item.path);

    return (
      <NavLink
        to={item.path}
        onClick={() => setIsMobileMenuOpen(false)}
        className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 ${
          isActive
            ? 'bg-blue-500/15 text-blue-400 font-medium'
            : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
        }`}
      >
        <item.icon
          size={18}
          className={isActive ? 'text-blue-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'}
        />
        <span className="flex-1 text-sm">{item.name}</span>
        {isActive && <ChevronRight size={14} className="text-blue-400/50" />}
      </NavLink>
    );
  };

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-900 text-slate-300 w-64 shadow-xl">
      {/* Logo */}
      <div className="p-5 flex items-center gap-3 border-b border-slate-800">
        <div className="bg-blue-500 p-2 rounded-lg shadow-lg shadow-blue-500/20">
          <Package size={22} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-tight">
          Estoque<span className="text-blue-500">PRO</span>
        </h1>
      </div>

      {/* Seções de Navegação */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-5">
        {NAV_SECTIONS.map((section) => {
          if (section.adminOnly && !isAdmin) return null;

          const visibleItems = section.items.filter(item => item.roles.includes(userRole));
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.label}>
              <h2 className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-1.5">
                {section.label}
              </h2>
              <nav className="space-y-0.5">
                {visibleItems.map(item => (
                  <NavItem key={item.path} item={item} />
                ))}
              </nav>
            </div>
          );
        })}
      </div>

      {/* Rodapé: Perfil + Logout */}
      <div className="p-3 border-t border-slate-800">
        <NavLink
          to="/perfil"
          onClick={() => setIsMobileMenuOpen(false)}
          className={`group flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150 mb-1 ${
            location.pathname === '/perfil'
              ? 'bg-blue-500/15 text-blue-400'
              : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
          }`}
        >
          {user?.nome ? (
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[11px] font-bold text-white shadow-sm flex-shrink-0">
              {user.nome.substring(0, 2).toUpperCase()}
            </div>
          ) : (
            <UserCircle size={18} className="text-slate-500" />
          )}
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-medium truncate leading-tight">{user?.nome || 'Perfil'}</p>
            <p className="text-[10px] text-slate-600 uppercase tracking-wider">{user?.role}</p>
          </div>
        </NavLink>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-600 hover:text-red-400 rounded-lg hover:bg-slate-800/60 transition-colors"
        >
          <LogOut size={14} />
          <span>Sair do Sistema</span>
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

      {/* Mobile Drawer + Overlay */}
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

      {/* Área Principal */}
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        {/* Barra Superior Mobile */}
        <div className="md:hidden flex items-center justify-between bg-white border-b border-slate-200 p-4 relative z-30 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="bg-blue-500 p-1.5 rounded-md shadow-md shadow-blue-500/20">
              <Package size={20} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-lg tracking-tight">
              Estoque<span className="text-blue-600">PRO</span>
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="text-slate-500 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-md transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>

        {/* Conteúdo da Página */}
        <main className="flex-1 overflow-y-auto bg-slate-50 relative">
          {user?.email === 'admin@admin.com' && (
            <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-800 p-4 m-4 md:m-6 rounded shadow-sm flex items-center gap-3">
              <AlertTriangle size={24} className="text-amber-600" />
              <div>
                <p className="font-bold">Aviso de Segurança</p>
                <p className="text-sm">
                  Você está logado com a conta padrão provisória. Por favor, acesse{' '}
                  <strong>Perfil</strong> ou <strong>Usuários</strong> para cadastrar credenciais definitivas.
                </p>
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
