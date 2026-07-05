import { Sparkles } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { api, getApiErrorMessage } from "@/services/api";
import { useToastStore } from "@/stores/toast";
import { useUserStore } from "@/stores/user";
import type { UpdateProfileResponse } from "@/types";

type ExtractionState = "idle" | "extracting";

interface DescriptionFormProps {
  /** Called with `true` when extraction starts and `false` when it ends (success or error). */
  readonly onExtractionStateChange: (isExtracting: boolean) => void;
}

/**
 * Description editing form on the ProfilePage.
 *
 * Saving a new description calls PUT /user/profile. MSW intercepts the request,
 * runs mockExtractTags() to simulate Gemini AI tag extraction, and returns the
 * new activeTags after a 2s delay that mirrors real API latency.
 * Both the description and extracted tags are then synced to the user store.
 *
 * Signals extraction state changes to the parent via `onExtractionStateChange`
 * so the TagManager can show a loading skeleton while the API is in flight.
 */
export function DescriptionForm({
  onExtractionStateChange,
}: DescriptionFormProps): React.JSX.Element {
  const description = useUserStore((s) => s.description);
  const setProfile = useUserStore((s) => s.setProfile);
  const addToast = useToastStore((s) => s.addToast);
  const t = useTranslation();

  const [value, setValue] = React.useState(description);
  const [state, setState] = React.useState<ExtractionState>("idle");

  const isDirty = value.trim() !== description.trim();
  const canSave = isDirty && value.trim().length >= 20;

  const handleSave = async (): Promise<void> => {
    setState("extracting");
    onExtractionStateChange(true);

    try {
      const response = await api.put<UpdateProfileResponse>("/user/profile", {
        description: value.trim(),
      });

      setProfile(response.description, response.activeTags);
      addToast({
        type: "success",
        message: t.descriptionForm.toastSuccess(response.activeTags.length),
      });
    } catch (err) {
      addToast({ type: "error", message: getApiErrorMessage(err, t.errors) });
    } finally {
      setState("idle");
      onExtractionStateChange(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="profile-description"
          className="text-sm font-medium text-content-secondary"
        >
          {t.descriptionForm.label}
        </label>
        <p className="text-xs text-content-subtle">{t.descriptionForm.hint}</p>
      </div>

      <Textarea
        id="profile-description"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        disabled={state === "extracting"}
        rows={5}
        placeholder={t.descriptionForm.placeholder}
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-content-subtle">
          {t.descriptionForm.charCount(value.length)}
        </p>

        <Button
          variant="primary"
          size="sm"
          disabled={!canSave || state === "extracting"}
          onClick={() => {
            void handleSave();
          }}
        >
          {state === "extracting" ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
              {t.descriptionForm.savingButton}
            </span>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              {t.descriptionForm.saveButton}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
