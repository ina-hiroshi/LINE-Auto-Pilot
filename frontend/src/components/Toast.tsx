import { useEffect } from 'react';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface ToastProps {
  isVisible: boolean;
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
  duration?: number;
}

export default function Toast({
  isVisible,
  message,
  type = 'success',
  onClose,
  duration = 3000,
}: ToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  if (!isVisible) return null;

  const bgColor = type === 'success' ? 'bg-primary-600' : 'bg-red-600';
  const Icon = type === 'success' ? CheckCircle : AlertCircle;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none">
      <div className={`
        flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl text-white pointer-events-auto
        animate-in fade-in zoom-in slide-in-from-bottom-4 duration-300
        ${bgColor}
      `}>
        <Icon size={24} />
        <span className="font-medium">{message}</span>
      </div>
    </div>
  );
}
