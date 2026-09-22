import { NavLink, useLocation } from 'react-router-dom'
import useAuthStore from '../stores/authStore'

const NAV = [
  { to: '/',          icon: '⬡', label: 'Dashboard' },
  { to: '/jobs',      icon: '◈', label: 'Analysis Jobs' },
]
const ANALYST_NAV = [
  { to: '/api-keys',  icon: '⚿', label: 'API Keys' },
]
const ADMIN_NAV = [
  { to: '/users',     icon: '◉', label: 'Users' },
  { to: '/audit',     icon: '▣', label: 'Audit Logs' },
]

export default function Layout({ children, title }) {
  const { user, logout } = useAuthStore()
  const isAdmin = user?.role === 'admin'
  const isAnalystOrAbove = user?.role === 'admin' || user?.role === 'analyst'

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="logo-icon">🛡</div>
          <div>
            <div className="logo-text">SOC AI</div>
            <div className="logo-sub">Suggestion Platform</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Navigation</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}

          {isAnalystOrAbove && (
            <>
              {ANALYST_NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                  <span className="nav-icon">{n.icon}</span>
                  {n.label}
                </NavLink>
              ))}
            </>
          )}

          {isAdmin && (
            <>
              <div className="nav-section-label" style={{ marginTop: 16 }}>Admin</div>
              {ADMIN_NAV.map((n) => (
                <NavLink key={n.to} to={n.to} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
                  <span className="nav-icon">{n.icon}</span>
                  {n.label}
                </NavLink>
              ))}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{user?.username?.[0]?.toUpperCase() || 'U'}</div>
            <div>
              <div className="user-name">{user?.username}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <button className="logout-btn" onClick={logout} title="Logout">⎋</button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="main-content">
        <div className="topbar">
          <span className="topbar-title">{title}</span>
          <span className="topbar-badge">AI Online</span>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  )
}
