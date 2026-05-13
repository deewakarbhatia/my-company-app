import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import Customers from './pages/Customers'
import Dashboard from './pages/Dashboard'
import HR from './pages/HR'
import Inventory from './pages/Inventory'
import Login from './pages/Login'
import Signup from './pages/Signup'
import Sales from './pages/Sales'
import Reports from './pages/Reports'
import Invoices from './pages/Invoices'
import Settings from './pages/Settings'
import Tasks from './pages/Tasks'

const getAllNavLinks = () => [
  { path: '/dashboard', label: 'Dashboard', icon: '⊞', roles: ['admin', 'manager', 'employee'] },
  { path: '/sales', label: 'Sales', icon: '📊', roles: ['admin', 'manager'] },
  { path: '/inventory', label: 'Inventory', icon: '📦', roles: ['admin', 'manager'] },
  { path: '/customers', label: 'Customers', icon: '👥', roles: ['admin', 'manager', 'employee'] },
  { path: '/tasks', label: 'Tasks', icon: '📝', roles: ['admin', 'manager', 'employee'] },
  { path: '/hr', label: 'HR', icon: '👔', roles: ['admin', 'manager', 'employee'] },
  { path: '/reports', label: 'Reports', icon: '📄', roles: ['admin', 'manager'] },
  { path: '/invoices', label: 'Invoices', icon: '📋', roles: ['admin', 'manager'] },
  { path: '/settings', label: 'Settings', icon: '⚙️', roles: ['admin'] },
]

const pageTitles = {
  '/dashboard': 'Dashboard',
  '/sales': 'Sales',
  '/inventory': 'Inventory',
  '/customers': 'Customers',
  '/hr': 'HR',
  '/tasks': 'Tasks & Compliance',
  '/reports': 'Reports',
  '/invoices': 'Invoices',
  '/settings': 'Settings',
  '/login': 'Sign In',
  '/signup': 'Sign Up',
}

const AppContent = () => {
  const location = useLocation()
  const currentPath = location.pathname
  const { userRole, loading } = useAuth()
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode')
    return saved !== null ? JSON.parse(saved) : false
  })

  useEffect(() => {
    localStorage.setItem('darkMode', JSON.stringify(darkMode))
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  const currentPageTitle = pageTitles[currentPath] || 'App'
  
  // Filter nav links based on user role
  const navLinks = getAllNavLinks().filter((link) => link.roles.includes(userRole || 'employee'))

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900 dark:bg-[#0f172a] dark:text-slate-100">
      {/* Static Desktop Sidebar */}
      <Sidebar />
      
      {/* Scrollable Main Content Area */}
      <div className="flex-1 flex flex-col relative w-full pb-20 md:pb-0 overflow-y-auto">
        <Navbar 
          darkMode={darkMode} 
          setDarkMode={setDarkMode} 
          currentPageTitle={currentPageTitle}
        />
        <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 lg:px-10">
          <Routes>
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute><Customers /></ProtectedRoute>} />
            <Route path="/tasks" element={<ProtectedRoute><Tasks /></ProtectedRoute>} />
            <Route path="/hr" element={<ProtectedRoute><HR /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
            <Route path="/sales" element={<ProtectedRoute><Sales /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
        
        {/* Mobile Bottom Nav */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-slate-800 bg-slate-950/95 shadow-lg md:hidden pt-1 pb-2">
          {navLinks.map((link) => {
            const isActive = currentPath === link.path
            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex-1 flex flex-col items-center justify-center px-1 py-2 text-[10px] font-medium transition ${
                  isActive
                    ? 'text-sky-300'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className={`text-xl mb-1 ${isActive ? 'text-sky-400' : ''}`}>{link.icon}</span>
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}

const App = () => (
  <BrowserRouter>
    <AppContent />
  </BrowserRouter>
)

export default App
