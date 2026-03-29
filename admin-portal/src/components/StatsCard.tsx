import type { LucideIcon } from "lucide-react";


interface StatsCardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  color?: "blue" | "green" | "red" | "yellow";
}

const colorMap = {
  blue:   { bg: "bg-blue-900/30",   icon: "text-blue-400",   border: "border-blue-800/50" },
  green:  { bg: "bg-green-900/30",  icon: "text-green-400",  border: "border-green-800/50" },
  red:    { bg: "bg-red-900/30",    icon: "text-red-400",    border: "border-red-800/50" },
  yellow: { bg: "bg-yellow-900/30", icon: "text-yellow-400", border: "border-yellow-800/50" },
};

export const StatsCard = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = "blue",
}: StatsCardProps) => {
  const colors = colorMap[color];

  return (
    <div className={`card border ${colors.border}`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm font-medium">{title}</p>
          <p className="text-2xl font-bold text-white mt-2">{value}</p>
          {subtitle && (
            <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`${colors.bg} p-3 rounded-lg`}>
          <Icon className={`w-6 h-6 ${colors.icon}`} />
        </div>
      </div>
    </div>
  );
};