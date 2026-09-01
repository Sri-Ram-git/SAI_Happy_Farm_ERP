import type { ComponentType } from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  message: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ message, icon: Icon, action }: EmptyStateProps) {
  const DisplayIcon = Icon || Inbox;

  return (
    <div className="mgmt-empty-state">
      <div className="mgmt-empty-state-icon">
        <DisplayIcon size={48} />
      </div>
      <p className="mgmt-empty-state-message">{message}</p>
      {action && (
        <button className="mgmt-empty-state-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
