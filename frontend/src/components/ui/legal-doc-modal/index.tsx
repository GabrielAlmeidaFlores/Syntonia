import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Spinner } from "@/components/shared/spinner";
import { useTranslation } from "@/hooks/use-translation";
import { formatDate } from "@/lib/utils";
import { api } from "@/services/api";
import type { LegalDocument } from "@/types";

interface LegalDocModalProps {
  readonly open: boolean;
  readonly docType: "terms" | "privacy";
  readonly onClose: () => void;
}

/**
 * Full-screen overlay that loads and renders a legal document (Terms of Use or
 * Privacy Policy) from the backend as Markdown. Slides in from the bottom.
 * Closes via the X button or Escape key.
 */
export function LegalDocModal({
  open,
  docType,
  onClose,
}: LegalDocModalProps): React.JSX.Element {
  const t = useTranslation();
  const [doc, setDoc] = React.useState<LegalDocument | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setDoc(null);
    setError(false);
    setLoading(true);
    void api
      .get<LegalDocument>(`/legal/${docType}`)
      .then((data) => {
        setDoc(data);
      })
      .catch(() => {
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [open, docType]);

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

  const title = docType === "terms" ? t.legal.termsTitle : t.legal.privacyTitle;

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0"
            style={{
              zIndex: 10000,
              backgroundColor: "rgba(0,0,0,0.7)",
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
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
          >
            <div
              role="dialog"
              aria-modal
              aria-label={title}
              className="mx-auto flex w-full max-w-[560px] flex-col rounded-t-2xl border-t border-surface-border bg-surface-card"
              style={{ maxHeight: "88dvh" }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-surface-border px-5 py-4">
                <div>
                  <h2 className="text-base font-semibold text-content-primary">
                    {title}
                  </h2>
                  {doc !== null && (
                    <p className="mt-0.5 text-xs text-content-subtle">
                      {t.legal.version(doc.version)} ·{" "}
                      {t.legal.updatedAt(formatDate(doc.updatedAt))}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-content-muted transition-colors hover:text-content-primary"
                  aria-label={t.common.close}
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto overscroll-y-contain px-5 py-6 scrollbar-thin">
                {loading && (
                  <div className="flex items-center justify-center py-16">
                    <Spinner size="md" />
                  </div>
                )}
                {error && (
                  <p className="py-16 text-center text-sm text-content-muted">
                    {t.legal.loadingError}
                  </p>
                )}
                {doc !== null && (
                  <div className="prose prose-sm prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {doc.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}
