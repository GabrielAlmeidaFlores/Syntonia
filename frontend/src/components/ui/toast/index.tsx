import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle, Info, TriangleAlert, X, XCircle } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";
import { useToastStore, type ToastType } from "@/stores/toast";

/** Duration of the exit animation in ms. */
const EXIT_MS = 300;

interface AccentConfig {
  readonly bar: string;
  readonly icon: React.JSX.Element;
}

/** Returns the accent bar color and icon for each toast type. */
function toastAccent(type: ToastType): AccentConfig {
  switch (type) {
    case "success":
      return {
        bar: "bg-green-500",
        icon: (
          <CheckCircle
            className="h-4 w-4 shrink-0 text-green-500"
            aria-hidden
          />
        ),
      };
    case "error":
      return {
        bar: "bg-red-500",
        icon: <XCircle className="h-4 w-4 shrink-0 text-red-500" aria-hidden />,
      };
    case "warning":
      return {
        bar: "bg-amber-400",
        icon: (
          <TriangleAlert
            className="h-4 w-4 shrink-0 text-amber-400"
            aria-hidden
          />
        ),
      };
    case "info":
      return {
        bar: "bg-blue-500",
        icon: <Info className="h-4 w-4 shrink-0 text-blue-500" aria-hidden />,
      };
  }
}

function ToastItem({
  id,
  type,
  message,
  duration = 4000,
}: {
  readonly id: string;
  readonly type: ToastType;
  readonly message: string;
  readonly duration?: number;
}): React.JSX.Element {
  const removeToast = useToastStore((s) => s.removeToast);
  const { bar, icon } = toastAccent(type);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    return () => {
      clearTimeout(timer);
    };
  }, [id, duration, removeToast]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.94 }}
      transition={{
        layout: { type: "spring", damping: 26, stiffness: 320 },
        opacity: { duration: EXIT_MS / 1000, ease: "easeInOut" },
        x: { type: "spring", damping: 24, stiffness: 280 },
        scale: { duration: EXIT_MS / 1000 },
      }}
      role="status"
      aria-live="polite"
      className={cn(
        "relative flex w-full items-start gap-3 overflow-hidden rounded-xl",
        "border border-surface-border bg-surface-card px-4 py-3.5",
        "shadow-[0_8px_32px_-4px_rgba(0,0,0,0.25)]",
      )}
    >
      <div
        className={cn("absolute left-0 top-0 h-full w-1 rounded-l-xl", bar)}
        aria-hidden
      />

      <div className="ml-1 mt-0.5">{icon}</div>

      <p className="flex-1 text-sm leading-snug text-content-primary">
        {message}
      </p>

      <button
        type="button"
        onClick={() => {
          removeToast(id);
        }}
        className="mt-0.5 shrink-0 rounded p-0.5 text-content-muted transition-colors hover:text-content-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
        aria-label="Dismiss notification"
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </button>
    </motion.div>
  );
}

/**
 * Fixed top-right container that renders all active toasts with smooth
 * enter, exit and layout animations via Framer Motion.
 * `mode="popLayout"` makes exiting toasts "pop out" of the layout flow
 * immediately so the remaining toasts animate to their new positions
 * simultaneously — giving a fluid stacking effect.
 */
export function ToastContainer(): React.JSX.Element {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div
      className="fixed right-4 top-4 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false} mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} {...t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
