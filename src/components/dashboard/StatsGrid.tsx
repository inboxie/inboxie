import { TrendingUp, Reply, Crown, Users, CheckCircle, Clock } from 'lucide-react';
import StatCard from '../ui/StatCard';

interface UserStats {
  planType: 'free' | 'paid';
  emailsProcessed: number;
  limit: number;
  features: string[];
}

interface StatsGridProps {
  userStats: UserStats;
  allResultsLength: number;
  isProcessing: boolean;
}

export default function StatsGrid({ userStats, allResultsLength, isProcessing }: StatsGridProps) {
  return (
    <div className="stats-grid">
      <StatCard
        title="Emails Processed"
        value={userStats.emailsProcessed}
        icon={TrendingUp}
        iconColor="blue"
        showProgress={true}
        progressValue={userStats.emailsProcessed}
        progressMax={userStats.limit}
        progressText={`${userStats.limit - userStats.emailsProcessed} remaining`}
      />

      <StatCard
        title="Ready to Reply"
        value={allResultsLength}
        icon={Reply}
        iconColor="green"
        progressText="Processed emails with Reply"
      />

      <StatCard
        title="Plan Status"
        value={userStats.planType}
        icon={userStats.planType === 'paid' ? Crown : Users}
        iconColor={userStats.planType === 'paid' ? 'yellow' : 'blue'}
        progressText={userStats.planType === 'free' ? '$9/month to upgrade' : 'Pro subscriber'}
      />

      <StatCard
        title="Processing"
        value={isProcessing ? 'Active' : 'Ready'}
        icon={isProcessing ? Clock : CheckCircle}
        iconColor={isProcessing ? 'orange' : 'green'}
        progressText={isProcessing ? 'Categorizing emails...' : 'Ready to process'}
      />
    </div>
  );
}