import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy, X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";

import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

interface ShareModalProps {
  readonly open: boolean;
  readonly postId: string;
  readonly title: string;
  readonly linkLabel: string;
  readonly copyLabel: string;
  readonly copiedLabel: string;
  readonly onClose: () => void;
}

/**
 * Bottom-sheet modal for sharing a post link.
 * Displays the post URL and a copy-to-clipboard button.
 * Pressing the backdrop or the close button dismisses the modal.
 */
export function ShareModal({
  open,
  postId,
  title,
  linkLabel,
  copyLabel,
  copiedLabel,
  onClose,
}: ShareModalProps): React.JSX.Element {
  const [copied, setCopied] = React.useState(false);
  const t = useTranslation();

  const postUrl = `${window.location.origin}/post/${postId}`;

  const handleCopy = React.useCallback((): void => {
    const activate = (): void => {
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
      }, 2500);
    };
    try {
      void navigator.clipboard
        .writeText(postUrl)
        .then(activate)
        .catch(activate);
    } catch {
      activate();
    }
  }, [postUrl]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  React.useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0"
            style={{
              zIndex: 10000,
              backgroundColor: "rgba(0,0,0,0.6)",
              backdropFilter: "blur(4px)",
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            aria-hidden
          />

          <motion.div
            className="fixed inset-x-0 bottom-0"
            style={{ zIndex: 10001 }}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 28, stiffness: 320 }}
          >
            <div
              role="dialog"
              aria-modal
              aria-label={title}
              className="mx-auto w-full max-w-[560px] rounded-t-2xl border-t border-surface-border bg-surface-card px-5 pb-10 pt-4"
            >
              <div
                className="mx-auto mb-4 h-1 w-10 rounded-full bg-surface-border"
                aria-hidden
              />

              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold text-content-primary">
                  {title}
                </h2>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-content-muted transition-colors hover:text-content-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  aria-label={t.common.close}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <p className="mb-2 text-xs font-medium text-content-muted">
                {linkLabel}
              </p>
              <div className="flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-3 py-2.5">
                <span className="flex-1 truncate text-sm text-content-secondary font-mono">
                  {postUrl}
                </span>
                <button
                  type="button"
                  onClick={handleCopy}
                  className={cn(
                    "flex shrink-0 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-white transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 min-w-[110px]",
                    copied
                      ? "bg-green-600 hover:bg-green-700 focus-visible:ring-green-500"
                      : "bg-accent hover:bg-accent-hover focus-visible:ring-accent",
                  )}
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      {copiedLabel}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                      {copyLabel}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
