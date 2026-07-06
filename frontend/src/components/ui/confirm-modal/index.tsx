import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import { createPortal } from "react-dom";

import { Button } from "@/components/ui/button";

interface ConfirmModalProps {
  readonly open: boolean;
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  /** Visual variant of the confirm button. Defaults to 'destructive'. */
  readonly confirmVariant?: "destructive" | "primary";
}

const SHEET_ENTER = { type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.28 } as const;
const SHEET_EXIT = { type: "tween", ease: [0.72, 0, 0.28, 1], duration: 0.2 } as const;
const OVERLAY = { type: "tween", ease: "easeOut", duration: 0.18 } as const;

/**
 * Accessible bottom-sheet confirmation modal rendered via React Portal.
 * Slides in from the bottom on both mobile and desktop.
 * On desktop, the sheet is capped at max-w-[560px] and centered.
 * Pressing the backdrop or cancel button dismisses without confirming.
 * Escape key also dismisses.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  confirmVariant = "destructive",
}: ConfirmModalProps): React.JSX.Element {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60"
            style={{ zIndex: 10000 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={OVERLAY}
            onClick={onCancel}
            aria-hidden
          />

          <motion.div
            className="fixed inset-x-0 bottom-0"
            style={{ zIndex: 10001, willChange: "transform" }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%", transition: SHEET_EXIT }}
            transition={SHEET_ENTER}
          >
            <div
              role="dialog"
              aria-modal
              aria-labelledby="confirm-title"
              aria-describedby="confirm-message"
              className="mx-auto w-full max-w-[560px] rounded-t-2xl border-t border-surface-border bg-surface-card px-5 pb-10 pt-4"
            >
              <div
                className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-border"
                aria-hidden
              />

              <h2
                id="confirm-title"
                className="text-lg font-semibold text-content-primary"
              >
                {title}
              </h2>

              <p
                id="confirm-message"
                className="mt-1.5 mb-6 text-sm text-content-muted"
              >
                {message}
              </p>

              <div className="flex flex-col gap-3">
                <Button
                  variant={confirmVariant}
                  className="w-full"
                  onClick={onConfirm}
                >
                  {confirmLabel}
                </Button>
                <Button variant="ghost" className="w-full" onClick={onCancel}>
                  {cancelLabel}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
