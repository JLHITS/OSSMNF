interface LoadingOverlayProps {
  isVisible: boolean;
  message?: string;
}

export function LoadingOverlay({
  isVisible,
  message = 'Teams are being generated...',
}: LoadingOverlayProps) {
  if (!isVisible) return null;

  return (
    <div className="loading-overlay">
      <div className="loading-content">
        <div className="loading-spinner" />
        <p className="loading-message">{message}</p>
        <p className="loading-hint">Please wait, this may take a moment</p>
      </div>
    </div>
  );
}
