import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, X } from 'lucide-react';

interface WarningBannerProps {
  message: string;
  onClose: () => void;
  isVisible: boolean;
}

export default function WarningBanner({ message, onClose, isVisible }: WarningBannerProps) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-md bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 flex items-start gap-3"
        >
          <div className="flex-shrink-0 mt-0.5">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-grow">
            <p className="text-sm font-medium text-red-800 leading-relaxed">
              {message}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
