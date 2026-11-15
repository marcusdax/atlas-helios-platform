import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

// ============================================================================
// UI COMPONENTS
// ============================================================================

export const Card = ({ children, className, glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) => (
  <motion.div 
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className={cn(
      "bg-slate-900/80 backdrop-blur-xl rounded-xl border border-slate-700/50 overflow-hidden",
      glow && "shadow-[0_0_30px_rgba(6,182,212,0.15)] border-cyan-500/30",
      className
    )}
  >
    {children}
  </motion.div>
);

export const CardHeader = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) => (
  <div className="px-5 py-4 border-b border-slate-700/50 flex items-center justify-between">
    <div>
      <h3 className="text-lg font-semibold text-slate-100">{title}</h3>
      {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
);

export const Badge = ({ children, variant = "default", size = "md" }: { children: React.ReactNode; variant?: string; size?: string }) => {
  const variants: Record<string, string> = {
    default: "bg-slate-700 text-slate-200",
    success: "bg-green-500/20 text-green-400 border border-green-500/30",
    warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
    danger: "bg-red-500/20 text-red-400 border border-red-500/30",
    info: "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30",
    primary: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  };
  const sizes: Record<string, string> = { sm: "px-2 py-0.5 text-xs", md: "px-3 py-1 text-sm", lg: "px-4 py-1.5 text-base" };
  return (
    <span className={cn("rounded-full font-medium", variants[variant], sizes[size])}>
      {children}
    </span>
  );
};

export const Button = ({ children, variant = "primary", size = "md", className, onClick, disabled }: { 
  children: React.ReactNode; variant?: string; size?: string; className?: string; onClick?: () => void; disabled?: boolean 
}) => {
  const variants: Record<string, string> = {
    primary: "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-500/25",
    secondary: "bg-slate-700 hover:bg-slate-600 text-slate-200",
    outline: "border border-slate-600 hover:bg-slate-800 text-slate-300",
    ghost: "hover:bg-slate-800 text-slate-400 hover:text-slate-200",
    danger: "bg-red-600 hover:bg-red-500 text-white",
    success: "bg-green-600 hover:bg-green-500 text-white",
  };
  const sizes: Record<string, string> = { sm: "px-3 py-1.5 text-sm", md: "px-4 py-2 text-base", lg: "px-6 py-3 text-lg" };
  return (
    <motion.button
      whileHover={{ scale: disabled ? 1 : 1.02 }}
      whileTap={{ scale: disabled ? 1 : 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className={cn("rounded-lg font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed", variants[variant], sizes[size], className)}
    >
      {children}
    </motion.button>
  );
};

export const ProgressBar = ({ value, max = 100, color = "cyan", size = "md", showValue = true, className }: { 
  value: number; max?: number; color?: string; size?: string; showValue?: boolean; className?: string 
}) => {
  const colors: Record<string, string> = {
    cyan: "from-cyan-500 to-blue-500",
    green: "from-green-500 to-emerald-500",
    amber: "from-amber-500 to-orange-500",
    red: "from-red-500 to-rose-500",
    purple: "from-purple-500 to-violet-500",
  };
  const sizes: Record<string, string> = { sm: "h-1.5", md: "h-2.5", lg: "h-4" };
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className={cn("flex-1 bg-slate-700/50 rounded-full overflow-hidden", sizes[size])}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full bg-gradient-to-r", colors[color])}
        />
      </div>
      {showValue && <span className="text-sm font-medium text-slate-400 w-12 text-right">{percentage.toFixed(0)}%</span>}
    </div>
  );
};

export const StatCard = ({ label, value, delta, icon, color, trend }: { label: string; value: string; delta: string; icon: string; color: string; trend?: number[] }) => {
  const isPositive = delta.startsWith("+") || !delta.includes("-");
  return (
    <Card className="p-5 relative overflow-hidden group hover:border-slate-600 transition-colors">
      <div className="absolute top-0 right-0 w-24 h-24 opacity-10 rounded-full -translate-y-1/2 translate-x-1/2" style={{ backgroundColor: color }} />
      <div className="flex items-start justify-between mb-3">
        <span className="text-3xl">{icon}</span>
        <div className={cn("flex items-center gap-1 text-sm font-medium", isPositive ? "text-green-400" : "text-red-400")}>
          <span>{isPositive ? "↑" : "↓"}</span>
          <span>{delta}</span>
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-100 mb-1">{value}</div>
      <div className="text-sm text-slate-400">{label}</div>
      {trend && (
        <div className="mt-3 h-10">
          <svg viewBox="0 0 100 30" className="w-full h-full">
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2"
              points={trend.map((v, i) => `${i * (100 / (trend.length - 1))},${30 - (v - Math.min(...trend)) / (Math.max(...trend) - Math.min(...trend)) * 25}`).join(' ')}
            />
            <polygon
              fill={color}
              fillOpacity="0.2"
              points={`0,30 ${trend.map((v, i) => `${i * (100 / (trend.length - 1))},${30 - (v - Math.min(...trend)) / (Math.max(...trend) - Math.min(...trend)) * 25}`).join(' ')} 100,30`}
            />
          </svg>
        </div>
      )}
    </Card>
  );
};

export const DataTable = ({ columns, data, onRowClick }: { columns: { key: string; label: string; render?: (row: any) => React.ReactNode }[]; data: any[]; onRowClick?: (row: any) => void }) => (
  <div className="overflow-x-auto">
    <table className="w-full">
      <thead>
        <tr className="border-b border-slate-700/50">
          {columns.map(col => (
            <th key={col.key} className="text-left py-3 px-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              {col.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((row, idx) => (
          <motion.tr
            key={row.id || idx}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            onClick={() => onRowClick?.(row)}
            className={cn("border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors", onRowClick && "cursor-pointer")}
          >
            {columns.map(col => (
              <td key={col.key} className="py-3 px-4 text-sm text-slate-300">
                {col.render ? col.render(row) : row[col.key]}
              </td>
            ))}
          </motion.tr>
        ))}
      </tbody>
    </table>
  </div>
);
