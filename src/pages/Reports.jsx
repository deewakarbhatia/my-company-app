import { useState, useEffect, useMemo } from 'react'
import { getDocuments } from '../firebase'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts'

const COLORS = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb7185']

// Time utilities
const today = new Date()
const startOfWeek = new Date(today)
startOfWeek.setDate(today.getDate() - today.getDay()) // Sunday
const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
const startOfYear = new Date(today.getFullYear(), 0, 1)

const getMonthName = (dateStr) => {
  const d = new Date(dateStr)
  return d.toLocaleString('default', { month: 'short' })
}

const Reports = () => {
  const [sales, setSales] = useState([])
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('This Year')

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const salesData = await getDocuments('sales')
        const customersData = await getDocuments('customers')
        setSales(salesData || [])
        setCustomers(customersData || [])
      } catch (err) {
        console.error('Error fetching data for reports:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handlePrint = () => {
    window.print()
  }

  // Filter Sales based on Dropdown
  const filteredSales = useMemo(() => {
    return sales.filter((s) => {
      if (!s.date && !s.createdAt) return false
      const sDate = new Date(s.date || s.createdAt)
      if (dateRange === 'This Week') return sDate >= startOfWeek
      if (dateRange === 'This Month') return sDate >= startOfMonth
      if (dateRange === 'This Year') return sDate >= startOfYear
      return true
    }).filter(s => s.status !== 'Cancelled')
  }, [sales, dateRange])

  // Chart 1: Sales Over Time (Monthly if Year, Daily if Week/Month)
  const salesOverTime = useMemo(() => {
    const grouped = {}
    filteredSales.forEach((s) => {
      const d = new Date(s.date || s.createdAt)
      let key = ''
      if (dateRange === 'This Year') {
        key = d.toLocaleString('default', { month: 'short' })
      } else if (dateRange === 'This Month') {
        key = `Day ${d.getDate()}`
      } else {
        key = d.toLocaleString('default', { weekday: 'short' })
      }
      grouped[key] = (grouped[key] || 0) + (Number(s.amount) || 0)
    })

    // If 'This Year', ensure we show at least last 6 months or all months with data
    const result = Object.keys(grouped).map(k => ({ name: k, sales: grouped[k] }))
    return result
  }, [filteredSales, dateRange])

  // Chart 2: Top 5 Customers by Revenue
  const topCustomers = useMemo(() => {
    const grouped = {}
    filteredSales.forEach((s) => {
      const name = s.customer || 'Unknown'
      grouped[name] = (grouped[name] || 0) + (Number(s.amount) || 0)
    })
    return Object.entries(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5)
  }, [filteredSales])

  // Chart 3: Customer Growth Line Chart
  const customerGrowth = useMemo(() => {
    // We'll calculate cumulative customers up to each point in time based on the active range
    const grouped = {}
    
    // Sort all customers by date to build a chronological timeline
    const sortedCustomers = [...customers].sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt.toDate ? a.createdAt.toDate() : a.createdAt) : new Date(0);
      const dateB = b.createdAt ? new Date(b.createdAt.toDate ? b.createdAt.toDate() : b.createdAt) : new Date(0);
      return dateA - dateB;
    });

    let cumulative = 0;
    
    // For simplicity, we just plot them linearly if they don't have good timestamps,
    // or by their created month.
    sortedCustomers.forEach(c => {
      cumulative += 1;
      const d = c.createdAt ? new Date(c.createdAt.toDate ? c.createdAt.toDate() : c.createdAt) : new Date()
      let key = ''
      if (dateRange === 'This Year') {
        key = d.toLocaleString('default', { month: 'short' })
      } else if (dateRange === 'This Month') {
        key = `Day ${d.getDate()}`
      } else {
        key = d.toLocaleString('default', { weekday: 'short' })
      }
      // Overwrite with the latest cumulative count for that period
      grouped[key] = cumulative
    })

    // Formatting for Recharts
    return Object.keys(grouped).map(k => ({ name: k, customers: grouped[k] }))
  }, [customers, dateRange])

  // Chart 4: Revenue vs Target
  const revenueVsTarget = useMemo(() => {
    const grouped = {}
    filteredSales.forEach((s) => {
      const d = new Date(s.date || s.createdAt)
      let key = ''
      if (dateRange === 'This Year') {
        key = d.toLocaleString('default', { month: 'short' })
      } else if (dateRange === 'This Month') {
        key = `Week ${Math.ceil(d.getDate() / 7)}`
      } else {
        key = d.toLocaleString('default', { weekday: 'short' })
      }
      grouped[key] = (grouped[key] || 0) + (Number(s.amount) || 0)
    })

    const targetVal = dateRange === 'This Year' ? 5000 : dateRange === 'This Month' ? 1500 : 500;

    return Object.keys(grouped).map(k => ({ 
      name: k, 
      revenue: grouped[k],
      target: targetVal 
    }))
  }, [filteredSales, dateRange])

  // Recharts styling tooltips
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900/95 p-4 shadow-xl">
          <p className="mb-2 font-semibold text-slate-800 dark:text-slate-200">{label}</p>
          {payload.map((entry, index) => (
            <p key={`item-${index}`} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.name === 'customers' ? entry.value : `$${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <section className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 print:p-0 print:m-0 print:bg-white print:text-slate-900 absolute w-full inset-0 overflow-auto bg-slate-50 dark:bg-slate-950 text-slate-50 print:block">
      
      {/* Header - Hide buttons when printing */}
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20 sm:flex-row sm:items-center sm:justify-between print:border-slate-200 print:bg-white print:shadow-none">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500 print:text-slate-600 dark:text-slate-400">Reports</p>
          <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100 print:text-slate-900">Performance insights</h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400 print:text-slate-500">Analyze metrics, export reports, and track business trends.</p>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row print:hidden">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2.5 text-sm font-medium text-slate-800 dark:text-slate-200 outline-none transition focus:border-sky-500"
          >
            <option value="This Week">This Week</option>
            <option value="This Month">This Month</option>
            <option value="This Year">This Year</option>
          </select>
          <button
            onClick={handlePrint}
            className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Export to PDF
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto"></div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          
          {/* Chart 1: Sales Over Time */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl print:border-slate-300 print:bg-white print:shadow-none print:break-inside-avoid">
            <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-slate-100 print:text-slate-800">Sales Overview</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <BarChart data={salesOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="sales" name="Sales" fill="#38bdf8" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 2: Top Customers (Replaced Products Pie) */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl print:border-slate-300 print:bg-white print:shadow-none print:break-inside-avoid">
            <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-slate-100 print:text-slate-800">Top 5 Customers by Revenue</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <PieChart margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <Pie
                    data={topCustomers}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {topCustomers.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '12px', color: '#cbd5e1' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Customer Growth */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl print:border-slate-300 print:bg-white print:shadow-none print:break-inside-avoid">
            <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-slate-100 print:text-slate-800">Customer Growth</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <LineChart data={customerGrowth} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="customers" name="customers" stroke="#c084fc" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 4: Revenue vs Target */}
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl print:border-slate-300 print:bg-white print:shadow-none print:break-inside-avoid">
            <h2 className="mb-6 text-lg font-semibold text-slate-900 dark:text-slate-100 print:text-slate-800">Revenue vs Target</h2>
            <div className="h-72 w-full">
              <ResponsiveContainer>
                <ComposedChart data={revenueVsTarget} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#94a3b8" tick={{ fill: '#94a3b8' }} axisLine={false} tickLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '13px' }} />
                  <Bar dataKey="revenue" name="Actual Revenue" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={30} />
                  <Line type="step" dataKey="target" name="Target Goal" stroke="#f472b6" strokeWidth={3} dot={false} strokeDasharray="5 5" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>
      )}
    </section>
  )
}

export default Reports
