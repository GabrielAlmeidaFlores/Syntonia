import { ChevronRight, FileText, Shield } from "lucide-react";
import * as React from "react";

import { LegalDocModal } from "@/components/ui/legal-doc-modal";
import { useTranslation } from "@/hooks/use-translation";

/**
 * Content for the "Legal" tab in ProfilePage.
 * Shows two tappable rows — Terms of Use and Privacy Policy — that open
 * the corresponding document in a LegalDocModal bottom-sheet.
 */
export function LegalTab(): React.JSX.Element {
  const t = useTranslation();
  const [openDoc, setOpenDoc] = React.useState<"terms" | "privacy" | null>(
    null,
  );

  const ITEMS = [
    { key: "terms" as const, label: t.legal.termsTitle, icon: FileText },
    { key: "privacy" as const, label: t.legal.privacyTitle, icon: Shield },
  ];

  return (
    <>
      <div className="flex flex-col gap-2">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => {
              setOpenDoc(item.key);
            }}
            className="flex items-center gap-3 rounded-xl border border-surface-border bg-surface-card px-4 py-4 text-left transition-colors hover:bg-surface-elevated"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-elevated">
              <item.icon className="h-4 w-4 text-content-muted" aria-hidden />
            </div>
            <span className="flex-1 text-sm font-medium text-content-primary">
              {item.label}
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-content-subtle"
              aria-hidden
            />
          </button>
        ))}
      </div>

      <LegalDocModal
        open={openDoc === "terms"}
        docType="terms"
        onClose={() => {
          setOpenDoc(null);
        }}
      />
      <LegalDocModal
        open={openDoc === "privacy"}
        docType="privacy"
        onClose={() => {
          setOpenDoc(null);
        }}
      />
    </>
  );
}
