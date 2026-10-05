import React, { useEffect } from 'react';
import { X } from 'lucide-react';

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
  confirmDisabled?: boolean;
  footerContent?: React.ReactNode;
  showDefaultButtons?: boolean;
  /**
   * md: 確認ダイアログ向け（既定）。
   * chat: トーク画面向け。PCでは大きく、スマホでは全画面にし、本文はスクロールさせない
   * （中身の側で履歴だけをスクロールさせる）。
   */
  size?: 'md' | 'chat';
  /** タイトルの下に固定で表示する欄（相手の名前など） */
  subHeader?: React.ReactNode;
}

export default function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  children,
  confirmText = '確定',
  cancelText = '閉じる',
  variant = 'primary',
  isLoading = false,
  confirmDisabled = false,
  footerContent,
  showDefaultButtons,
  size = 'md',
  subHeader,
}: ModalProps) {
  const isChat = size === 'chat';

  // トーク画面は作業の途中で閉じたくなることが多いので Esc で閉じられるようにする
  useEffect(() => {
    if (!isOpen || !isChat) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, isChat, isLoading, onClose]);

  if (!isOpen) return null;

  const confirmButtonClass = variant === 'danger' 
    ? 'bg-red-600 hover:bg-red-700 text-white' 
    : variant === 'emerald'
    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
    : 'bg-primary-600 hover:bg-primary-700 text-white';

  // showDefaultButtons が明示的に指定されていない場合:
  // - footerContent がある場合はデフォルトボタンを非表示
  // - footerContent がない場合はデフォルトボタンを表示
  const shouldShowButtons = showDefaultButtons === true || (showDefaultButtons !== false && !footerContent);
  // 既存の画面の見た目を変えないよう、空のフッターを省くのは chat のときだけ
  const showFooter = !isChat || Boolean(footerContent) || shouldShowButtons;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm ${isChat ? 'p-0 sm:p-6' : 'p-4'}`}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={
          isChat
            ? 'bg-white shadow-xl w-full flex flex-col h-[100dvh] sm:h-[min(880px,92vh)] sm:max-w-4xl sm:rounded-xl overflow-hidden'
            : 'bg-white rounded-xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-200'
        }
      >
        <div className={`flex items-center justify-between border-b shrink-0 ${isChat ? 'border-gray-200 px-4 py-3 sm:px-5' : 'p-4'}`}>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
            aria-label="閉じる"
          >
            <X size={20} />
          </button>
        </div>
        {subHeader && <div className="shrink-0 border-b border-gray-200">{subHeader}</div>}
        <div className={isChat ? 'flex-1 min-h-0 flex flex-col' : 'p-6 overflow-y-auto'}>
          {children ? children : <p className="text-gray-600">{message}</p>}
        </div>
        {showFooter && (
        <div className={`flex flex-col sm:flex-row items-stretch sm:items-center ${footerContent ? 'justify-between' : 'justify-end'} gap-4 p-4 bg-gray-50 shrink-0 border-t`}>
          {footerContent && (
            <div className={shouldShowButtons ? "w-full sm:w-auto mr-auto" : "w-full"}>
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
                disabled={isLoading || confirmDisabled}
                className={`flex-1 sm:flex-none px-4 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${confirmButtonClass}`}
              >
                {isLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {confirmText}
              </button>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
