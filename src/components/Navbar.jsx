import { Link, useNavigate } from 'react-router-dom'
import { useState, useRef, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { auth, db, updateDocument, getDocuments } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore'

const formatTimeAgo = (dateValue) => {
  if (!dateValue) return ''
  const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue)
  const seconds = Math.floor((new Date() - date) / 1000)
  
  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + 'y ago'
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + 'm ago'
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + 'd ago'
  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + 'h ago'
  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + ' min ago'
  return 'Just now'
}

const Navbar = ({ darkMode, setDarkMode, currentPageTitle }) => {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState(null)
  const [isSearching, setIsSearching] = useState(false)
  const searchMenuRef = useRef(null)

  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  
  const userMenuRef = useRef(null)
  const notifMenuRef = useRef(null)
  const navigate = useNavigate()
  const { user, userRole } = useAuth()

  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const [sales, inventory, customers, employees] = await Promise.all([
          getDocuments('sales'),
          getDocuments('inventory'),
          getDocuments('customers'),
          getDocuments('employees')
        ])

        const term = searchQuery.toLowerCase().trim()
        const results = {}

        const matchedCustomers = (customers || []).filter(c => c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term)).slice(0, 3)
        if (matchedCustomers.length) results.Customers = matchedCustomers.map(c => ({ id: c.id, label: c.name, sub: c.email, link: `/customers?searchId=${c.id}` }))

        const matchedSales = (sales || []).filter(s => s.id?.toLowerCase().includes(term) || s.customer?.toLowerCase().includes(term)).slice(0, 3)
        if (matchedSales.length) results.Orders = matchedSales.map(s => ({ id: s.id, label: s.id, sub: s.customer, link: `/sales?searchId=${s.id}` }))

        const matchedInv = (inventory || []).filter(i => i.name?.toLowerCase().includes(term) || i.sku?.toLowerCase().includes(term)).slice(0, 3)
        if (matchedInv.length) results.Products = matchedInv.map(i => ({ id: i.id, label: i.name, sub: i.sku, link: `/inventory?searchId=${i.id}` }))

        const matchedEmp = (employees || []).filter(e => e.name?.toLowerCase().includes(term) || e.role?.toLowerCase().includes(term)).slice(0, 3)
        if (matchedEmp.length) results.Employees = matchedEmp.map(e => ({ id: e.id, label: e.name, sub: e.role, link: `/hr?searchId=${e.id}` }))

        setSearchResults(results)
      } catch (err) {
        console.error("Search error:", err)
      } finally {
        setIsSearching(false)
      }
    }, 400)

    return () => clearTimeout(timer)
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) setShowUserMenu(false)
      if (notifMenuRef.current && !notifMenuRef.current.contains(e.target)) setShowNotifications(false)
      if (searchMenuRef.current && !searchMenuRef.current.contains(e.target)) setSearchResults(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('createdAt', 'desc'), limit(20))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = []
      snapshot.forEach(doc => notifs.push({ id: doc.id, ...doc.data() }))
      setNotifications(notifs)
    }, (error) => console.error('Error fetching notifications:', error))
    return () => unsubscribe()
  }, [])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAsRead = async (id, e) => {
    if (e) e.stopPropagation()
    try { await updateDocument('notifications', id, { read: true }) } catch (err) { console.error(err) }
  }

  const markAllAsRead = async () => {
    try {
      const unreadNotifs = notifications.filter(n => !n.read)
      await Promise.all(unreadNotifs.map(n => updateDocument('notifications', n.id, { read: true })))
    } catch (err) { console.error(err) }
  }

  const toggleDarkMode = () => setDarkMode(!darkMode)

  const handleLogout = async () => {
    try {
      await signOut(auth)
      navigate('/login')
    } catch (error) { console.error(error) }
  }

  const handleResultClick = (link) => {
    navigate(link)
    setSearchResults(null)
    setSearchQuery('')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-900/95 px-4 py-3 sm:px-6 shadow-sm backdrop-blur-md">
      <div className="mx-auto flex w-full items-center justify-between gap-4">
        
        {/* Left: Mobile Title (Desktop has Sidebar) */}
        <div className="flex items-center gap-3 min-w-0 flex-shrink-0 md:hidden">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="text-xl">🏢</div>
            <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100">My Company</h1>
          </Link>
        </div>

        {/* Center: Search Bar */}
        <div className="hidden md:flex flex-1 items-center gap-6 justify-between">
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{currentPageTitle}</h2>
          
          <div className="relative w-full max-w-lg" ref={searchMenuRef}>
            <div className={`flex items-center border ${searchResults ? 'border-sky-500 rounded-t-2xl' : 'border-slate-300 dark:border-slate-700 rounded-full'} bg-slate-50 dark:bg-slate-950/50 px-4 py-2 text-sm text-slate-600 dark:text-slate-400 transition-all focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20`}>
              <span className="mr-3 text-lg opacity-60">🔍</span>
              <input
                type="text"
                placeholder="Search across collections..."
                value={searchQuery}
                onFocus={() => searchQuery.trim() && setSearchResults(searchResults || {})}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent outline-none w-full text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
              {isSearching && <span className="ml-2 animate-spin text-sky-500">⟳</span>}
            </div>

            {searchResults && (
              <div className="absolute top-full left-0 right-0 w-full bg-white dark:bg-slate-900 border border-t-0 border-sky-500 rounded-b-2xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-1">
                {Object.keys(searchResults).length === 0 && !isSearching ? (
                  <div className="p-4 text-center text-sm text-slate-500">No results found.</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {Object.entries(searchResults).map(([category, items]) => (
                      <div key={category} className="border-b border-slate-200 dark:border-slate-800 last:border-0">
                        <div className="bg-slate-100 dark:bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                          {category}
                        </div>
                        {items.map((item) => (
                          <div 
                            key={item.id} 
                            onClick={() => handleResultClick(item.link)}
                            className="cursor-pointer px-4 py-3 hover:bg-sky-50 dark:hover:bg-slate-800 transition block"
                          >
                            <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{item.label}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{item.sub}</p>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Notifications, Dark Mode, User Menu */}
        <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0 ml-auto">
          
          {/* Notifications */}
          <div className="relative" ref={notifMenuRef}>
            <button onClick={() => setShowNotifications(!showNotifications)} className="relative p-2.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition shadow-sm">
              <span className="text-lg">🔔</span>
              {unreadCount > 0 && <span className="absolute top-0 right-0 inline-flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-rose-500 rounded-full">{unreadCount}</span>}
            </button>
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex justify-between items-center px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100">Notifications</h3>
                  {unreadCount > 0 && <button onClick={markAllAsRead} className="text-xs font-medium text-sky-500 hover:text-sky-600">Mark all read</button>}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-slate-500">You're all caught up!</div>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {notifications.map((notif) => (
                        <div key={notif.id} className={`px-5 py-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${notif.read ? 'opacity-60' : 'bg-sky-50/50 dark:bg-sky-950/10'}`} onClick={() => !notif.read && markAsRead(notif.id)}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{notif.title}</p>
                              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 font-medium leading-relaxed">{notif.message}</p>
                              <p className="mt-2 text-[10px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase">{formatTimeAgo(notif.createdAt)}</p>
                            </div>
                            {!notif.read && <button onClick={(e) => markAsRead(notif.id, e)} className="h-2.5 w-2.5 mt-1 rounded-full bg-sky-500 shrink-0 shadow-md shadow-sky-500/50" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <button onClick={toggleDarkMode} className="hidden sm:block p-2.5 rounded-full bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition shadow-sm">
            <span className="text-lg">{darkMode ? '☀️' : '🌙'}</span>
          </button>

          <div className="relative" ref={userMenuRef}>
            <button onClick={() => setShowUserMenu(!showUserMenu)} className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-lg hover:shadow-indigo-500/30 transition hover:-translate-y-0.5">
              {user ? user.email[0].toUpperCase() : 'U'}
            </button>
            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100 truncate">{user ? user.email : 'User'}</p>
                  <p className="text-xs text-slate-500 mt-1 capitalize">{userRole}</p>
                </div>
                
                <div className="py-2">
                  <button onClick={toggleDarkMode} className="sm:hidden w-full px-5 py-2.5 text-left text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50">Toggle Dark Mode</button>
                </div>

                <button onClick={handleLogout} className="w-full px-5 py-3 text-left text-sm font-semibold text-rose-500 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 border-t border-slate-200 dark:border-slate-800 transition">Log out out of system</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Search Input */}
      <div className="md:hidden mt-4 flex items-center border border-slate-300 dark:border-slate-700 rounded-full bg-slate-50 dark:bg-slate-900/50 px-4 py-2 text-sm text-slate-500 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-500/20 transition-all">
        <span className="mr-2 text-lg">🔍</span>
        <input
          type="text"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent outline-none w-full text-slate-800 dark:text-slate-100 placeholder-slate-400"
        />
      </div>
    </header>
  )
}

export default Navbar
