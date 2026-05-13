import { useState, useEffect } from 'react'
import Card from '../components/Card'
import { getDocuments } from '../firebase'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from 'recharts'

const weeklySales = [
  { day: 'Mon', sales: 4200 },
  { day: 'Tue', sales: 5300 },
  { day: 'Wed', sales: 4800 },
  { day: 'Thu', sales: 6100 },
  { day: 'Fri', sales: 7300 },
  { day: 'Sat', sales: 6900 },
  { day: 'Sun', sales: 5200 },
]

const hrStaff = [
  { name: 'Ava Nguyen', role: 'Operations Manager', status: 'online' },
  { name: 'Marcus Lee', role: 'HR Coordinator', status: 'online' },
  { name: 'Priya Singh', role: 'Recruiter', status: 'offline' },
  { name: 'Elena Rossi', role: 'Talent Partner', status: 'offline' },
]

const today = new Date().toISOString().slice(0, 10)

const Dashboard = () => {
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    totalStockItems: 0,
    ordersToday: 0,
    totalRevenue: 0,
  })
  const [stockAlerts, setStockAlerts] = useState([])
  const [recentActivities, setRecentActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        setLoading(true)

        // Load customers
        const customers = await getDocuments('customers')
        const totalCustomers = customers?.length || 0

        // Load inventory
        const inventory = await getDocuments('inventory')
        const totalStockItems = inventory?.length || 0
        
        // Get low stock items (qty < 10)
        const lowStockItems = (inventory || [])
          .filter((item) => (item.quantity || 0) < 10)
          .sort((a, b) => (a.quantity || 0) - (b.quantity || 0))
          .slice(0, 4)
          .map((item) => ({
            item: item.name || 'Unknown Item',
            level: (item.quantity || 0) === 0 ? 'Out of stock' : 'Low stock',
            qty: item.quantity || 0,
          }))
        setStockAlerts(lowStockItems)

        // Load sales
        const sales = await getDocuments('sales')
        
        // Count orders today - handle both 'date' and 'createdAt' formats
        const ordersToday = (sales || []).filter((order) => {
          const orderDate = order.date || (order.createdAt ? order.createdAt.slice(0, 10) : null)
          return orderDate === today
        }).length
        
        // Calculate total revenue - exclude cancelled orders
        const totalRevenue = (sales || [])
          .filter((order) => order.status !== 'Cancelled')
          .reduce((sum, order) => sum + (Number(order.amount) || 0), 0)

        // Build recent activities (last 5 from all collections)
        const activities = [];
        
        // Add recent customers
        (customers || []).slice(0, 2).forEach((customer) => {
          activities.push({
            timestamp: customer.createdAt || new Date(),
            time: 'Recently',
            activity: `New customer: ${customer.name || 'Unknown'}`,
            type: 'customer',
          })
        });

        // Add recent inventory
        (inventory || []).slice(0, 2).forEach((item) => {
          activities.push({
            timestamp: item.createdAt || new Date(),
            time: 'Recently',
            activity: `Product added: ${item.name || 'Unknown'} (${item.quantity || 0} units)`,
            type: 'inventory',
          })
        });

        // Add recent orders
        (sales || []).slice(0, 2).forEach((order) => {
          activities.push({
            timestamp: order.createdAt || order.timestamp || new Date(),
            time: 'Recently',
            activity: `Order from ${order.customer || 'Unknown'}: $${(Number(order.amount) || 0).toFixed(2)}`,
            type: 'sales',
          })
        });

        // Sort by timestamp and take last 5
        const sortedActivities = activities
          .sort((a, b) => {
            const timeA = new Date(a.timestamp).getTime()
            const timeB = new Date(b.timestamp).getTime()
            return timeB - timeA
          })
          .slice(0, 5)
          .map((act) => ({
            time: act.time,
            activity: act.activity,
          }))

        setRecentActivities(sortedActivities || [])

        setMetrics({
          totalCustomers,
          totalStockItems,
          ordersToday,
          totalRevenue,
        })
        setError(null)
      } catch (err) {
        console.error('Dashboard error details:', {
          message: err.message,
          code: err.code,
          stack: err.stack
        })
        setError(`Failed to load dashboard data: ${err.message}`)
      } finally {
        setLoading(false)
      }
    }

    loadDashboardData()
  }, [])

  return (
    <section className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl shadow-slate-200/50 dark:shadow-slate-950/20">
        <p className="text-sm font-bold uppercase tracking-[0.3em] text-slate-500">Dashboard</p>
        <h1 className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-slate-100">Executive overview</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400 font-medium">
          Monitor sales, inventory levels, customer activity, and HR pipelines from one place.
        </p>
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-600/20 bg-rose-500/10 p-4 text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 mx-auto mb-4"></div>
            <p className="text-slate-600 dark:text-slate-400">Loading dashboard data...</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <Card 
              title="Revenue" 
              value={`$${metrics.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`} 
              description="Total revenue from all orders." 
              accentColor="#3b82f6"
              change="+14.2%"
              changeType="up"
            />
            <Card 
              title="Orders Today" 
              value={metrics.ordersToday} 
              description="Orders placed today." 
              accentColor="#22c55e"
              change="+5.1%"
              changeType="up"
            />
            <Card 
              title="Stock Items" 
              value={metrics.totalStockItems} 
              description="Total items currently in inventory." 
              accentColor="#f97316"
              change="-2.4%"
              changeType="down"
            />
            <Card 
              title="Active Customers" 
              value={metrics.totalCustomers} 
              description="Total customers in the system." 
              accentColor="#a855f7"
              change="+18.9%"
              changeType="up"
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
            <div className="flex flex-col gap-6">
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/20">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Weekly Sales</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 font-medium">Comparison of sales performance over the last 7 days.</p>
                </div>
                <div className="rounded-2xl bg-sky-50 dark:bg-slate-800/70 px-4 py-2 text-sm font-bold text-sky-600 dark:text-sky-300">
                  +14.2% vs last week
                </div>
              </div>
              <div className="mt-6 h-60 sm:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={weeklySales} margin={{ top: 10, right: 0, left: -12, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={1}/>
                        <stop offset="95%" stopColor="#a855f7" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#334155" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', color: '#f8fafc', borderRadius: '12px', fontWeight: 600 }} />
                    <Bar dataKey="sales" fill="url(#colorSales)" radius={[8, 8, 0, 0]} barSize={40} />
                    <Line type="monotone" dataKey="sales" stroke="#38bdf8" strokeWidth={4} dot={{ r: 4, fill: '#1e293b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            <Card title="Recent Activity" description="Latest events from operations and sales.">
              <div className="space-y-4">
                {recentActivities.length === 0 ? (
                  <p className="text-slate-500 text-sm">No recent activities.</p>
                ) : (
                  recentActivities.map((entry) => (
                    <div key={`${entry.time}-${entry.activity}`} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
                      <p className="text-sm text-slate-500">{entry.time}</p>
                      <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{entry.activity}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
              <Card title="Stock Alerts" description="Items that require immediate attention.">
                <div className="space-y-4">
                  {stockAlerts.length === 0 ? (
                    <p className="text-slate-500 text-sm">All stock levels are healthy.</p>
                  ) : (
                    stockAlerts.map((alert) => (
                      <div key={alert.item} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{alert.item}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{alert.level}</p>
                          </div>
                          <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm text-slate-700 dark:text-slate-300">{alert.qty} left</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card title="HR Staff Status" description="Track who is available right now.">
                <div className="space-y-3">
                  {hrStaff.map((member) => (
                    <div key={member.name} className="flex items-center justify-between rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{member.name}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">{member.role}</p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-sm font-medium ${member.status === 'online' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                        {member.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </div>
      </>
      )}
    </section>
  )
}

export default Dashboard
