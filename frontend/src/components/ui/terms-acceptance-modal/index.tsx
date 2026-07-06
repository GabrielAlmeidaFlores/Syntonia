import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, Scale } from "lucide-react";
import * as React from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Spinner } from "@/components/shared/spinner";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { api, getApiErrorMessage } from "@/services/api";
import { useTermsStore } from "@/stores/terms";
import { useToastStore } from "@/stores/toast";
import type { AcceptTermsResponse, LegalDocument } from "@/types";

/**
 * Full-screen blocking modal shown when the backend reports that the user
 * must accept new Terms of Use and/or Privacy Policy before continuing.
 *
 * Cannot be dismissed without accepting — no backdrop click, no Escape key,
 * no close button. The user must scroll through (or expand) both documents
 * and check the acceptance checkbox before the confirm button activates.
 *
 * Rendered via React Portal in document.body at z-index 99999 so it sits
 * above every other element in the app.
 */
export function TermsAcceptanceModal(): React.JSX.Element {
  const needsAcceptance = useTermsStore((s) => s.needsAcceptance);
  const termsVersion = useTermsStore((s) => s.termsVersion);
  const privacyVersion = useTermsStore((s) => s.privacyVersion);
  const clearAcceptance = useTermsStore((s) => s.clearAcceptance);
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const [termsDoc, setTermsDoc] = React.useState<LegalDocument | null>(null);
  const [privacyDoc, setPrivacyDoc] = React.useState<LegalDocument | null>(
    null,
  );
  const [loadingDocs, setLoadingDocs] = React.useState(false);
  const [termsExpanded, setTermsExpanded] = React.useState(true);
  const [privacyExpanded, setPrivacyExpanded] = React.useState(true);
  const [accepted, setAccepted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!needsAcceptance) return;
    setLoadingDocs(true);
    void Promise.all([
      api.get<LegalDocument>("/legal/terms"),
      api.get<LegalDocument>("/legal/privacy"),
    ])
      .then(([terms, privacy]) => {
        setTermsDoc(terms);
        setPrivacyDoc(privacy);
      })
      .finally(() => {
        setLoadingDocs(false);
      });
  }, [needsAcceptance]);

  const handleAccept = React.useCallback((): void => {
    if (!accepted || submitting) return;
    setSubmitting(true);
    void api
      .post<AcceptTermsResponse>("/legal/accept", {
        termsVersion,
        privacyVersion,
      })
      .then(() => {
        clearAcceptance();
      })
      .catch((err: unknown) => {
        addToast({ type: "error", message: getApiErrorMessage(err, t.errors) });
        setSubmitting(false);
      });
  }, [
    accepted,
    submitting,
    termsVersion,
    privacyVersion,
    clearAcceptance,
    addToast,
    t,
  ]);

  return createPortal(
    <AnimatePresence>
      {needsAcceptance && (
        <motion.div
          className="fixed inset-0 flex justify-center bg-black/40"
          style={{ zIndex: 99999 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="flex h-full w-full max-w-[560px] flex-col bg-surface">
            <div className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin">
              <div className="flex flex-col items-center gap-3 border-b border-surface-border px-6 py-8 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-muted">
                  <Scale className="h-7 w-7 text-accent-light" aria-hidden />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-content-primary">
                    {t.legal.acceptTitle}
                  </h1>
                  <p className="mt-1 text-sm text-content-muted">
                    {t.legal.acceptSubtitle}
                  </p>
                </div>
              </div>

              <div className="px-6 py-4">
                {loadingDocs ? (
                  <div className="flex items-center justify-center py-20">
                    <Spinner size="md" />
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <DocAccordion
                      title={t.legal.termsTitle}
                      doc={termsDoc}
                      expanded={termsExpanded}
                      onToggle={() => {
                        setTermsExpanded((v) => !v);
                      }}
                    />
                    <DocAccordion
                      title={t.legal.privacyTitle}
                      doc={privacyDoc}
                      expanded={privacyExpanded}
                      onToggle={() => {
                        setPrivacyExpanded((v) => !v);
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 border-t border-surface-border px-6 pb-10 pt-5">
              <label className="mb-5 flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={accepted}
                  onChange={(e) => {
                    setAccepted(e.target.checked);
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
                />
                <span className="text-sm text-content-secondary">
                  {t.legal.acceptCheckbox}
                </span>
              </label>

              <Button
                variant="primary"
                className="w-full"
                disabled={!accepted || submitting || loadingDocs}
                onClick={handleAccept}
              >
                {submitting ? t.legal.acceptLoading : t.legal.acceptButton}
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

interface DocAccordionProps {
  readonly title: string;
  readonly doc: LegalDocument | null;
  readonly expanded: boolean;
  readonly onToggle: () => void;
}

/** Collapsible accordion showing one legal document inside the acceptance modal. */
function DocAccordion({
  title,
  doc,
  expanded,
  onToggle,
}: DocAccordionProps): React.JSX.Element {
  return (
    <div className="overflow-hidden rounded-xl border border-surface-border bg-surface-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors hover:bg-surface-elevated"
        aria-expanded={expanded}
      >
        <span className="text-sm font-medium text-content-primary">
          {title}
        </span>
        {expanded ? (
          <ChevronUp
            className="h-4 w-4 shrink-0 text-content-muted"
            aria-hidden
          />
        ) : (
          <ChevronDown
            className="h-4 w-4 shrink-0 text-content-muted"
            aria-hidden
          />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "tween", ease: "easeOut", duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="border-t border-surface-border px-4 py-4">
              {doc !== null ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {doc.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm text-content-muted">Loading…</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
