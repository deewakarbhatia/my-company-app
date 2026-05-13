import { useMemo, useState, useEffect } from 'react'
import { addDocument, getDocuments, updateDocument, deleteDocument } from '../firebase'
import { useLocation } from 'react-router-dom'

const statusStyle = {
  'In Stock': 'bg-emerald-500/15 text-emerald-300',
  'Low Stock': 'bg-amber-500/15 text-amber-300',
  'Out of Stock': 'bg-rose-500/15 text-rose-300',
}

const getStatusFromQuantity = (quantity) => {
  if (quantity === 0) return 'Out of Stock'
  if (quantity < 10) return 'Low Stock'
  return 'In Stock'
}

const Inventory = () => {
  const [products, setProducts] = useState([])
  const [search, setSearch] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [formValues, setFormValues] = useState({ name: '', sku: '', category: '', quantity: 0, price: 0 })
  const [highlightedId, setHighlightedId] = useState(null)

  const location = useLocation()

  useEffect(() => {
    const searchId = new URLSearchParams(location.search).get('searchId')
    if (searchId) {
      setHighlightedId(searchId)
      setTimeout(() => setHighlightedId(null), 3000)
    }
  }, [location.search])

  // Load products from Firestore on mount
  useEffect(() => {
    const loadProducts = async () => {
      try {
        setLoading(true)
        const data = await getDocuments('inventory')
        setProducts(data)
        setError(null)
      } catch (err) {
        console.error('Error loading inventory:', err)
        setError('Failed to load inventory. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    loadProducts()
  }, [])

  const lowStockProducts = useMemo(
    () => products.filter((product) => product.quantity < 10),
    [products]
  )

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return products

    return products.filter((product) => {
      return (
        product.name.toLowerCase().includes(term) ||
        product.sku.toLowerCase().includes(term) ||
        product.category.toLowerCase().includes(term)
      )
    })
  }, [products, search])

  const openAddModal = () => {
    setEditingProduct(null)
    setFormValues({ name: '', sku: '', category: '', quantity: 0, price: 0 })
    setIsModalOpen(true)
  }

  const openEditModal = (product) => {
    setEditingProduct(product)
    setFormValues({ ...product })
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingProduct(null)
  }

  const handleSaveProduct = async (event) => {
    event.preventDefault()
    const updatedProduct = {
      name: formValues.name,
      sku: formValues.sku,
      category: formValues.category,
      quantity: Number(formValues.quantity),
      price: Number(formValues.price),
    }

    try {
      if (editingProduct) {
        // Update existing product
        await updateDocument('inventory', editingProduct.id, updatedProduct)
        setProducts((current) =>
          current.map((item) =>
            item.id === editingProduct.id ? { ...item, ...updatedProduct } : item
          )
        )
      } else {
        // Add new product
        const docId = await addDocument('inventory', updatedProduct)
        setProducts((current) => [{ id: docId, ...updatedProduct }, ...current])
      }

      // Check for low stock notification
      if (updatedProduct.quantity < 10) {
        await addDocument('notifications', {
          title: 'Low Stock Alert',
          message: `Product "${updatedProduct.name}" has critically low stock (${updatedProduct.quantity} left).`,
          type: 'stock',
          read: false
        })
      }

      closeModal()
      setError(null)
    } catch (err) {
      console.error('Error saving product:', err)
      setError('Failed to save product. Please try again.')
    }
  }

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return

    try {
      await deleteDocument('inventory', productId)
      setProducts((current) => current.filter((product) => product.id !== productId))
      setError(null)
    } catch (err) {
      console.error('Error deleting product:', err)
      setError('Failed to delete product. Please try again.')
    }
  }

  return (
    <section className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Inventory</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">Product inventory</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">Manage products, track stock status, and keep low inventory from slipping through the cracks.</p>
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
            <p className="text-slate-600 dark:text-slate-400">Loading inventory...</p>
          </div>
        </div>
      ) : (
        <>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Low stock alerts</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">{lowStockProducts.length}</p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Products needing attention right now.</p>
        </div>
        {lowStockProducts.slice(0, 2).map((product) => (
          <div key={product.id} className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
            <p className="text-sm text-slate-600 dark:text-slate-400">{product.name}</p>
            <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{product.quantity} left</p>
            <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{product.category}</p>
          </div>
        ))}
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Inventory</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Search products and manage your catalog.</p>
          </div>
          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Add product
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex-1">
            <label className="sr-only" htmlFor="search">Search products</label>
            <input
              id="search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, SKU, or category"
              className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none transition focus:border-sky-500"
            />
          </div>
          <div className="rounded-2xl bg-slate-50/70 dark:bg-slate-950/70 px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
            {filteredProducts.length} products found
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-slate-950/20">
        <div className="overflow-x-auto">
          <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400">
              <tr>
                <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Name</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">SKU</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Category</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Quantity</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Price</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Status</th>
                <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product) => (
                <tr key={product.id} className={`border-t border-slate-200 dark:border-slate-800 transition duration-500 hover:bg-slate-50 dark:bg-slate-950/80 ${highlightedId === product.id ? 'bg-sky-900/40 outline outline-2 outline-sky-500' : ''}`}>
                  <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">{product.name}</td>
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{product.sku}</td>
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{product.category}</td>
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{product.quantity}</td>
                  <td className="px-6 py-4 text-slate-800 dark:text-slate-200">${product.price.toFixed(2)}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[getStatusFromQuantity(product.quantity)]}`}>
                      {getStatusFromQuantity(product.quantity)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 transition hover:bg-slate-100 dark:bg-slate-800"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(product.id)}
                        className="rounded-2xl border border-rose-500 bg-rose-500/10 px-3 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr>
                  <td colSpan="7" className="px-6 py-10 text-center text-slate-500">
                    No matching products were found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl shadow-slate-950/40">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
                  {editingProduct ? 'Edit product' : 'Add product'}
                </h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Update stock information and product details.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2 text-sm text-slate-700 dark:text-slate-300 transition hover:bg-slate-100 dark:bg-slate-800"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Product name
                <input
                  type="text"
                  value={formValues.name}
                  onChange={(event) => setFormValues({ ...formValues, name: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                  required
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                SKU
                <input
                  type="text"
                  value={formValues.sku}
                  onChange={(event) => setFormValues({ ...formValues, sku: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                  required
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Category
                <input
                  type="text"
                  value={formValues.category}
                  onChange={(event) => setFormValues({ ...formValues, category: event.target.value })}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Quantity
                <input
                  type="number"
                  min="0"
                  value={formValues.quantity}
                  onChange={(event) => setFormValues({ ...formValues, quantity: Number(event.target.value) })}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                  required
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Price
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formValues.price}
                  onChange={(event) => setFormValues({ ...formValues, price: Number(event.target.value) })}
                  className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 outline-none focus:border-sky-500"
                  required
                />
              </label>
              <div className="sm:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-5 py-3 text-sm text-slate-800 dark:text-slate-200 transition hover:bg-slate-100 dark:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  Save product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </>
      )}
    </section>
  )
}

export default Inventory
