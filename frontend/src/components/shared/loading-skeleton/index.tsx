import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import * as React from 'react';

/**
 * Full-height loading card displayed at the end of the snap-feed while JIT
 * generation runs. Uses a gradient shimmer background to blend naturally with
 * the PostCard aesthetic, plus a subtle spinner and label.
 */
export function LoadingSkeleton(): React.JSX.Element {
  return (
    <motion.div
      className="snap-card h-full relative flex flex-col items-center justify-center overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-accent-muted via-surface to-surface-elevated" />

      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: 'linear-gradient(135deg, transparent 25%, rgba(79,70,229,0.15) 50%, transparent 75%)',
          backgroundSize: '200% 200%',
          animation: 'shimmer 2.2s linear infinite',
        }}
      />

      <div className="relative flex flex-col items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/20 backdrop-blur-sm">
          <Sparkles className="h-7 w-7 text-accent-light" aria-hidden />
        </div>

        <div className="flex items-center gap-2">
          <div className="h-1.5 w-1.5 rounded-full bg-accent-light animate-bounce" style={{ animationDelay: '0ms' }} />
          <div className="h-1.5 w-1.5 rounded-full bg-accent-light animate-bounce" style={{ animationDelay: '150ms' }} />
          <div className="h-1.5 w-1.5 rounded-full bg-accent-light animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>

      <div className="absolute bottom-8 left-6 right-6 flex flex-col gap-3">
        <div className="flex gap-2">
          {[14, 20, 16].map((w) => (
            <div
              key={w}
              className="h-6 rounded-full bg-white/10 animate-pulse"
              style={{ width: `${String(w * 4)}px` }}
            />
          ))}
        </div>
        <div className="h-8 w-3/4 rounded-lg bg-white/10 animate-pulse" />
        <div className="flex flex-col gap-1.5">
          <div className="h-4 w-full rounded bg-white/10 animate-pulse" />
          <div className="h-4 w-4/5 rounded bg-white/10 animate-pulse" />
        </div>
      </div>
    </motion.div>
  );
}
