import { useState, useEffect } from 'react'
import { getDocuments, addDocument, updateDocument } from '../firebase'
import { useAuth } from '../context/AuthContext'

const statusClasses = {
  Pending: 'bg-sky-500/15 text-sky-600',
  'In Progress': 'bg-amber-500/15 text-amber-600',
  'Completed Soon': 'bg-emerald-500/15 text-emerald-500',
  Completed: 'bg-emerald-500/15 text-emerald-600',
  'Completed Late': 'bg-purple-500/15 text-purple-600',
  Overdue: 'bg-rose-500/15 text-rose-600',
}

const Tasks = () => {
  const { user, userRole } = useAuth()
  const [tasks, setTasks] = useState([])
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isJustifyModalOpen, setIsJustifyModalOpen] = useState(false)
  
  // Create Task Form State
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeEmail: '',
    assigneeName: '',
    deadline: '',
    penalty: ''
  })
  
  // Justify Action State
  const [selectedTask, setSelectedTask] = useState(null)
  const [justification, setJustification] = useState('')

  const isManager = ['admin', 'manager'].includes(userRole)

  const fetchData = async () => {
    setLoading(true)
    try {
      // 1. Fetch Employees for dropdown
      if (isManager) {
        const empData = await getDocuments('employees')
        setEmployees(empData || [])
      }

      // 2. Fetch Tasks
      const allTasks = await getDocuments('tasks') || []
      
      // Filter by role
      let filteredTasks = allTasks
      if (!isManager) {
        filteredTasks = allTasks.filter(t => t.assigneeEmail === user.email)
      }

      // Automatically evaluate OVERDUE dynamically
      const now = new Date()
      // Normalize today's date so we don't accidentally flag tasks due today at 11:59PM
      now.setHours(0,0,0,0)

      filteredTasks = filteredTasks.map(task => {
        const deadlineDate = new Date(task.deadline)
        if (task.status === 'Pending' && deadlineDate < now) {
          return { ...task, isDynamicallyOverdue: true }
        }
        return { ...task, isDynamicallyOverdue: false }
      })
      
      filteredTasks.sort((a, b) => new Date(b.deadline) - new Date(a.deadline))
      setTasks(filteredTasks)

    } catch (error) {
      console.error('Failed to load tasks data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [userRole, user])

  const handleCreateTask = async (e) => {
    e.preventDefault()
    
    // Find the assignee name from the selected email
    const selectedEmp = employees.find(emp => (emp.email || emp.name || emp.id) === newTask.assigneeEmail)
    const empName = selectedEmp ? (selectedEmp.name || `${selectedEmp.firstName || null} ${selectedEmp.lastName || null}`.trim() || 'Unknown') : newTask.assigneeEmail

    try {
      await addDocument('tasks', {
        title: newTask.title,
        description: newTask.description,
        assigneeEmail: newTask.assigneeEmail,
        assigneeName: empName,
        deadline: newTask.deadline,
        penalty: newTask.penalty,
        status: 'Pending',
        justification: '',
        createdBy: userRole,
      })
      
      setIsCreateModalOpen(false)
      setNewTask({ title: '', description: '', assigneeEmail: '', assigneeName: '', deadline: '', penalty: '' })
      fetchData()
    } catch (error) {
      console.error('Task creation failed', error)
    }
  }

  const handleMarkComplete = async (task) => {
    if (task.isDynamicallyOverdue) {
      // If overdue, force the justification modal!
      setSelectedTask(task)
      setIsJustifyModalOpen(true)
    } else {
      // Safe to just mark complete
      try {
        await updateDocument('tasks', task.id, {
          status: 'Completed'
        })
        fetchData()
      } catch (err) {
        console.error('Failed to update task', err)
      }
    }
  }

  const handleSubmitJustification = async (e) => {
    e.preventDefault()
    if (!justification.trim() || !selectedTask) return

    try {
      await updateDocument('tasks', selectedTask.id, {
        status: 'Completed Late',
        justification: justification
      })
      setIsJustifyModalOpen(false)
      setJustification('')
      setSelectedTask(null)
      fetchData()
    } catch (err) {
      console.error('Failed to submit excuse', err)
    }
  }

  return (
    <section className="space-y-8 px-4 py-8 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">Tasks & Compliance</h1>
          <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
            {isManager 
              ? 'Assign duties, enforce strict deadlines, and audit missed deadlines.' 
              : 'Your assigned work. Incomplete tasks past deadline require a formal justification.'
            }
          </p>
        </div>
        
        {isManager && (
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center justify-center rounded-xl bg-orange-500 px-5 py-2 font-bold text-white transition hover:bg-orange-400 shadow-md shadow-orange-500/20"
          >
            + Assign New Task
          </button>
        )}
      </div>

      {loading ? (
        <div className="py-24 flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {tasks.length === 0 ? (
            <div className="col-span-1 lg:col-span-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-12 text-center shadow-sm">
              <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-slate-50 dark:bg-slate-800 flex items-center justify-center text-3xl">📭</div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">No active tasks</h3>
              <p className="mt-2 text-slate-500 dark:text-slate-400">{isManager ? 'Assign duties to employees to track compliance.' : 'You are all caught up! No tasks assigned to you right now.'}</p>
            </div>
          ) : (
            tasks.map(task => {
              const displayStatus = task.isDynamicallyOverdue ? 'Overdue' : task.status

              return (
                <div key={task.id} className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-sm hover:shadow-lg transition">
                  <div className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-bold tracking-wide uppercase ${statusClasses[displayStatus] || statusClasses.Pending}`}>
                        {displayStatus}
                      </span>
                      {displayStatus === 'Overdue' && (
                        <span className="flex h-3 w-3 relative">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                        </span>
                      )}
                    </div>
                    
                    <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2 truncate" title={task.title}>{task.title}</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 min-h-[40px]">{task.description}</p>
                    
                    <div className="mt-6 space-y-3 border-t border-slate-100 dark:border-slate-800/50 pt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Assignee</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{task.assigneeName}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Deadline</span>
                        <span className={`font-bold ${displayStatus === 'Overdue' ? 'text-rose-600' : 'text-slate-800 dark:text-slate-200'}`}>
                          {task.deadline}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-500 font-medium">Penalty</span>
                        <span className="font-bold text-orange-600 dark:text-orange-400">{task.penalty || 'None'}</span>
                      </div>
                    </div>

                    {task.status === 'Completed Late' && task.justification && (
                      <div className="mt-4 rounded-xl bg-slate-50 dark:bg-slate-800 p-4 border border-slate-200 dark:border-slate-700">
                        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Justification Submitted:</p>
                        <p className="text-sm italic text-slate-700 dark:text-slate-300">"{task.justification}"</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Action Footer */}
                  {task.status === 'Pending' && !isManager && (
                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800">
                      <button 
                        onClick={() => handleMarkComplete(task)}
                        className={`w-full rounded-xl py-2 font-bold transition shadow-sm ${
                          task.isDynamicallyOverdue 
                            ? 'bg-rose-100 text-rose-700 hover:bg-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800/50' 
                            : 'bg-emerald-500 text-white hover:bg-emerald-400'
                        }`}
                      >
                        {task.isDynamicallyOverdue ? 'Acknowledge Overdue & Resolve' : 'Mark as Completed'}
                      </button>
                    </div>
                  )}

                  {task.status === 'Pending' && isManager && (
                    <div className="px-6 py-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex justify-center">
                       <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Waiting on Employee</span>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm px-4 py-6">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-6">Assign New Task</h2>
            <form onSubmit={handleCreateTask} className="space-y-4">
              
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Task Title
                <input type="text" placeholder="Update Q3 Financial Reports" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-slate-100" required />
              </label>

              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Assign To (Employee)
                <select value={newTask.assigneeEmail} onChange={e => setNewTask({...newTask, assigneeEmail: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-slate-100" required>
                  <option value="" disabled>Select an employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.email || emp.name || emp.id}>
                      {emp.name || `${emp.firstName || ''} ${emp.lastName || ''}`.trim() || 'Unnamed Employee'} - {emp.email || emp.department || 'No Email'}
                    </option>
                  ))}
                </select>
              </label>
              
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Strict Deadline
                  <input type="date" value={newTask.deadline} onChange={e => setNewTask({...newTask, deadline: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-slate-100" required />
                </label>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Penalty (if missed)
                  <input type="text" placeholder="$50 fine, Formal Warning, etc." value={newTask.penalty} onChange={e => setNewTask({...newTask, penalty: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-slate-100" required />
                </label>
              </div>

              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Detailed Instructions
                <textarea rows="3" placeholder="Provide link to documents and explicit instructions..." value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} className="mt-2 w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 text-slate-900 dark:text-slate-100" required />
              </label>

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="rounded-xl bg-slate-100 dark:bg-slate-800 px-5 py-3 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition">Cancel</button>
                <button type="submit" className="rounded-xl bg-orange-500 px-6 py-3 text-sm font-bold text-white hover:bg-orange-400 transition shadow-lg shadow-orange-500/30">Assign Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* OVERDUE COMPLIANCE / JUSTIFICATION MODAL */}
      {isJustifyModalOpen && selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm px-4 py-6">
          <div className="w-full max-w-md rounded-3xl border-2 border-rose-500 bg-white dark:bg-slate-900 p-8 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-rose-500"></div>
            
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 dark:bg-rose-900/30 mb-6">
              <span className="text-3xl">⚠️</span>
            </div>
            
            <h2 className="text-2xl font-black text-center text-slate-900 dark:text-slate-100 tracking-tight">Deadline Missed</h2>
            <p className="mt-2 text-center text-sm font-medium text-slate-600 dark:text-slate-400">
              You failed to complete the task <span className="font-bold">"{selectedTask.title}"</span> by {selectedTask.deadline}.
            </p>
            <div className="mt-4 p-4 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900">
               <p className="text-xs uppercase tracking-widest font-bold text-rose-500 mb-1">Enforced Penalty</p>
               <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{selectedTask.penalty}</p>
            </div>

            <form onSubmit={handleSubmitJustification} className="mt-6 space-y-4">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                Required Justification
                <span className="block text-xs font-normal text-slate-500 mt-1 mb-2">Provide a detailed explanation to management on why you missed this deadline.</span>
                <textarea 
                  rows="4" 
                  placeholder="I encountered an issue with..." 
                  value={justification} 
                  onChange={e => setJustification(e.target.value)} 
                  className="w-full rounded-2xl border border-rose-300 dark:border-rose-700 bg-rose-50/50 dark:bg-slate-950 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-slate-100 focus:bg-white" 
                  required 
                />
              </label>

              <div className="flex flex-col gap-3 pt-2">
                <button type="submit" className="w-full rounded-xl bg-rose-600 px-6 py-3 text-sm font-bold text-white hover:bg-rose-500 transition shadow-lg shadow-rose-500/30">
                  Acknowledge & Submit to Management
                </button>
                <button type="button" onClick={() => setIsJustifyModalOpen(false)} className="w-full rounded-xl px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition">
                  Cancel for now
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </section>
  )
}

export default Tasks
