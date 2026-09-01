export function EmptyState({ message, icon }: { message: string; icon?: string }) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon" dangerouslySetInnerHTML={{ __html: icon || '&#128196;' }} />
      <p>{message}</p>
    </div>
  );
}
