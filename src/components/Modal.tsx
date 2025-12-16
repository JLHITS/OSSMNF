import type { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  actions?: ReactNode;
  type?: 'info' | 'confirm' | 'error' | 'success';
}

export function Modal({ isOpen, onClose, title, children, actions, type = 'info' }: ModalProps) {
  if (!isOpen) return null;

  const getIconForType = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '⚠';
      case 'confirm':
        return '?';
      default:
        return 'ℹ';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className={`modal-header modal-header-${type}`}>
          <span className="modal-icon">{getIconForType()}</span>
          {title && <h3>{title}</h3>}
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}

interface AlertProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'info';
}

export function Alert({ isOpen, onClose, title, message, type = 'info' }: AlertProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} type={type}>
      <p>{message}</p>
      <div className="modal-actions">
        <button onClick={onClose} className="btn btn-primary">
          OK
        </button>
      </div>
    </Modal>
  );
}

interface ConfirmProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'confirm' | 'error';
}

export function Confirm({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  type = 'confirm',
}: ConfirmProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} type={type}>
      <p>{message}</p>
      <div className="modal-actions">
        <button onClick={onClose} className="btn btn-secondary">
          {cancelText}
        </button>
        <button onClick={handleConfirm} className={`btn ${type === 'error' ? 'btn-danger' : 'btn-primary'}`}>
          {confirmText}
        </button>
      </div>
    </Modal>
  );
}
