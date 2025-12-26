import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle } from 'lucide-react';

interface LiffToastProps {
  isVisible: boolean;
  message: string;
  type?: 'success' | 'error';
  onClose: () => void;
  theme: any;
  duration?: number;
}

export default function LiffToast({
  isVisible,
  message,
  type = 'success',
  onClose,
  theme,
  duration = 3000,
}: LiffToastProps) {
  useEffect(() => {
    if (isVisible && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed top-4 left-0 right-0 z-[100] flex justify-center pointer-events-none px-4">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`
              flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg pointer-events-auto max-w-sm w-full
              ${type === 'success' ? 'bg-white text-gray-800 border-l-4' : 'bg-red-50 text-red-800 border-l-4 border-red-500'}
            `}
            style={type === 'success' ? { borderLeftColor: theme.primaryStyle.backgroundColor || theme.iconColor } : {}}
          >
            {type === 'success' ? (
              <CheckCircle size={20} color={theme.primaryStyle.backgroundColor || theme.iconColor} />
            ) : (
              <AlertCircle size={20} className="text-red-500" />
            )}
            <span className="font-bold text-sm">{message}</span>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
