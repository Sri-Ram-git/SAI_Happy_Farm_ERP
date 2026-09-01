interface LoadingStateProps {
  message?: string;
  type?: 'cards' | 'table' | 'chart';
}

function SkeletonCard() {
  return <div className="mgmt-skeleton mgmt-skeleton--card" />;
}

function SkeletonRow() {
  return <div className="mgmt-skeleton mgmt-skeleton--row" />;
}

function SkeletonChart() {
  return <div className="mgmt-skeleton mgmt-skeleton--chart" />;
}

function SkeletonCards() {
  return (
    <div className="mgmt-skeleton-grid">
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="mgmt-skeleton-table">
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}

function SkeletonChartView() {
  return (
    <div className="mgmt-skeleton-chart-container">
      <SkeletonChart />
    </div>
  );
}

export function LoadingState({ message, type = 'cards' }: LoadingStateProps) {
  return (
    <div className="mgmt-loading-state">
      <div className="mgmt-loading-content">
        {type === 'cards' && <SkeletonCards />}
        {type === 'table' && <SkeletonTable />}
        {type === 'chart' && <SkeletonChartView />}
      </div>
      <p className="mgmt-loading-text">{message || 'Loading...'}</p>
    </div>
  );
}
