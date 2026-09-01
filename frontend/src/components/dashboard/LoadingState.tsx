export function LoadingState({ message }: { message?: string }) {
  return (
    <div className="loading-state">
      <div className="spinner spinner--large" />
      <p>{message || 'Loading...'}</p>
    </div>
  );
}
