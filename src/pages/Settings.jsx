import { useState, useEffect } from 'react'
import { auth, db, getDocuments, updateDocument, addDocument } from '../firebase'
import { doc, setDoc } from 'firebase/firestore'
import { updatePassword } from 'firebase/auth'

const TABS = ['Company Profile', 'Security', 'User Management', 'Preferences', 'Data Management']

const Settings = () => {
  const [activeTab, setActiveTab] = useState('Company Profile')
  
  // States
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState({ type: '', message: '' })
  
  const [settingsDocId, setSettingsDocId] = useState(null)
  const [companyParams, setCompanyParams] = useState({ name: '', phone: '', address: '', logoUrl: '' })
  const [prefParams, setPrefParams] = useState({ currency: '$', dateFormat: 'YYYY-MM-DD' })
  
  const [passwordParams, setPasswordParams] = useState({ newPassword: '', confirmPassword: '' })
  const [users, setUsers] = useState([])
  const [importTarget, setImportTarget] = useState('employees')
  const [importStats, setImportStats] = useState(null)

  // Load Initial Data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        // Fetch users
        const usersData = await getDocuments('users')
        setUsers(usersData || [])

        // Fetch settings (we assume a single document holds all configurations)
        const settingsData = await getDocuments('settings')
        if (settingsData && settingsData.length > 0) {
          const doc = settingsData[0]
          setSettingsDocId(doc.id)
          if (doc.company) setCompanyParams(doc.company)
          if (doc.preferences) setPrefParams(doc.preferences)
        }
      } catch (err) {
        console.error('Error fetching settings:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const displayMessage = (type, message) => {
    setSaveStatus({ type, message })
    setTimeout(() => setSaveStatus({ type: '', message: '' }), 5000)
  }

  // Save Settings wrapper
  const handleSaveSettings = async (field, data) => {
    try {
      if (settingsDocId) {
        await updateDocument('settings', settingsDocId, { [field]: data })
      } else {
        // Instead of collection, let's use a hardcoded doc ID "global"
        const globalRef = doc(db, 'settings', 'global')
        await setDoc(globalRef, { [field]: data })
        setSettingsDocId('global')
      }
      displayMessage('success', 'Settings saved successfully.')
    } catch (err) {
      console.error(err)
      displayMessage('error', 'Failed to save settings.')
    }
  }

  // Form Handlers
  const saveCompanyProfile = (e) => {
    e.preventDefault()
    handleSaveSettings('company', companyParams)
  }

  const savePreferences = (e) => {
    e.preventDefault()
    handleSaveSettings('preferences', prefParams)
  }

  const changePassword = async (e) => {
    e.preventDefault()
    if (passwordParams.newPassword !== passwordParams.confirmPassword) {
      displayMessage('error', 'Passwords do not match.')
      return
    }
    if (passwordParams.newPassword.length < 6) {
      displayMessage('error', 'Password must be at least 6 characters.')
      return
    }

    try {
      await updatePassword(auth.currentUser, passwordParams.newPassword)
      displayMessage('success', 'Password updated successfully.')
      setPasswordParams({ newPassword: '', confirmPassword: '' })
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/requires-recent-login') {
        displayMessage('error', 'Please log out and log back in to change your password for security reasons.')
      } else {
        displayMessage('error', 'Failed to update password. Try again later.')
      }
    }
  }

  const updateUserRole = async (userId, newRole) => {
    try {
      await updateDocument('users', userId, { role: newRole })
      setUsers(current => current.map(u => u.id === userId ? { ...u, role: newRole } : u))
      displayMessage('success', 'User role updated.')
    } catch (err) {
      console.error(err)
      displayMessage('error', 'Failed to update user role.')
    }
  }

  const downloadTemplate = () => {
    const templates = {
      employees: "name,email,role,department,phone,baseSalary,latePenaltyRate,overtimeRate\nJohn Doe,john@test.com,Developer,Engineering,1234567890,5000,50,25",
      customers: "name,email,phone,status\nJane Smith,jane@test.com,0987654321,Active",
      inventory: "name,sku,quantity,price,category\nWidget A,WIDG-001,50,19.99,Hardware",
      sales: "customer,amount,date,status\nCompany X,1500.00,2026-04-18,Paid"
    }
    const csvContent = templates[importTarget]
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `${importTarget}_template.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.name.endsWith('.csv')) {
      displayMessage('error', 'Please upload a valid .csv file.')
      return
    }

    setLoading(true)
    try {
      const text = await file.text()
      const lines = text.split('\n').map(l => l.trim()).filter(l => l)
      if (lines.length < 2) throw new Error("CSV must contain headers and at least one data row.")
      
      const headers = lines[0].toLowerCase().split(',')
      const existingDocs = await getDocuments(importTarget) || []

      let importedCount = 0
      let skippedCount = 0

      for (let i = 1; i < lines.length; i++) {
        // Handle CSVs correctly instead of naive split, but `.split(',')` works for basic ones.
        // We'll use naive split since it's just a demo template format
        const values = lines[i].split(',')
        const obj = {}
        headers.forEach((header, index) => {
           obj[header.trim()] = values[index] ? values[index].trim() : ''
        })

        // Skip completely corrupt or empty rows
        if (!obj.email && !obj.name && importTarget === 'employees') continue

        let isDuplicate = false
        if (importTarget === 'employees' || importTarget === 'customers') {
          isDuplicate = existingDocs.some(d => 
             (d.email && obj.email && d.email.toLowerCase() === obj.email.toLowerCase()) ||
             (d.name && obj.name && d.name.toLowerCase() === obj.name.toLowerCase())
          )
        } else if (importTarget === 'inventory') {
          isDuplicate = existingDocs.some(d => 
             (d.sku && obj.sku && d.sku.toLowerCase() === obj.sku.toLowerCase()) ||
             (d.name && obj.name && d.name.toLowerCase() === obj.name.toLowerCase())
          )
        }

        if (!isDuplicate) {
           if (importTarget === 'employees') {
             obj.status = 'Offline';
             obj.lates = 0;
             obj.extraHours = 0;
             obj.baseSalary = Number(obj.basesalary || obj.baseSalary) || 0;
             obj.latePenaltyRate = Number(obj.latepenaltyrate || obj.latePenaltyRate) || 0;
             obj.overtimeRate = Number(obj.overtimerate || obj.overtimeRate) || 0;
             obj.employeeNumber = `E-${String(existingDocs.length + 1).padStart(3, '0')}`;
           }
           await addDocument(importTarget, obj)
           existingDocs.push(obj) // CRITICAL: Stop intra-file duplicates
           importedCount++
        } else {
           skippedCount++
        }
      }

      setImportStats({ imported: importedCount, skipped: skippedCount })
      displayMessage('success', `Import complete! Added: ${importedCount} | Skipped Duplicates: ${skippedCount}`)
    } catch (err) {
      console.error(err)
      displayMessage('error', err.message || 'Failed to parse CSV.')
    } finally {
      setLoading(false)
      e.target.value = null
    }
  }

  return (
    <section className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">Settings</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">System settings</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Configure company preferences, notifications, and user access.</p>
      </div>

      {saveStatus.message && (
        <div className={`p-4 rounded-3xl border transition-all ${
          saveStatus.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-300'
        }`}>
          {saveStatus.message}
        </div>
      )}

      {loading ? (
        <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500"></div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Side Navigation */}
          <div className="w-full lg:w-64 flex-shrink-0">
            <div className="flex lg:flex-col overflow-x-auto gap-2 bg-white dark:bg-slate-900/50 p-2 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xl">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-shrink-0 text-left px-5 py-3 rounded-2xl text-sm font-medium transition ${
                    activeTab === tab
                      ? 'bg-sky-500 text-slate-950 shadow-md shadow-sky-500/20'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:bg-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content Area */}
          <div className="flex-1 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 shadow-xl shadow-slate-950/20">
            
            {activeTab === 'Company Profile' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Company Profile</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 mb-6">Update your business details. These will reflect on invoices and reports.</p>
                <form onSubmit={saveCompanyProfile} className="space-y-4 max-w-2xl">
                  <label className="block text-sm text-slate-700 dark:text-slate-300">Company Name
                    <input type="text" value={companyParams.name} onChange={e => setCompanyParams({...companyParams, name: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" placeholder="My Awesome Co." />
                  </label>
                  <label className="block text-sm text-slate-700 dark:text-slate-300">Logo Image URL
                    <input type="url" value={companyParams.logoUrl} onChange={e => setCompanyParams({...companyParams, logoUrl: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" placeholder="https://example.com/logo.png" />
                  </label>
                  <label className="block text-sm text-slate-700 dark:text-slate-300">Phone Number
                    <input type="tel" value={companyParams.phone} onChange={e => setCompanyParams({...companyParams, phone: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" placeholder="+1 234 567 890" />
                  </label>
                  <label className="block text-sm text-slate-700 dark:text-slate-300">Business Address
                    <textarea value={companyParams.address} onChange={e => setCompanyParams({...companyParams, address: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 h-24 resize-none" placeholder="123 Business Rd..." />
                  </label>
                  <div className="pt-4">
                    <button type="submit" className="rounded-2xl bg-sky-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">Save Profile</button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'Security' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Security</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 mb-6">Update your account password.</p>
                <form onSubmit={changePassword} className="space-y-4 max-w-lg">
                  <label className="block text-sm text-slate-700 dark:text-slate-300">New Password
                    <input type="password" value={passwordParams.newPassword} onChange={e => setPasswordParams({...passwordParams, newPassword: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required minLength="6" />
                  </label>
                  <label className="block text-sm text-slate-700 dark:text-slate-300">Confirm Password
                    <input type="password" value={passwordParams.confirmPassword} onChange={e => setPasswordParams({...passwordParams, confirmPassword: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required />
                  </label>
                  <div className="pt-4">
                    <button type="submit" className="rounded-2xl bg-rose-500 px-6 py-2.5 text-sm font-semibold text-rose-950 transition hover:bg-rose-400">Update Password</button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'User Management' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">User Management</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 mb-6">Manage roles and permissions for system users.</p>
                
                <div className="overflow-x-auto rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
                  <table className="min-w-full border-collapse text-left text-sm">
                    <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider">Email</th>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider">Date Joined</th>
                        <th className="px-6 py-4 font-semibold uppercase tracking-wider">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {users.length === 0 && (
                        <tr><td colSpan="3" className="px-6 py-8 text-center text-slate-500">No users found.</td></tr>
                      )}
                      {users.map(user => (
                        <tr key={user.id} className="hover:bg-white/80 dark:bg-slate-900/80 transition">
                          <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{user.email}</td>
                          <td className="px-6 py-4 text-slate-600 dark:text-slate-400">
                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4">
                            <select 
                              value={user.role || 'employee'} 
                              onChange={(e) => updateUserRole(user.id, e.target.value)}
                              className="rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 outline-none hover:border-slate-600 focus:border-sky-500"
                            >
                              <option value="admin">Admin</option>
                              <option value="manager">Manager</option>
                              <option value="employee">Employee</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeTab === 'Preferences' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">App Preferences</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 mb-6">Configure global formatting settings.</p>
                <form onSubmit={savePreferences} className="space-y-4 max-w-xl">
                  <label className="block text-sm text-slate-700 dark:text-slate-300">Global Currency
                    <select value={prefParams.currency} onChange={e => setPrefParams({...prefParams, currency: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      <option value="$">USD ($)</option>
                      <option value="€">EUR (€)</option>
                      <option value="£">GBP (£)</option>
                      <option value="₹">INR (₹)</option>
                      <option value="¥">JPY (¥)</option>
                    </select>
                  </label>
                  <label className="block text-sm text-slate-700 dark:text-slate-300">Date Format
                    <select value={prefParams.dateFormat} onChange={e => setPrefParams({...prefParams, dateFormat: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      <option value="YYYY-MM-DD">YYYY-MM-DD (e.g. 2026-04-09)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (e.g. 09/04/2026)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (e.g. 04/09/2026)</option>
                    </select>
                  </label>
                  <div className="pt-4">
                    <button type="submit" className="rounded-2xl bg-sky-500 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">Save Preferences</button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'Data Management' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Bulk CSV Data Importer</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 mb-6">Mass upload records from external spreadsheet files.</p>
                
                <div className="max-w-xl space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">1. Select Target Database</label>
                    <select value={importTarget} onChange={(e) => setImportTarget(e.target.value)} className="w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                      <option value="employees">Employees</option>
                      <option value="customers">Customers</option>
                      <option value="inventory">Inventory</option>
                      <option value="sales">Sales / Orders</option>
                    </select>
                  </div>

                  <div className="flex gap-4 items-center p-4 rounded-2xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/20">
                    <div className="text-sm text-slate-700 dark:text-slate-300 flex-1">
                      <p className="font-semibold text-sky-800 dark:text-sky-300">Need the correct column names?</p>
                      <p className="mt-1">Download the exact template structure for {importTarget}.</p>
                    </div>
                    <button onClick={downloadTemplate} className="whitespace-nowrap rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400">
                      Download Template
                    </button>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">2. Upload Filled CSV File</label>
                    <div className="mt-1 flex justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 px-6 pt-10 pb-12 hover:bg-slate-50 dark:hover:bg-slate-950/50 transition relative">
                      <div className="space-y-1 text-center">
                        <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <div className="flex justify-center text-sm text-slate-600 dark:text-slate-400">
                          <label htmlFor="file-upload" className="relative cursor-pointer rounded-md font-medium text-emerald-600 hover:text-emerald-500 focus-within:outline-none">
                            <span>Upload a file</span>
                            <input id="file-upload" name="file-upload" type="file" accept=".csv" className="sr-only" onChange={handleFileUpload} />
                          </label>
                          <p className="pl-1">or drag and drop</p>
                        </div>
                        <p className="text-xs text-slate-500">CSV up to 10MB</p>
                      </div>
                    </div>
                  </div>

                  {importStats && (
                    <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 text-sm border border-emerald-200 dark:border-emerald-900">
                      <p className="font-bold text-slate-900 dark:text-slate-100">Latest Import Results:</p>
                      <p className="text-emerald-600 dark:text-emerald-400 mt-1 font-semibold">Successfully Inserted: {importStats.imported}</p>
                      <p className="text-rose-500 dark:text-rose-400 font-semibold mt-1">Skipped (Duplicates): {importStats.skipped}</p>
                    </div>
                  )}

                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </section>
  )
}

export default Settings
