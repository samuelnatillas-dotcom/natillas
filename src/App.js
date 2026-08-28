import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { List, Wrench, Truck, CreditCard, Settings, Menu, X, LogOut } from 'lucide-react';
import Login from './pages/Login';
import Pedidos from './pages/Pedidos';
import Produccion from './pages/Produccion';
import Despacho from './pages/Despacho';
import Pagos from './pages/Pagos';
import Configuracion from './pages/Configuracion';
import Formulario from './pages/Formulario';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error('App crash:', error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', background: '#fff3f3', minHeight: '100vh' }}>
          <h2 style={{ color: '#d93025' }}>⚠️ Error en la aplicación</h2>
          <p style={{ marginTop: 12, whiteSpace: 'pre-wrap' }}>{String(this.state.error.message || this.state.error)}</p>
          <pre style={{ marginTop: 16, fontSize: 11, color: '#888', whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>{this.state.error.stack}</pre>
          <p style={{ marginTop: 20, color: '#666', fontSize: 13 }}>Revisa las variables de entorno en Vercel (Settings → Environment Variables) y vuelve a desplegar.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const NAV = [
  { to: '/panel/pedidos', icon: List, label: 'Pedidos' },
  { to: '/panel/produccion', icon: Wrench, label: 'Producción' },
  { to: '/panel/despacho', icon: Truck, label: 'Despacho' },
  { to: '/panel/pagos', icon: CreditCard, label: 'Pagos y Recaudos' },
  { to: '/panel/configuracion', icon: Settings, label: 'Configuración' },
];

function Sidebar({ onLogout }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">🍮</div>
        <div>
          <div className="sidebar-logo-name">Natilla Medellín</div>
          <div className="sidebar-logo-sub">Panel interno</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon /><span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
          <LogOut size={13} /> Cerrar sesión
        </button>
      </div>
    </aside>
  );
}

function MobileDrawer({ open, onClose, onLogout }) {
  const location = useLocation();
  useEffect(() => { onClose(); }, [location, onClose]);
  return (
    <div className={`mobile-drawer${open ? ' open' : ''}`}>
      <div className="drawer-bg" onClick={onClose} />
      <nav className="drawer-nav">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
            <Icon /><span>{label}</span>
          </NavLink>
        ))}
        <button onClick={onLogout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '8px 10px', marginTop: 'auto' }}>
          <LogOut size={13} /> Cerrar sesión
        </button>
      </nav>
    </div>
  );
}

function Panel({ onLogout }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="shell">
      <Sidebar onLogout={onLogout} />
      <div className="topbar-mobile">
        <span className="topbar-mobile-title">🍮 Natilla Medellín</span>
        <button className="topbar-mobile-btn" onClick={() => setMenuOpen(o => !o)}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>
      <MobileDrawer open={menuOpen} onClose={() => setMenuOpen(false)} onLogout={onLogout} />
      <main className="main">
        <Routes>
          <Route path="pedidos" element={<Pedidos />} />
          <Route path="produccion" element={<Produccion />} />
          <Route path="despacho" element={<Despacho />} />
          <Route path="pagos" element={<Pagos />} />
          <Route path="configuracion" element={<Configuracion />} />
          <Route path="*" element={<Navigate to="pedidos" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [auth, setAuth] = useState(() => sessionStorage.getItem('nm_auth') === '1');
  const login = () => { sessionStorage.setItem('nm_auth', '1'); setAuth(true); };
  const logout = () => { sessionStorage.removeItem('nm_auth'); setAuth(false); };

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/pedido" element={<Formulario />} />
          <Route path="/login" element={auth ? <Navigate to="/panel/pedidos" replace /> : <Login onLogin={login} />} />
          <Route path="/panel/*" element={auth ? <Panel onLogout={logout} /> : <Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/pedido" replace />} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
