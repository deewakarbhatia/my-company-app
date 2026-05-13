import { useMemo, useState, useEffect } from 'react'
import { addDocument, getDocuments, updateDocument } from '../firebase'
import { useLocation } from 'react-router-dom'

const statusOptions = ['Pending', 'Completed', 'Shipped', 'Cancelled']
const today = new Date().toISOString().slice(0, 10)

const Sales = () => {
  const [orders, setOrders] = useState([])
  const [filters, setFilters] = useState({ from: '', to: '', status: 'All' })
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [newOrder, setNewOrder] = useState({ id: '', customer: '', date: today, amount: '', status: 'Pending' })
  const [highlightedId, setHighlightedId] = useState(null)

  const location = useLocation()

  useEffect(() => {
    const searchId = new URLSearchParams(location.search).get('searchId')
    if (searchId) {
      setHighlightedId(searchId)
      setTimeout(() => setHighlightedId(null), 3000)
    }
  }, [location.search])

  // Load orders from Firestore on mount
  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true)
        const data = await getDocuments('sales')
        setOrders(data)
        setError(null)
      } catch (err) {
        console.error('Error loading sales:', err)
        setError('Failed to load orders. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    loadOrders()
  }, [])

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = filters.status === 'All' || order.status === filters.status
      const afterFrom = !filters.from || order.date >= filters.from
      const beforeTo = !filters.to || order.date <= filters.to
      return matchesStatus && afterFrom && beforeTo
    })
  }, [orders, filters])

  const totalSalesToday = useMemo(() => {
    return orders
      .filter((order) => order.date === today && order.status !== 'Cancelled')
      .reduce((sum, order) => sum + order.amount, 0)
  }, [orders])

  const handleAddOrder = async (event) => {
    event.preventDefault()
    if (!newOrder.id || !newOrder.customer || !newOrder.amount) return

    try {
      const orderData = {
        id: newOrder.id,
        customer: newOrder.customer,
        date: newOrder.date,
        amount: Number(newOrder.amount),
        status: newOrder.status,
        timestamp: new Date().toISOString(),
      }
      const docId = await addDocument('sales', orderData)
      setOrders((current) => [{ ...orderData, firestoreId: docId }, ...current])
      
      // Create notification
      await addDocument('notifications', {
        title: 'New Order Created',
        message: `Order ${newOrder.id} placed by ${newOrder.customer} for $${newOrder.amount}`,
        type: 'order',
        read: false
      })

      setNewOrder({ id: '', customer: '', date: today, amount: '', status: 'Pending' })
      setIsModalOpen(false)
      setError(null)
    } catch (err) {
      console.error('Error adding order:', err)
      setError('Failed to add order. Please try again.')
    }
  }

  const handleStatusChange = async (orderId, newStatus) => {
    try {
      await updateDocument('sales', orderId, { status: newStatus })
      setOrders((current) =>
        current.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      )
      setError(null)
    } catch (err) {
      console.error('Error updating order status:', err)
      setError('Failed to update order status. Please try again.')
    }
  }

  return (
    <section className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Sales</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">Order management</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">Track orders, filter by date and status, and create new sales from one central view.</p>
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
            <p className="text-slate-600 dark:text-slate-400">Loading orders...</p>
          </div>
        </div>
      ) : (
        <>
      <div className="grid gap-6 md:grid-cols-[1.5fr_1fr]">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
          <p className="text-sm text-slate-600 dark:text-slate-400">Total sales today</p>
          <p className="mt-3 text-4xl font-semibold text-slate-900 dark:text-slate-100">${totalSalesToday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="mt-2 text-sm text-slate-500">Based on orders dated {today}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Filters</h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Filter the order list by date range and status.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
            >
              New order
            </button>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-sm text-slate-700 dark:text-slate-300">From</span>
              <input
                type="date"
                value={filters.from}
                onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-sky-500"
              />
            </label>
            <label className="block">
              <span className="text-sm text-slate-700 dark:text-slate-300">To</span>
              <input
                type="date"
                value={filters.to}
                onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-sky-500"
              />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm text-slate-700 dark:text-slate-300">Status</span>
              <select
                value={filters.status}
                onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
                className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-sky-500"
              >
                <option value="All">All</option>
                {statusOptions.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-slate-950/20">
        <div className="flex flex-col gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">All orders</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">Showing {filteredOrders.length} orders matching your filter.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 px-4 py-2 text-sm text-slate-900 dark:text-slate-100 transition hover:bg-slate-700"
          >
            Create new order
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/80">
              <tr>
                <th className="px-6 py-4 text-slate-600 dark:text-slate-400">Order ID</th>
                <th className="px-6 py-4 text-slate-600 dark:text-slate-400">Customer</th>
                <th className="px-6 py-4 text-slate-600 dark:text-slate-400">Date</th>
                <th className="px-6 py-4 text-slate-600 dark:text-slate-400">Amount</th>
                <th className="px-6 py-4 text-slate-600 dark:text-slate-400">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((order) => (
                <tr key={order.id} className={`border-t border-slate-200 dark:border-slate-800 transition duration-500 hover:bg-slate-50 dark:bg-slate-950/80 ${highlightedId === order.id ? 'bg-sky-900/40 outline outline-2 outline-sky-500' : ''}`}>
                  <td className="px-6 py-4 text-slate-900 dark:text-slate-100">{order.id}</td>
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{order.customer}</td>
                  <td className="px-6 py-4 text-slate-700 dark:text-slate-300">{order.date}</td>
                  <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100">${order.amount.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusChange(order.id, e.target.value)}
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold border-0 outline-none cursor-pointer ${
                        order.status === 'Completed'
                          ? 'bg-emerald-500/15 text-emerald-300'
                          : order.status === 'Pending'
                          ? 'bg-amber-500/15 text-amber-300'
                          : order.status === 'Shipped'
                          ? 'bg-sky-500/15 text-sky-300'
                          : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {filteredOrders.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                    No orders match the selected filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl shadow-slate-950/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Create a new order</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Add a dummy order for testing the dashboard and sales workflow.</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:bg-slate-800"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleAddOrder} className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm text-slate-700 dark:text-slate-300">Order ID</span>
                <input
                  type="text"
                  value={newOrder.id}
                  onChange={(e) => setNewOrder((prev) => ({ ...prev, id: e.target.value }))}
                  placeholder="SO-1898"
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
              <label className="block">
                <span className="text-sm text-slate-700 dark:text-slate-300">Customer</span>
                <input
                  type="text"
                  value={newOrder.customer}
                  onChange={(e) => setNewOrder((prev) => ({ ...prev, customer: e.target.value }))}
                  placeholder="Jordan Bell"
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
              <label className="block">
                <span className="text-sm text-slate-700 dark:text-slate-300">Date</span>
                <input
                  type="date"
                  value={newOrder.date}
                  onChange={(e) => setNewOrder((prev) => ({ ...prev, date: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
              <label className="block">
                <span className="text-sm text-slate-700 dark:text-slate-300">Amount</span>
                <input
                  type="number"
                  step="0.01"
                  value={newOrder.amount}
                  onChange={(e) => setNewOrder((prev) => ({ ...prev, amount: e.target.value }))}
                  placeholder="499.99"
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-sm text-slate-700 dark:text-slate-300">Status</span>
                <select
                  value={newOrder.status}
                  onChange={(e) => setNewOrder((prev) => ({ ...prev, status: e.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                >
                  {statusOptions.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 dark:border-slate-700 px-4 py-3 text-sm text-slate-800 dark:text-slate-200 transition hover:bg-slate-100 dark:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  Add order
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
      </>
      )}
    </section>
  )
}

export default Sales
