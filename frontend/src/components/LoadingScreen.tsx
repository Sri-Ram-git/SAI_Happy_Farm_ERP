export function LoadingScreen() {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="spinner spinner--large" />
        <p>Verifying authentication...</p>
      </div>
    </div>
  );
}
