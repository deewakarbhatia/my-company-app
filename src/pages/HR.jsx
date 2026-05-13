import { useMemo, useState, useEffect } from 'react'
import { addDocument, getDocuments, updateDocument, deleteDocument } from '../firebase'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const statusClasses = {
  Online: 'bg-emerald-500/15 text-emerald-300',
  Offline: 'bg-slate-700 text-slate-700 dark:text-slate-300',
  Pending: 'bg-amber-500/15 text-amber-300',
  Approved: 'bg-emerald-500/15 text-emerald-300',
  Rejected: 'bg-rose-500/15 text-rose-300',
}

const HR = () => {
  const [activeTab, setActiveTab] = useState('Employees')
  const [employees, setEmployees] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false)
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  
  const [formValues, setFormValues] = useState({ name: '', email: '', role: '', department: '', phone: '', status: 'Offline', baseSalary: '', latePenaltyRate: '', overtimeRate: '' })
  const [leaveValues, setLeaveValues] = useState({ employeeId: '', start: '', end: '', type: 'Vacation' })
  const [highlightedId, setHighlightedId] = useState(null)
  const [payrolls, setPayrolls] = useState([])
  const [isPayrollModalOpen, setIsPayrollModalOpen] = useState(false)
  const [payrollValues, setPayrollValues] = useState({ employeeEmail: '', baseSalary: '', bonus: '', deductions: '', period: '', paymentDate: '', status: 'Pending' })

  const location = useLocation()
  const { user, userRole } = useAuth()
  const isHRManager = userRole === 'admin' || userRole === 'manager'

  useEffect(() => {
    const searchId = new URLSearchParams(location.search).get('searchId')
    if (searchId) {
      setActiveTab('Employees') // ensure we are on the right tab
      setHighlightedId(searchId)
      setTimeout(() => setHighlightedId(null), 3000)
    }
  }, [location.search])

  // Fetch HR data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const empData = await getDocuments('employees') || []
        const reqData = await getDocuments('leave_requests') || []
        const payData = await getDocuments('payroll') || []
        
        setEmployees(empData)
        setRequests(reqData)

        let validPayrolls = payData
        if (userRole !== 'admin' && userRole !== 'manager' && user?.email) {
          validPayrolls = validPayrolls.filter(p => p.employeeEmail === user.email)
        }
        setPayrolls(validPayrolls)
      } catch (err) {
        console.error('Failed to load HR data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [userRole, user])

  const onlineCount = useMemo(
    () => employees.filter((employee) => employee.status === 'Online').length,
    [employees]
  )

  const openEmployeeModal = () => {
    setFormValues({ name: '', email: '', role: '', department: '', phone: '', status: 'Offline', baseSalary: '', latePenaltyRate: '', overtimeRate: '' })
    setIsEmployeeModalOpen(true)
  }

  const openLeaveModal = () => {
    setLeaveValues({ employeeId: employees.length > 0 ? employees[0].id : '', start: '', end: '', type: 'Vacation' })
    setIsLeaveModalOpen(true)
  }

  const handleEmployeeSubmit = async (event) => {
    event.preventDefault()
    if (!formValues.name || !formValues.email || !formValues.role || !formValues.department || !formValues.phone) {
      alert("Please fill all fields");
      return;
    }

    try {
      const newEmp = { 
        ...formValues, 
        baseSalary: Number(formValues.baseSalary) || 0,
        latePenaltyRate: Number(formValues.latePenaltyRate) || 0,
        overtimeRate: Number(formValues.overtimeRate) || 0,
        lates: 0,
        extraHours: 0,
        employeeNumber: `E-${String(employees.length + 1).padStart(3, '0')}` 
      }
      const docId = await addDocument('employees', newEmp)
      setEmployees((current) => [{ ...newEmp, id: docId }, ...current])
      setIsEmployeeModalOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  const handleLeaveSubmit = async (event) => {
    event.preventDefault()
    if (!leaveValues.employeeId || !leaveValues.start || !leaveValues.end) return

    const employeeObj = employees.find(e => e.id === leaveValues.employeeId)
    if (!employeeObj) return;

    try {
      const newReq = {
        requestId: `LR-${String(Math.floor(Math.random() * 1000) + 100)}`,
        employee: employeeObj.name,
        department: employeeObj.department,
        period: `${leaveValues.start} → ${leaveValues.end}`,
        type: leaveValues.type,
        status: 'Pending'
      }
      
      const docId = await addDocument('leave_requests', newReq)
      setRequests((current) => [{ id: docId, ...newReq }, ...current])
      setIsLeaveModalOpen(false)

      // 🔔 Dispatch Notification
      await addDocument('notifications', {
        title: 'New Leave Request',
        message: `${employeeObj.name} submitted a ${leaveValues.type} request.`,
        type: 'hr',
        read: false
      })

    } catch (err) {
      console.error(err)
    }
  }

  const updateRequestStatus = async (docId, newStatus) => {
    try {
      await updateDocument('leave_requests', docId, { status: newStatus })
      setRequests((current) =>
        current.map((request) =>
          request.id === docId ? { ...request, status: newStatus } : request
        )
      )
    } catch (err) {
      console.error('Failed to update request:', err)
    }
  }

  const openPayrollModal = () => {
    setPayrollValues({ employeeEmail: '', baseSalary: '', bonus: '', deductions: '', period: '', paymentDate: '', status: 'Pending' })
    setIsPayrollModalOpen(true)
  }

  const handlePayrollSubmit = async (event) => {
    event.preventDefault()
    if (!payrollValues.employeeEmail || !payrollValues.baseSalary) return

    const selectedEmp = employees.find(e => e.email === payrollValues.employeeEmail)
    const empName = selectedEmp ? selectedEmp.name : payrollValues.employeeEmail

    const base = parseFloat(payrollValues.baseSalary) || 0
    const bonus = parseFloat(payrollValues.bonus) || 0
    const deductions = parseFloat(payrollValues.deductions) || 0
    const netPay = base + bonus - deductions

    try {
      const newPay = {
        payrollId: `PAY-${String(Math.floor(Math.random() * 90000) + 10000)}`,
        employeeName: empName,
        employeeEmail: payrollValues.employeeEmail,
        baseSalary: base,
        bonus: bonus,
        deductions: deductions,
        netPay: netPay,
        period: payrollValues.period,
        paymentDate: payrollValues.paymentDate,
        status: payrollValues.status
      }
      
      const docId = await addDocument('payroll', newPay)
      setPayrolls((current) => [{ id: docId, ...newPay }, ...current])
      setIsPayrollModalOpen(false)
    } catch (err) {
      console.error(err)
    }
  }

  const updatePayrollStatus = async (docId, newStatus) => {
    try {
      await updateDocument('payroll', docId, { status: newStatus })
      setPayrolls((current) =>
        current.map((pay) =>
          pay.id === docId ? { ...pay, status: newStatus } : pay
        )
      )
    } catch (err) {
      console.error('Failed to update payroll status:', err)
    }
  }

  const handleDeleteEmployee = async (docId) => {
    if (!window.confirm("Are you sure you want to permanently delete this employee?")) return;
    try {
      await deleteDocument('employees', docId)
      setEmployees((current) => current.filter((e) => e.id !== docId))
    } catch (err) {
      console.error("Failed to delete employee:", err)
    }
  }

  const handleLogLate = async (employee) => {
    try {
      const updatedLates = (employee.lates || 0) + 1;
      await updateDocument('employees', employee.id, { lates: updatedLates });
      setEmployees((current) => current.map((e) => e.id === employee.id ? { ...e, lates: updatedLates } : e));
      if (updatedLates > 3) alert(`Warning: ${employee.name} now has ${updatedLates} lates. The next bulk payroll will implicitly penalize their salary!`);
    } catch (err) {
      console.error(err);
    }
  }

  const handleLogOvertime = async (employee) => {
    try {
      const updatedExtra = (employee.extraHours || 0) + 1;
      await updateDocument('employees', employee.id, { extraHours: updatedExtra });
      setEmployees((current) => current.map((e) => e.id === employee.id ? { ...e, extraHours: updatedExtra } : e));
    } catch (err) {
      console.error(err);
    }
  }

  const handleRunBulkPayroll = async () => {
    if (!window.confirm("Are you sure you want to process payroll for EVERY employee and reset their attendance?")) return;
    setLoading(true);
    try {
      let created = 0;
      let monthLabel = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
      for (const emp of employees) {
        const base = Number(emp.baseSalary) || 0;
        const penaltyRate = Number(emp.latePenaltyRate) || 0;
        const oRate = Number(emp.overtimeRate) || 0;
        const lates = Number(emp.lates) || 0;
        const extraHours = Number(emp.extraHours) || 0;

        const penaltyAmount = Math.max(0, lates - 3) * penaltyRate;
        const bonusAmount = extraHours * oRate;
        const netPay = base - penaltyAmount + bonusAmount;

        const newPay = {
          employeeEmail: emp.email || emp.name,
          employeeName: emp.name,
          baseSalary: base,
          bonus: bonusAmount,
          deductions: penaltyAmount,
          netPay: netPay,
          period: monthLabel,
          paymentDate: new Date().toISOString().split('T')[0],
          status: 'Paid'
        };
        
        await addDocument('payroll', newPay);
        await updateDocument('employees', emp.id, { lates: 0, extraHours: 0 });
        created++;
      }
      alert(`Bulk Payroll Success! Generated ${created} payslips and reset all attendance to 0.`);
      setEmployees((current) => current.map(e => ({ ...e, lates: 0, extraHours: 0 })));
      const payData = await getDocuments('payroll') || [];
      const validPayData = userRole === 'admin' || userRole === 'manager' ? payData : payData.filter(p => p.employeeEmail === user.email);
      setPayrolls(validPayData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/20">
        <p className="text-sm uppercase tracking-[0.3em] text-slate-500">HR</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100">Team & leave management</h1>
        <p className="mt-2 max-w-2xl text-slate-600 dark:text-slate-400">View active team members, manage leave, and add new employees from one place.</p>
      </div>

      <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-950/20">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">HR dashboard</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Employees online: {onlineCount}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={openLeaveModal}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-200 transition hover:bg-slate-100 dark:bg-slate-800"
            >
              Submit Leave Request
            </button>
            {isHRManager && (
              <>
                <button
                  onClick={openPayrollModal}
                  className="inline-flex items-center justify-center rounded-2xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400"
                >
                  Process Salary
                </button>
                <button
                  onClick={openEmployeeModal}
                  className="inline-flex items-center justify-center rounded-2xl bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
                >
                  Add Employee
                </button>
              </>
            )}
          </div>
        </div>

        <nav className="mt-6 flex flex-wrap gap-3">
          {['Employees', 'Leave Requests', 'Payroll & Salary'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab
                  ? 'bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-xl shadow-slate-950/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-sky-500"></div>
        </div>
      ) : activeTab === 'Employees' ? (
        <div className="grid gap-6 xl:grid-cols-2">
          {employees.length === 0 && <p className="text-slate-500 p-4">No employees found. Add one!</p>}
          {employees.map((employee) => (
            <div key={employee.id} className={`rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-xl shadow-slate-950/20 transition duration-500 ${highlightedId === employee.id ? 'bg-sky-900/40 outline outline-2 outline-sky-500' : 'bg-white/90 dark:bg-slate-900/90'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{employee.department}</p>
                  <div className="flex items-center gap-3">
                    <h3 className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{employee.name}</h3>
                    {isHRManager && (
                      <button onClick={() => handleDeleteEmployee(employee.id)} className="mt-2 text-xs font-bold text-rose-500 hover:text-rose-400 bg-rose-500/10 px-2 py-1 rounded-lg transition">Delete</button>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{employee.role}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-sm font-semibold ${statusClasses[employee.status] || statusClasses['Offline']}`}>
                  {employee.status}
                </span>
              </div>
              <div className="mt-6 space-y-3 text-sm text-slate-700 dark:text-slate-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Phone</span>
                  <span>{employee.phone}</span>
                </div>
                <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Attendance Log</span>
                  <div className="text-right flex gap-3 text-xs">
                    <span className="bg-rose-500/10 text-rose-500 font-bold px-2 py-1 rounded-lg">{employee.lates || 0} Lates</span>
                    <span className="bg-emerald-500/10 text-emerald-500 font-bold px-2 py-1 rounded-lg">{employee.extraHours || 0} Extra Hrs</span>
                  </div>
                </div>
                {isHRManager && (
                  <div className="flex gap-2 pt-2">
                    <button onClick={() => handleLogLate(employee)} className="flex-1 py-2 text-xs font-bold rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition shadow-sm">+1 Late</button>
                    <button onClick={() => handleLogOvertime(employee)} className="flex-1 py-2 text-xs font-bold rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition shadow-sm">+1 Overtime Hour</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : activeTab === 'Payroll & Salary' ? (
        <div className="space-y-6">
          {isHRManager && (
            <div className="flex flex-col md:flex-row bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-3xl p-6 justify-between items-start md:items-center gap-4">
              <div>
                 <h2 className="text-xl font-bold text-orange-600 dark:text-orange-400">Automated Bulk Payroll</h2>
                 <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 max-w-xl">Compile salaries across all employees simultaneously. Automatically deducts late penalties, applies overtime bonuses, resets attendance logs, and saves all generated payslips to the database instantly.</p>
              </div>
              <button onClick={handleRunBulkPayroll} className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 px-6 rounded-2xl shadow-lg shadow-orange-500/30 transition whitespace-nowrap">
                 Run Bulk Engine Now
              </button>
            </div>
          )}
          <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-slate-950/20">
            <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Employee</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Period</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Net Pay</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Deductions</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Date</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Status</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Action</th>
                </tr>
              </thead>
              <tbody>
                {payrolls.length === 0 && (
                  <tr><td colSpan="7" className="p-6 text-center text-slate-500">No payroll records configured yet.</td></tr>
                )}
                {payrolls.map((pay) => (
                  <tr key={pay.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:bg-slate-950/80">
                    <td className="px-6 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{pay.employeeName}</div>
                      <div className="text-xs text-slate-500">{pay.employeeEmail}</div>
                    </td>
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{pay.period}</td>
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-200 font-bold">${pay.netPay}</td>
                    <td className="px-6 py-4 text-rose-500 font-semibold">{pay.deductions > 0 ? `-$${pay.deductions}` : '-'}</td>
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{pay.paymentDate}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[pay.status] || statusClasses.Pending}`}>
                        {pay.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {isHRManager ? (
                        pay.status === 'Pending' ? (
                           <button
                             onClick={() => updatePayrollStatus(pay.id, 'Paid')}
                             className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-600 transition hover:bg-emerald-500/20"
                           >
                             Mark Paid
                           </button>
                        ) : (
                          <span className="text-slate-500 text-xs">Settled</span>
                        )
                      ) : (
                        <span className="text-slate-500 text-xs">View Only</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-xl shadow-slate-950/20">
          <div className="overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-950/80 text-slate-600 dark:text-slate-400">
                <tr>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Employee</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Department</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Period</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Type</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Status</th>
                  <th className="px-6 py-4 font-semibold uppercase tracking-[0.2em]">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.length === 0 && (
                  <tr><td colSpan="6" className="p-6 text-center text-slate-500">No leave requests found.</td></tr>
                )}
                {requests.map((request) => (
                  <tr key={request.id} className="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:bg-slate-950/80">
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{request.employee}</td>
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{request.department}</td>
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{request.period}</td>
                    <td className="px-6 py-4 text-slate-800 dark:text-slate-200">{request.type}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses[request.status]}`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {isHRManager ? (
                        request.status === 'Pending' ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => updateRequestStatus(request.id, 'Approved')}
                              className="rounded-2xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => updateRequestStatus(request.id, 'Rejected')}
                              className="rounded-2xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-xs">Resolved</span>
                        )
                      ) : (
                        <span className="text-slate-500 text-xs">Auth Restricted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Employee Modal */}
      {isEmployeeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl shadow-slate-950/40">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Add employee</h2>
              </div>
              <button onClick={() => setIsEmployeeModalOpen(false)} className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">Close</button>
            </div>
            <form onSubmit={handleEmployeeSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm text-slate-700 dark:text-slate-300">Name
                <input type="text" value={formValues.name} onChange={e => setFormValues(p => ({...p, name: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">Email Address
                <input type="email" value={formValues.email} onChange={e => setFormValues(p => ({...p, email: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">Role
                <input type="text" value={formValues.role} onChange={e => setFormValues(p => ({...p, role: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">Department
                <input type="text" value={formValues.department} onChange={e => setFormValues(p => ({...p, department: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">Phone
                <input type="tel" value={formValues.phone} onChange={e => setFormValues(p => ({...p, phone: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required />
              </label>
              
              <div className="sm:col-span-2 mt-2 pt-4 border-t border-slate-200 dark:border-slate-800">
                 <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-widest mb-4 text-orange-500">Financial Contract Definition</h3>
                 <div className="grid sm:grid-cols-3 gap-4">
                    <label className="block text-sm text-slate-700 dark:text-slate-300">Base Salary ($)
                      <input type="number" min="0" value={formValues.baseSalary} onChange={e => setFormValues(p => ({...p, baseSalary: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" />
                    </label>
                    <label className="block text-sm text-slate-700 dark:text-slate-300">Penalty Rate ($ per late)
                      <input type="number" min="0" value={formValues.latePenaltyRate} onChange={e => setFormValues(p => ({...p, latePenaltyRate: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" />
                    </label>
                    <label className="block text-sm text-slate-700 dark:text-slate-300">Overtime Rate ($/hr)
                      <input type="number" min="0" value={formValues.overtimeRate} onChange={e => setFormValues(p => ({...p, overtimeRate: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" />
                    </label>
                 </div>
              </div>

              <div className="sm:col-span-2 flex justify-end gap-3 mt-4">
                <button type="submit" className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400">Add Employee</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit Leave Modal */}
      {isLeaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl shadow-slate-950/40">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Submit leave request</h2>
              <button onClick={() => setIsLeaveModalOpen(false)} className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">Close</button>
            </div>
            
            <form onSubmit={handleLeaveSubmit} className="mt-6 space-y-4">
              <label className="block text-sm text-slate-700 dark:text-slate-300">Employee
                <select value={leaveValues.employeeId} onChange={e => setLeaveValues(p => ({...p, employeeId: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name} ({e.department})</option>)}
                </select>
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm text-slate-700 dark:text-slate-300">Start Date
                  <input type="date" value={leaveValues.start} onChange={e => setLeaveValues(p => ({...p, start: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 dark:[color-scheme:dark]" required />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-300">End Date
                  <input type="date" value={leaveValues.end} onChange={e => setLeaveValues(p => ({...p, end: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 dark:[color-scheme:dark]" required />
                </label>
              </div>

              <label className="block text-sm text-slate-700 dark:text-slate-300">Leave Type
                <select value={leaveValues.type} onChange={e => setLeaveValues(p => ({...p, type: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100">
                  <option value="Vacation">Vacation</option>
                  <option value="Sick Leave">Sick Leave</option>
                  <option value="Personal">Personal</option>
                </select>
              </label>

              <div className="flex justify-end gap-3 pt-4">
                <button type="submit" className="rounded-2xl bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-sky-400">Submit Request</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Process Salary Modal */}
      {isPayrollModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-50 dark:bg-slate-950/80 px-4 py-6">
          <div className="w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl shadow-slate-950/40">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Process Salary & Compliance</h2>
              <button onClick={() => setIsPayrollModalOpen(false)} className="rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm text-slate-700 dark:text-slate-300">Close</button>
            </div>
            
            <form onSubmit={handlePayrollSubmit} className="mt-6 space-y-4">
              <label className="block text-sm text-slate-700 dark:text-slate-300">Select Employee
                <select value={payrollValues.employeeEmail} onChange={e => setPayrollValues(p => ({...p, employeeEmail: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required>
                  <option value="" disabled>Select an employee limit</option>
                  {employees.map(e => <option key={e.id} value={e.email}>{e.name} ({e.email})</option>)}
                </select>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="block text-sm text-slate-700 dark:text-slate-300">Base Salary ($)
                  <input type="number" min="0" value={payrollValues.baseSalary} onChange={e => setPayrollValues(p => ({...p, baseSalary: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required />
                </label>
                <label className="block text-sm text-emerald-600 dark:text-emerald-400">Bonus / Increment ($)
                  <input type="number" min="0" value={payrollValues.bonus} onChange={e => setPayrollValues(p => ({...p, bonus: e.target.value}))} className="mt-2 w-full rounded-2xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-900 dark:text-emerald-100" />
                </label>
                <label className="block text-sm text-rose-600 dark:text-rose-400">Deductions / Fine ($)
                  <input type="number" min="0" value={payrollValues.deductions} onChange={e => setPayrollValues(p => ({...p, deductions: e.target.value}))} className="mt-2 w-full rounded-2xl border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm text-rose-900 dark:text-rose-100" />
                </label>
              </div>
              
              <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex justify-between items-center">
                <span className="text-sm font-bold uppercase tracking-widest text-slate-500">Total Net Payout:</span>
                <span className="text-2xl font-black text-slate-900 dark:text-slate-100">
                  ${ (parseFloat(payrollValues.baseSalary)||0) + (parseFloat(payrollValues.bonus)||0) - (parseFloat(payrollValues.deductions)||0) }
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="block text-sm text-slate-700 dark:text-slate-300">Period (E.g. Q3 2026)
                  <input type="text" value={payrollValues.period} onChange={e => setPayrollValues(p => ({...p, period: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100" required />
                </label>
                <label className="block text-sm text-slate-700 dark:text-slate-300">Payment Process Date
                  <input type="date" value={payrollValues.paymentDate} onChange={e => setPayrollValues(p => ({...p, paymentDate: e.target.value}))} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm text-slate-900 dark:text-slate-100 dark:[color-scheme:dark]" required />
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button type="submit" className="rounded-2xl bg-emerald-500 px-6 py-3 text-sm font-bold text-white hover:bg-emerald-400 transition shadow-lg shadow-emerald-500/30">Issue Payslip</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </section>
  )
}

export default HR
