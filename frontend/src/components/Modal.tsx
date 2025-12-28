import React from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm?: () => void;
  title: string;
  message?: string;
  children?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'emerald';
  isLoading?: boolean;
  footerContent?: React.ReactNode;
  showDefaultButtons?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  children,
  confirmText = '確定',
  cancelText = 'キャンセル',
  variant = 'primary',
  isLoading = false,
  footerContent,
  showDefaultButtons = false,
}: ModalProps) {
  if (!isOpen) return null;

  const confirmButtonClass = variant === 'danger' 
    ? 'bg-red-600 hover:bg-red-700 text-white' 
    : variant === 'emerald'
    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
    : 'bg-primary-600 hover:bg-primary-700 text-white';

  const shouldShowButtons = !footerContent || showDefaultButtons;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-4 border-b shrink-0">
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
        </div>
        <div className="p-6 overflow-y-auto">
          {children ? children : <p className="text-gray-600">{message}</p>}
        </div>
        <div className={`flex flex-col sm:flex-row items-stretch sm:items-center ${footerContent ? 'justify-between' : 'justify-end'} gap-4 p-4 bg-gray-50 shrink-0 border-t`}>
          {footerContent && (
            <div className={showDefaultButtons ? "w-full sm:w-auto mr-auto" : "w-full"}>
              {footerContent}
            </div>
          )}
          
          {shouldShowButtons && (
            <div className="flex items-center gap-3 shrink-0 w-full sm:w-auto">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="flex-1 sm:flex-none px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 justify-center flex"
              >
                {cancelText}
              </button>
              <button
                onClick={() => {
                  onConfirm?.();
                }}
                disabled={isLoading}
                className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${confirmButtonClass}`}
              >
                {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {confirmText}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
