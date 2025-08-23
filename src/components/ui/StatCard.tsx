import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor: string;
  showProgress?: boolean;
  progressValue?: number;
  progressMax?: number;
  progressText?: string;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor,
  showProgress = false,
  progressValue = 0,
  progressMax = 100,
  progressText
}: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="stat-header">
        <div className="stat-info">
          <h3>{title}</h3>
          <p>{value}</p>
        </div>
        <Icon className={`stat-icon ${iconColor}`} size={32} />
      </div>
      
      {showProgress && (
        <div className="progress-bar-container">
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${(progressValue / progressMax) * 100}%` }}
            />
          </div>
          {progressText && <p className="progress-text">{progressText}</p>}
        </div>
      )}
      
      {!showProgress && progressText && (
        <p className="progress-text">{progressText}</p>
      )}
    </div>
  );
}