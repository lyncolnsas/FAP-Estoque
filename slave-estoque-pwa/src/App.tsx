import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CalendarioSolicitacoes from './pages/CalendarioSolicitacoes';
import ScannerQR from './pages/ScannerQR';
import TelaAceite from './pages/TelaAceite';
import InfoEquipamento from './pages/InfoEquipamento';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import AdminEquipamentos from './pages/AdminEquipamentos';
import AdminLocais from './pages/AdminLocais';
import AdminReservas from './pages/AdminReservas';
import AdminUsuarios from './pages/AdminUsuarios';
import AdminCategorias from './pages/AdminCategorias';
import AdminIntegracoes from './pages/AdminIntegracoes';
import AdminDashboard from './pages/AdminDashboard';
import AdminRelatorios from './pages/AdminRelatorios';
import AdminAvarias from './pages/AdminAvarias';
import Perfil from './pages/Perfil';
import { ForceConfigAdmin } from './pages/ForceConfigAdmin';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AdminLayout from './components/AdminLayout';
import { Toaster } from 'sonner';

function PrivateRoute({ children, roles, useLayout = true }: { children: JSX.Element, roles?: string[], useLayout?: boolean }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex h-screen items-center justify-center text-slate-500">Carregando...</div>;
  if (!user) return <Navigate to="/login" />;
  
  // O bloqueio de força foi removido a pedido do usuário.

  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  
  if (useLayout) {
    return <AdminLayout>{children}</AdminLayout>;
  }
  return children;
}

function App() {
  return (
    <AuthProvider>
      <Toaster richColors position="top-right" />
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/force-config" element={<ForceConfigAdmin />} />
          <Route path="/aceite/:token" element={<TelaAceite />} />
          <Route path="/equipamento/:codigo" element={<InfoEquipamento />} />
          
          <Route path="/" element={<PrivateRoute><CalendarioSolicitacoes /></PrivateRoute>} />
          
          <Route path="/meus-pedidos" element={<PrivateRoute roles={['SETOR', 'ADMIN', 'ESTOQUISTA']}><Dashboard /></PrivateRoute>} />
          <Route path="/entregas" element={<PrivateRoute roles={['ADMIN', 'ESTOQUISTA']}><Dashboard /></PrivateRoute>} />
          <Route path="/scanner" element={<PrivateRoute roles={['ADMIN', 'ESTOQUISTA']}><ScannerQR /></PrivateRoute>} />
          <Route path="/perfil" element={<PrivateRoute><Perfil /></PrivateRoute>} />
          
          <Route path="/admin/dashboard" element={<PrivateRoute roles={['ADMIN']}><AdminDashboard /></PrivateRoute>} />
          <Route path="/admin/relatorios" element={<PrivateRoute roles={['ADMIN']}><AdminRelatorios /></PrivateRoute>} />
          <Route path="/admin/equipamentos" element={<PrivateRoute roles={['ADMIN']}><AdminEquipamentos /></PrivateRoute>} />
          <Route path="/admin/categorias" element={<PrivateRoute roles={['ADMIN']}><AdminCategorias /></PrivateRoute>} />
          <Route path="/admin/locais" element={<PrivateRoute roles={['ADMIN']}><AdminLocais /></PrivateRoute>} />
          <Route path="/admin/reservas" element={<PrivateRoute roles={['ADMIN']}><AdminReservas /></PrivateRoute>} />
          <Route path="/admin/avarias" element={<PrivateRoute roles={['ADMIN']}><AdminAvarias /></PrivateRoute>} />
          <Route path="/admin/usuarios" element={<PrivateRoute roles={['ADMIN']}><AdminUsuarios /></PrivateRoute>} />
          <Route path="/admin/integracoes" element={<PrivateRoute roles={['ADMIN']}><AdminIntegracoes /></PrivateRoute>} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
