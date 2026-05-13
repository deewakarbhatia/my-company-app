import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const getAllNavLinks = () => [
  { path: '/dashboard', label: 'Dashboard', icon: '⊞', color: 'text-sky-400', roles: ['admin', 'manager', 'employee'] },
  { path: '/sales', label: 'Sales', icon: '📊', color: 'text-emerald-400', roles: ['admin', 'manager'] },
  { path: '/inventory', label: 'Inventory', icon: '📦', color: 'text-amber-400', roles: ['admin', 'manager'] },
  { path: '/customers', label: 'Customers', icon: '👥', color: 'text-purple-400', roles: ['admin', 'manager', 'employee'] },
  { path: '/tasks', label: 'Tasks', icon: '📝', color: 'text-orange-400', roles: ['admin', 'manager', 'employee'] },
  { path: '/hr', label: 'HR', icon: '👔', color: 'text-rose-400', roles: ['admin', 'manager', 'employee'] },
  { path: '/reports', label: 'Reports', icon: '📄', color: 'text-blue-400', roles: ['admin', 'manager'] },
  { path: '/invoices', label: 'Invoices', icon: '📋', color: 'text-teal-400', roles: ['admin', 'manager'] },
  { path: '/settings', label: 'Settings', icon: '⚙️', color: 'text-slate-400', roles: ['admin'] },
]

const Sidebar = () => {
  const location = useLocation()
  const { userRole } = useAuth()
  
  const navLinks = getAllNavLinks().filter((link) => link.roles.includes(userRole || 'employee'))

  return (
    <aside className="hidden md:flex flex-col w-64 bg-[#1e293b] border-r border-slate-800/50 shadow-2xl h-screen overflow-y-auto">
      <div className="p-6">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-xl shadow-lg shadow-sky-500/30">
            🏢
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">My Company</h1>
            <p className="text-[10px] uppercase tracking-widest text-sky-200/70">Management UI</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4 mt-2">Menu</p>
        {navLinks.map((link) => {
          const isActive = location.pathname === link.path
          return (
            <Link
              key={link.path}
              to={link.path}
              className={`flex items-center gap-3 px-3 py-3 rounded-2xl transition-all duration-300 ${
                isActive
                  ? 'bg-sky-500/10 text-sky-300 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <span className={`text-xl ${isActive ? link.color : 'text-slate-500'}`}>{link.icon}</span>
              <span className="font-medium text-sm">{link.label}</span>
            </Link>
          )
        })}
      </nav>

      <div className="p-6 border-t border-slate-800/50 mt-auto">
        <div className="rounded-2xl bg-gradient-to-r from-sky-500/10 to-purple-500/10 p-4 border border-sky-500/20">
          <p className="text-xs font-semibold text-slate-200">SaaS Premium</p>
          <p className="text-[10px] text-slate-400 mt-1">Version 2.0 connected ✨</p>
        </div>
      </div>
    </aside>
  )
}

export default Sidebar
