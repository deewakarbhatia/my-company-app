const Card = ({ title, value, description, accentColor, change, changeType, children }) => {
  const accentBorder = accentColor ? `border-l-[6px]` : ''
  const borderStyle = accentColor ? { borderLeftColor: accentColor } : {}

  return (
    <div 
      className={`relative rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-6 shadow-xl shadow-slate-200/50 dark:shadow-slate-950/20 transition-all duration-300 transform hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-sky-500/10 focus-within:ring-2 focus-within:ring-sky-500/50 ${accentBorder}`}
      style={borderStyle}
    >
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h3>
          {description && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-medium">{description}</p>}
        </div>
        
        {/* Metric Change Indicator */}
        {change && (
          <div className={`flex items-center gap-1 text-sm font-bold px-2.5 py-1 rounded-full ${
            changeType === 'up' 
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' 
              : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400'
          }`}>
            <span>{changeType === 'up' ? '↗' : '↘'}</span>
            {change}
          </div>
        )}
      </div>

      {value !== undefined && value !== null ? (
        <p className="text-4xl font-extrabold text-slate-900 dark:text-slate-50 tracking-tight mt-6">
          {value}
        </p>
      ) : (
        <div className="mt-6">{children}</div>
      )}
    </div>
  )
}

export default Card
