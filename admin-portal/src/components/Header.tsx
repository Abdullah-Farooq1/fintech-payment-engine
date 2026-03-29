import { Bell, RefreshCw } from "lucide-react";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
}

export const Header = ({ title, subtitle, onRefresh }: HeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-8">
      <div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {subtitle && (
          <p className="text-gray-400 text-sm mt-1">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        )}
        <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary-500 rounded-full" />
        </button>
      </div>
    </div>
  );
};