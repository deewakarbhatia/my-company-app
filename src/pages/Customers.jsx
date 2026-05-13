import { useMemo, useState, useEffect } from 'react'
import { addDocument, getDocuments, updateDocument, deleteDocument } from '../firebase'
import { useLocation } from 'react-router-dom'

const Customers = () => {
  const [customers, setCustomers] = useState([])
  const [search, setSearch] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formValues, setFormValues] = useState({ name: '', email: '', phone: '', purchases: 0, totalSpent: 0 })

  const location = useLocation()

  useEffect(() => {
    const searchId = new URLSearchParams(location.search).get('searchId')
    if (searchId && customers.length > 0) {
      const found = customers.find(c => c.id === searchId)
      if (found) setSelectedCustomer(found)
    }
  }, [location.search, customers])

  // Load customers from Firestore on mount
  useEffect(() => {
    const loadCustomers = async () => {
      try {
        setLoading(true)
        const data = await getDocuments('customers')
        setCustomers(data)
        setError(null)
      } catch (err) {
        console.error('Error loading customers:', err)
        setError('Failed to load customers. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    loadCustomers()
  }, [])

  const filteredCustomers = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return customers

    return customers.filter(
      (customer) =>
        customer.name.toLowerCase().includes(term) ||
        customer.email.toLowerCase().includes(term) ||
        customer.phone.includes(term)
    )
  }, [customers, search])

  const openAddModal = () => {
    setFormValues({ name: '', email: '', phone: '', purchases: 0, totalSpent: 0 })
    setIsEditing(false)
    setIsAddModalOpen(true)
  }

  const openEditModal = (customer) => {
    setFormValues({
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      purchases: customer.purchases || 0,
      totalSpent: customer.totalSpent || 0
    })
    setIsEditing(true)
    setIsAddModalOpen(true)
  }

  const closeAddModal = () => {
    setIsAddModalOpen(false)
    setIsEditing(false)
  }

  const handleAddCustomer = async (event) => {
    event.preventDefault()
    if (!formValues.name || !formValues.email || !formValues.phone) return

    try {
      const newCustomer = {
        name: formValues.name,
        email: formValues.email,
        phone: formValues.phone,
        purchases: Number(formValues.purchases),
        totalSpent: Number(formValues.totalSpent),
        lastPurchase: new Date().toISOString().slice(0, 10),
      }
      const docId = await addDocument('customers', newCustomer)
      setCustomers((current) => [{ id: docId, ...newCustomer }, ...current])
      
      // Create notification for new customer
      await addDocument('notifications', {
        title: 'New Customer',
        message: `${newCustomer.name} was added to the database.`,
        type: 'customer',
        read: false
      })

      closeAddModal()
      setError(null)
    } catch (err) {
      console.error('Error adding customer:', err)
      setError('Failed to add customer. Please try again.')
    }
  }

  const handleUpdateCustomer = async (event) => {
    event.preventDefault()
    if (!formValues.name || !formValues.email || !formValues.phone) return

    try {
      const updatedData = {
        name: formValues.name,
        email: formValues.email,
        phone: formValues.phone,
        purchases: Number(formValues.purchases),
        totalSpent: Number(formValues.totalSpent),
      }
      await updateDocument('customers', selectedCustomer.id, updatedData)
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === selectedCustomer.id
            ? { ...customer, ...updatedData }
            : customer
        )
      )
      setSelectedCustomer((current) => ({ ...current, ...updatedData }))
      closeAddModal()
      setError(null)
    } catch (err) {
      console.error('Error updating customer:', err)
      setError('Failed to update customer. Please try again.')
    }
  }

  const handleDeleteCustomer = async () => {
    if (!selectedCustomer || !window.confirm('Are you sure you want to delete this customer?')) return

    try {
      await deleteDocument('customers', selectedCustomer.id)
      setCustomers((current) => current.filter((customer) => customer.id !== selectedCustomer.id))
      setSelectedCustomer(null)
      setError(null)
    } catch (err) {
      console.error('Error deleting customer:', err)
      setError('Failed to delete customer. Please try again.')
    }
  }

  return (
    <section className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Customers</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">Customer database</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">Manage customer information, track purchases, and monitor customer engagement.</p>
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
            <p className="text-slate-600 dark:text-slate-400">Loading customers...</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
          <div className="space-y-6">
          <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Customers</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Showing {filteredCustomers.length} customer(s)</p>
              </div>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
              >
                Add customer
              </button>
            </div>

            <label className="mt-6 block">
              <span className="sr-only">Search customers</span>
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, or phone"
                className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-sky-500"
              />
            </label>
          </div>

          <div className="space-y-3">
            {filteredCustomers.map((customer) => (
              <button
                key={customer.id}
                type="button"
                onClick={() => setSelectedCustomer(customer)}
                className={`w-full rounded-3xl border-2 p-4 text-left transition ${
                  selectedCustomer?.id === customer.id
                    ? 'border-sky-500 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-sky-500/10'
                    : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 hover:bg-white/80 dark:bg-slate-900/80'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{customer.name}</p>
                    <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{customer.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{customer.phone}</p>
                  </div>
                  <span className="rounded-2xl bg-slate-100 dark:bg-slate-800 px-3 py-1 text-sm font-medium text-slate-800 dark:text-slate-200">{customer.purchases} purchases</span>
                </div>
              </button>
            ))}
            {filteredCustomers.length === 0 && (
              <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 text-center">
                <p className="text-slate-600 dark:text-slate-400">No customers match your search.</p>
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block">
          {selectedCustomer ? (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
              <div>
                <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Customer Details</p>
                <h3 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">{selectedCustomer.name}</h3>
              </div>

              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">Email</p>
                  <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">{selectedCustomer.email}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">Phone</p>
                  <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">{selectedCustomer.phone}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">Total Purchases</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{selectedCustomer.purchases}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">Total Spent</p>
                  <p className="mt-2 text-2xl font-semibold text-emerald-300">${selectedCustomer.totalSpent.toLocaleString()}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
                  <p className="text-xs text-slate-500">Last Purchase</p>
                  <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">{new Date(selectedCustomer.lastPurchase).toLocaleDateString()}</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedCustomer)}
                    className="flex-1 rounded-2xl border border-sky-600 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-500/20"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteCustomer}
                    className="flex-1 rounded-2xl border border-rose-600 bg-rose-500/10 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/20"
                  >
                    Delete
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCustomer(null)}
                  className="mt-3 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2 text-sm text-slate-800 dark:text-slate-200 transition hover:bg-slate-100 dark:bg-slate-800"
                >
                  Clear selection
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-8 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">Select a customer to view details.</p>
            </div>
          )}
        </div>
      </div>
      )}

      {selectedCustomer && (
        <div className="lg:hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Customer Details</p>
            <h3 className="mt-3 text-2xl font-semibold text-slate-900 dark:text-slate-100">{selectedCustomer.name}</h3>
          </div>
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Email</p>
              <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">{selectedCustomer.email}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Phone</p>
              <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">{selectedCustomer.phone}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Total Purchases</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{selectedCustomer.purchases}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Total Spent</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-300">${selectedCustomer.totalSpent.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 p-4">
              <p className="text-xs text-slate-500">Last Purchase</p>
              <p className="mt-2 text-sm text-slate-900 dark:text-slate-100">{new Date(selectedCustomer.lastPurchase).toLocaleDateString()}</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => openEditModal(selectedCustomer)}
                className="flex-1 rounded-2xl border border-sky-600 bg-sky-500/10 px-4 py-2 text-sm text-sky-300 transition hover:bg-sky-500/20"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={handleDeleteCustomer}
                className="flex-1 rounded-2xl border border-rose-600 bg-rose-500/10 px-4 py-2 text-sm text-rose-300 transition hover:bg-rose-500/20"
              >
                Delete
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSelectedCustomer(null)}
              className="mt-3 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2 text-sm text-slate-800 dark:text-slate-200 transition hover:bg-slate-100 dark:bg-slate-800"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}

      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl shadow-slate-950/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{isEditing ? 'Edit customer' : 'Add customer'}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{isEditing ? 'Update customer information.' : 'Create a new customer record in the database.'}</p>
              </div>
              <button
                type="button"
                onClick={closeAddModal}
                className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:bg-slate-800"
              >
                Close
              </button>
            </div>

            <form onSubmit={isEditing ? handleUpdateCustomer : handleAddCustomer} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Name
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                  required
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Email
                <input
                  type="email"
                  value={formValues.email}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, email: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                  required
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Phone
                <input
                  type="tel"
                  value={formValues.phone}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, phone: event.target.value }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                  required
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Total Purchases
                <input
                  type="number"
                  min="0"
                  value={formValues.purchases}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, purchases: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Total Spent
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formValues.totalSpent}
                  onChange={(event) => setFormValues((prev) => ({ ...prev, totalSpent: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
              <div className="sm:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-5 py-3 text-sm text-slate-800 dark:text-slate-200 transition hover:bg-slate-100 dark:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  {isEditing ? 'Update customer' : 'Add customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  )
}

export default Customers
