import React from 'react';
import { useNotification, ToastMessage } from '../../context/NotificationContext';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useNotification();

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-[#5F8D65]" />,
    error: <AlertCircle className="w-5 h-5 text-[#C85C5C]" />,
    warning: <AlertTriangle className="w-5 h-5 text-[#D9A441]" />,
    info: <Info className="w-5 h-5 text-[#668FA3]" />,
  };

  const borders = {
    success: 'border-[#5F8D65]/40',
    error: 'border-[#C85C5C]/40',
    warning: 'border-[#D9A441]/40',
    info: 'border-[#668FA3]/40',
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast: ToastMessage) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 15, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className={`pointer-events-auto flex items-start gap-3 p-4 bg-white border ${borders[toast.type]} rounded-2xl shadow-xl`}
          >
            <span className="shrink-0 mt-0.5">{icons[toast.type]}</span>
            <div className="flex-1 min-w-0">
              <h5 className="text-xs font-bold text-[#26352A]">{toast.title}</h5>
              {toast.message && <p className="text-xs text-[#66736A] mt-0.5">{toast.message}</p>}
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-[#66736A] hover:text-[#26352A] p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
