import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface LiffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  theme: any; // Using any for flexibility with the dynamic theme object
  isLoading?: boolean;
}

export default function LiffModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'はい',
  cancelText = 'いいえ',
  theme,
  isLoading = false,
}: LiffModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className={`${theme.card} w-full max-w-sm overflow-hidden relative z-10`}
            style={theme.cardStyle}
          >
            <div className={theme.header} style={theme.headerStyle}>
              <h3 className={theme.title} style={theme.titleStyle}>{title}</h3>
              <button 
                onClick={onClose}
                className="absolute top-4 right-4 opacity-50 hover:opacity-100 transition-opacity"
              >
                <X size={20} color={theme.iconColor} />
              </button>
            </div>
            
            <div className="p-6 text-center">
              <p className="text-gray-600 mb-6 whitespace-pre-wrap">{message}</p>
              
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className={theme.buttonSecondary}
                  disabled={isLoading}
                >
                  {cancelText}
                </button>
                <button
                  onClick={onConfirm}
                  className={theme.buttonPrimary}
                  style={theme.primaryStyle}
                  disabled={isLoading}
                >
                  {isLoading ? '処理中...' : confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
