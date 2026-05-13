import { useState, useEffect } from 'react'
import { getDocuments, addDocument } from '../firebase'
import { useLocation } from 'react-router-dom'

const statusClasses = {
  Paid: 'bg-emerald-500/15 text-emerald-500',
  Pending: 'bg-amber-500/15 text-amber-500',
  Overdue: 'bg-rose-500/15 text-rose-500',
  Cancelled: 'bg-slate-500/15 text-slate-500',
}

const Invoices = () => {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [highlightedId, setHighlightedId] = useState(null)
  const location = useLocation()

  // Modal States
  const [isBillModalOpen, setIsBillModalOpen] = useState(false)
  const [billValues, setBillValues] = useState({ customer: '', amount: '', status: 'Pending', description: '' })
  
  const [printInvoiceData, setPrintInvoiceData] = useState(null) // null means Print modal is closed

  useEffect(() => {
    const searchId = new URLSearchParams(location.search).get('searchId')
    if (searchId) {
      setHighlightedId(searchId)
      setTimeout(() => setHighlightedId(null), 3000)
    }
  }, [location.search])

  const fetchInvoices = async () => {
    setLoading(true)
    try {
      const salesData = await getDocuments('sales') || []
      const manualBills = await getDocuments('manual_invoices') || []
      
      // Transform sales auto-invoices
      const autoInvoices = salesData.map(sale => {
        let invoiceStatus = 'Pending'
        if (sale.status === 'Completed') invoiceStatus = 'Paid'
        if (sale.status === 'Processing') invoiceStatus = 'Pending'
        if (sale.status === 'Cancelled') invoiceStatus = 'Cancelled'
        
        return {
          id: sale.id, 
          invoiceId: sale.id.replace('ORD-', 'INV-'),
          customer: sale.customer,
          date: sale.date || (sale.createdAt ? sale.createdAt.substring(0, 10) : 'N/A'),
          amount: sale.amount || 0,
          status: invoiceStatus,
          type: 'Auto (Sale)',
          description: 'Store product transaction.'
        }
      })

      // Format manual bills
      const formattedManuals = manualBills.map(bill => {
        let parsedDate = 'N/A';
        if (bill.createdAt) {
          if (typeof bill.createdAt === 'string') parsedDate = bill.createdAt.substring(0, 10);
          else if (bill.createdAt.toDate) parsedDate = bill.createdAt.toDate().toISOString().substring(0, 10);
          else if (bill.createdAt.seconds) parsedDate = new Date(bill.createdAt.seconds * 1000).toISOString().substring(0, 10);
          else parsedDate = new Date(bill.createdAt).toISOString().substring(0, 10);
        }

        return {
          id: bill.id,
          invoiceId: bill.invoiceId || bill.id.replace('DOC-', 'BIL-').substring(0, 12),
          customer: bill.customer,
          date: parsedDate,
          amount: bill.amount || 0,
          status: bill.status || 'Pending',
          type: 'Manual',
          description: bill.description || 'Custom service billing.'
        };
      })
      
      const combined = [...autoInvoices, ...formattedManuals]
      combined.sort((a, b) => new Date(b.date) - new Date(a.date))
      setInvoices(combined)
    } catch (err) {
      console.error('Failed to load invoices:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchInvoices()
  }, [])

  const handleBillSubmit = async (e) => {
    e.preventDefault()
    if (!billValues.customer || !billValues.amount) return

    try {
      const docId = await addDocument('manual_invoices', {
        ...billValues,
        amount: parseFloat(billValues.amount),
        invoiceId: `BIL-${Math.floor(Math.random() * 90000) + 10000}`,
        createdAt: new Date().toISOString()
      })
      setIsBillModalOpen(false)
      setBillValues({ customer: '', amount: '', status: 'Pending', description: '' })
      await fetchInvoices() // Refresh list
    } catch (err) {
      console.error('Failed to create manual bill:', err)
    }
  }

  const exportToCSV = () => {
    if (invoices.length === 0) return
    const headers = ['Invoice ID', 'Type', 'Customer', 'Date', 'Amount', 'Status', 'Description']
    const rows = invoices.map(inv => [
      inv.invoiceId || '',
      inv.type || '',
      inv.customer || '',
      inv.date || '',
      inv.amount || 0,
      inv.status || '',
      inv.description || ''
    ])
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `invoices_${new Date().toISOString().slice(0,10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <section className="space-y-8 px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* CSS For Printing */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 2rem; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Clean Page Header (No Box) */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Billing & Invoices</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">Manage store invoices and generate custom bills for independent clients.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={exportToCSV} className="inline-flex items-center justify-center rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 px-4 py-2 font-semibold text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-800 shadow-sm">
            Export CSV
          </button>
          <button 
            onClick={() => setIsBillModalOpen(true)}
            className="inline-flex items-center justify-center rounded-xl bg-sky-500 px-5 py-2 font-bold text-white transition hover:bg-sky-400 shadow-md shadow-sky-500/20"
          >
            + Create Bill
          </button>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-lg shadow-slate-200/40 dark:shadow-slate-950/20 overflow-hidden">
        {loading ? (
          <div className="py-24 flex justify-center">
             <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[11px]">Document</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[11px]">Customer</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[11px]">Date</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[11px] text-right">Amount</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[11px] text-center">Status</th>
                  <th className="px-6 py-4 font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest text-[11px] text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan="6" className="py-16 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <div className="h-16 w-16 mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-3xl">📄</div>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">No invoices yet</h3>
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm">When you process a sale or create a manual bill, it will appear chronologically here.</p>
                      </div>
                    </td>
                  </tr>
                )}
                {invoices.map((invoice) => (
                  <tr 
                    key={invoice.id} 
                    className={`transition duration-200 ${
                      highlightedId === invoice.id 
                      ? 'bg-sky-50/50 dark:bg-sky-900/10' 
                      : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/20'
                    }`}
                  >
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900 dark:text-slate-100 tracking-tight">{invoice.invoiceId}</span>
                      <br/><span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{invoice.type}</span>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-700 dark:text-slate-300">{invoice.customer}</td>
                    <td className="px-6 py-4 text-slate-500 dark:text-slate-400">{invoice.date}</td>
                    <td className="px-6 py-4 font-bold text-slate-900 dark:text-slate-100 text-right">
                      ${Number(invoice.amount).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase ${statusClasses[invoice.status] || statusClasses.Pending}`}>
                        {invoice.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setPrintInvoiceData(invoice)}
                        className="text-sky-600 dark:text-sky-400 font-bold hover:text-sky-700 dark:hover:text-sky-300 transition"
                      >
                        Print PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE BILL MODAL */}
      {isBillModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4 py-6">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-6">
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Create Custom Bill</h2>
              <button onClick={() => setIsBillModalOpen(false)} className="rounded-2xl bg-slate-100 dark:bg-slate-800 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition">Close</button>
            </div>
            <form onSubmit={handleBillSubmit} className="space-y-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Client / Customer Name
                <input type="text" placeholder="John Doe Services" value={billValues.customer} onChange={e => setBillValues({...billValues, customer: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500" required />
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Amount ($)
                  <input type="number" step="0.01" value={billValues.amount} onChange={e => setBillValues({...billValues, amount: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500" required />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Initial Status
                  <select value={billValues.status} onChange={e => setBillValues({...billValues, status: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500">
                    <option value="Paid">Paid</option>
                    <option value="Pending">Pending</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </label>
              </div>

              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Description
                <input type="text" placeholder="Design Consultation Fee" value={billValues.description} onChange={e => setBillValues({...billValues, description: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500" required />
              </label>
              <div className="flex justify-end pt-4">
                <button type="submit" className="rounded-2xl bg-sky-500 px-6 py-3 text-sm font-bold text-slate-950 hover:bg-sky-400 transition w-full sm:w-auto shadow-lg shadow-sky-500/30">Generate Bill</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT INVOICE MODAL (Overlay) */}
      {printInvoiceData && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 print-area overflow-hidden">
          <div className="w-full max-w-3xl h-[90vh] sm:h-auto sm:max-h-[85vh] bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col flex-shrink-0 animate-in fade-in slide-in-from-bottom-4">
            
            {/* Top Toolbar (No Print) */}
            <div className="no-print bg-slate-100 border-b border-slate-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-800">Print Preview preview mode</h3>
              <div className="flex gap-3">
                <button onClick={() => setPrintInvoiceData(null)} className="rounded-xl bg-slate-200 text-slate-700 px-4 py-2 font-bold text-sm hover:bg-slate-300 transition">Cancel</button>
                <button onClick={() => window.print()} className="rounded-xl bg-sky-500 text-slate-950 px-5 py-2 font-bold text-sm hover:bg-sky-400 transition shadow-md flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                  Print PDF
                </button>
              </div>
            </div>

            {/* Actual Printable Page content */}
            <div className="bg-white p-12 text-slate-900 overflow-y-auto flex-grow h-full custom-scrollbar">
              <div className="flex justify-between items-start border-b-2 border-slate-200 pb-8 mb-8">
                <div>
                  <h1 className="text-4xl font-extrabold tracking-tight text-sky-600 mb-2">INVOICE</h1>
                  <p className="text-sm font-bold text-slate-500 uppercase tracking-widest">{printInvoiceData.invoiceId}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold bg-gradient-to-r from-sky-500 to-indigo-500 bg-clip-text text-transparent">My Company</h2>
                  <p className="text-sm text-slate-500 mt-1">123 Business Avenue<br/>Suite 100<br/>Enterprise City, EC 90210</p>
                </div>
              </div>

              <div className="flex justify-between items-end mb-12">
                <div>
                  <p className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To</p>
                  <h3 className="text-xl font-bold text-slate-800">{printInvoiceData.customer}</h3>
                  <p className="text-sm text-slate-500 mt-1">{printInvoiceData.type} Account</p>
                </div>
                <div className="text-right">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <span className="font-bold text-slate-500">Date Issued:</span>
                    <span className="font-bold text-slate-900">{printInvoiceData.date}</span>
                    <span className="font-bold text-slate-500">Status:</span>
                    <span className={`font-bold uppercase ${printInvoiceData.status === 'Paid' ? 'text-emerald-500' : 'text-slate-900'}`}>{printInvoiceData.status}</span>
                  </div>
                </div>
              </div>

              <table className="w-full mb-12">
                <thead>
                  <tr className="border-b-2 border-slate-900">
                    <th className="py-3 text-left font-bold text-sm uppercase tracking-wider">Description</th>
                    <th className="py-3 text-right font-bold text-sm uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-slate-200">
                    <td className="py-6 min-h-[100px] text-slate-800 font-medium">
                      {printInvoiceData.description}
                    </td>
                    <td className="py-6 text-right font-bold text-slate-900">${Number(printInvoiceData.amount).toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-64">
                  <div className="flex justify-between py-3 text-sm border-b border-slate-200">
                    <span className="font-bold text-slate-500">Subtotal</span>
                    <span className="font-bold text-slate-900">${Number(printInvoiceData.amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-3 text-sm border-b border-slate-200">
                    <span className="font-bold text-slate-500">Tax (0%)</span>
                    <span className="font-bold text-slate-900">$0.00</span>
                  </div>
                  <div className="flex justify-between py-4 text-xl border-b-4 border-slate-900">
                    <span className="font-extrabold text-slate-900">TOTAL</span>
                    <span className="font-extrabold text-sky-600">${Number(printInvoiceData.amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="mt-16 pt-8 text-center text-sm font-medium text-slate-400 border-t border-slate-200">
                <p>Thank you for doing business with us!</p>
                <p className="mt-1">For payment inquiries, contact billing@mycompany.com</p>
              </div>
            </div>
            
          </div>
        </div>
      )}

    </section>
  )
}

export default Invoices
