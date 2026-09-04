import type { ReactNode } from 'react';
import { FileText } from 'lucide-react';

export function EmptyState({ message, icon }: { message: string; icon?: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        {icon || <FileText size={40} className="text-muted" />}
      </div>
      <p>{message}</p>
    </div>
  );
}
