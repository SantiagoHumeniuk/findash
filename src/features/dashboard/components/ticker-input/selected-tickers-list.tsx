// src/features/dashboard/components/ticker-input/selected-tickers-list.tsx

import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../../../../components/ui/button';
import { XIcon, TrendingUp } from 'lucide-react';

interface SelectedTickersListProps {
  tickers: string[];
  onRemoveTicker: (ticker: string) => void;
}

const tickerVariants = {
  initial: {
    opacity: 0,
    scale: 0.3,
    y: 20,
    filter: "blur(10px)",
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 22,
      mass: 0.8,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.5,
    x: -30,
    filter: "blur(6px)",
    transition: {
      duration: 0.25,
      ease: [0.4, 0, 1, 1],
    },
  },
  hover: {
    scale: 1.05,
    y: -2,
    transition: {
      type: "spring",
      stiffness: 500,
      damping: 20,
    },
  },
  tap: {
    scale: 0.95,
  },
};

export function SelectedTickersList({ tickers, onRemoveTicker }: SelectedTickersListProps) {
  if (tickers.length === 0) {
    return null;
  }

  return (
    <motion.div
      className="flex flex-wrap items-center gap-2 pt-4 mt-4 border-t"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex items-center gap-1 text-xs text-muted-foreground mr-1"
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
      >
        <TrendingUp className="w-3.5 h-3.5" />
        <span>{tickers.length} activo{tickers.length !== 1 ? 's' : ''}</span>
      </motion.div>
      <AnimatePresence mode='popLayout'>
        {tickers.map((ticker, index) => (
          <motion.div
            key={ticker}
            layout
            variants={tickerVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            whileHover="hover"
            whileTap="tap"
            custom={index}
            transition={{
              layout: { type: "spring", stiffness: 500, damping: 30 },
            }}
          >
            <div className="flex items-center gap-1.5 pl-3 pr-1.5 py-1 text-sm font-medium rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 hover:border-primary/30 transition-colors shadow-sm">
              <span className="tracking-wide">{ticker}</span>
              <Button
                variant="ghost"
                size="icon"
                className="w-5 h-5 rounded-full hover:bg-destructive/15 hover:text-destructive transition-colors"
                onClick={() => onRemoveTicker(ticker)}
                aria-label={`Quitar ${ticker}`}
              >
                <XIcon className="w-3 h-3" />
              </Button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}