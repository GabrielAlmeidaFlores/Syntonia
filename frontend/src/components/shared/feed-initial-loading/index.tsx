import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import * as React from "react";

import { useTranslation } from "@/hooks/use-translation";

interface SkeletonRow {
  readonly id: string;
  readonly tag1: string;
  readonly tag2: string;
  readonly tag3?: string;
  readonly title: string;
  readonly delay: number;
}

const SKELETON_ROWS: SkeletonRow[] = [
  {
    id: "row-a",
    tag1: "w-14",
    tag2: "w-20",
    tag3: "w-16",
    title: "w-3/4",
    delay: 0,
  },
  { id: "row-b", tag1: "w-16", tag2: "w-12", title: "w-2/3", delay: 0.05 },
  {
    id: "row-c",
    tag1: "w-20",
    tag2: "w-14",
    tag3: "w-16",
    title: "w-4/5",
    delay: 0.1,
  },
];

/**
 * Full-screen loading state shown when the feed is fetching the first batch
 * of posts, or when JIT generation is running at the end of the snap-feed.
 * Displays a gradient background, an animated icon, bouncing dots, and
 * skeleton rows that mimic the PostCard layout.
 */
export function FeedInitialLoading(): React.JSX.Element {
  const t = useTranslation();

  return (
    <div className="h-full w-full relative overflow-hidden bg-surface flex flex-col">
      <div className="absolute inset-0 bg-gradient-to-br from-accent-muted/60 via-surface to-surface" />

      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage:
            "linear-gradient(135deg, transparent 25%, rgba(79,70,229,0.2) 50%, transparent 75%)",
          backgroundSize: "200% 200%",
          animation: "shimmer 2.4s linear infinite",
        }}
      />

      <div className="relative flex flex-1 flex-col items-center justify-center gap-6 px-8">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 18, stiffness: 200 }}
          className="flex h-20 w-20 items-center justify-center rounded-3xl bg-accent/20 backdrop-blur-sm ring-1 ring-accent/30"
        >
          <Sparkles className="h-10 w-10 text-accent-light" aria-hidden />
        </motion.div>

        <motion.div
          className="flex flex-col items-center gap-2 text-center"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <p className="text-sm font-medium text-content-muted">
            {t.feedLoading.heading}
          </p>

          <div className="flex items-center gap-1.5 mt-1">
            {[0, 150, 300].map((delay) => (
              <div
                key={delay}
                className="h-1.5 w-1.5 rounded-full bg-accent-light/60 animate-bounce"
                style={{ animationDelay: `${String(delay)}ms` }}
              />
            ))}
          </div>
        </motion.div>
      </div>

      <div className="relative px-6 pb-28 flex flex-col gap-4">
        {SKELETON_ROWS.map((row) => (
          <motion.div
            key={row.id}
            className="flex flex-col gap-2"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + row.delay, duration: 0.25 }}
          >
            <div className="flex gap-2">
              <div
                className={`h-5 ${row.tag1} rounded-full bg-white/10 animate-pulse`}
              />
              <div
                className={`h-5 ${row.tag2} rounded-full bg-white/10 animate-pulse`}
              />
              {row.tag3 !== undefined && (
                <div
                  className={`h-5 ${row.tag3} rounded-full bg-white/10 animate-pulse`}
                />
              )}
            </div>
            <div
              className={`h-6 ${row.title} rounded-lg bg-white/10 animate-pulse`}
            />
            <div
              className={`h-3 w-full rounded bg-white/[0.08] animate-pulse`}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
