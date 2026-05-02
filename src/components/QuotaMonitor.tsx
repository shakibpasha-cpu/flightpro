import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, Clock, ZapOff } from 'lucide-react';
import { addCooldownListener, getQuotaCooldown } from '../services/aiService';

export const QuotaMonitor: React.FC = () => {
  const [cooldown, setCooldown] = useState(getQuotaCooldown());

  useEffect(() => {
    const removeListener = addCooldownListener((newCooldown) => {
      setCooldown(newCooldown);
    });

    const interval = setInterval(() => {
      const current = getQuotaCooldown();
      setCooldown(current);
    }, 1000);

    return () => {
      removeListener();
      clearInterval(interval);
    };
  }, []);

  if (cooldown <= 0) return null;

  const minutes = Math.floor(cooldown / 60000);
  const seconds = Math.floor((cooldown % 60000) / 1000);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
      >
        <div className="bg-amber-50 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800 p-4 rounded-2xl shadow-xl backdrop-blur-md flex items-start gap-4">
          <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/60 rounded-xl flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <ZapOff size={20} />
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-amber-900 dark:text-amber-100 text-sm">AI Quota Exceeded</h4>
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Gemini AI is currently busy. Intelligence features will be limited to cached data for a moment.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
              <Clock size={12} />
              <span>Retry in {minutes}:{seconds.toString().padStart(2, '0')}</span>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
