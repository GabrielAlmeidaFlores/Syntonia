import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import * as React from "react";
import { useNavigate } from "react-router-dom";

import { ExtractedTags } from "./extracted-tags";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { api, getApiErrorMessage } from "@/services/api";
import { useUserStore } from "@/stores/user";
import type { Tag, UpdateProfileResponse } from "@/types";

type Step = "input" | "extracting" | "review";

/**
 * Post-signup onboarding page at /onboarding.
 *
 * Guides the user through writing a profile description and confirming their
 * AI-extracted areas of interest before redirecting to /feed.
 *
 * Calls PUT /user/profile with the description. The backend runs Gemini
 * to extract tags and returns { description, activeTags } after processing.
 */
export default function OnboardingPage(): React.JSX.Element {
  const navigate = useNavigate();
  const setProfile = useUserStore((s) => s.setProfile);
  const t = useTranslation();

  const [step, setStep] = React.useState<Step>("input");
  const [description, setDescription] = React.useState("");
  const [extractedTags, setExtractedTags] = React.useState<Tag[]>([]);
  const [localActiveTags, setLocalActiveTags] = React.useState<Tag[]>([]);
  const [isConfirming, setIsConfirming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const canExtract = description.trim().length >= 20 && description.length <= 10000;

  const handleExtract = async (): Promise<void> => {
    setStep("extracting");
    setError(null);

    try {
      const response = await api.put<UpdateProfileResponse>("/user/profile", {
        description: description.trim(),
      });

      setExtractedTags(response.activeTags);
      setLocalActiveTags(response.activeTags);
      setStep("review");
    } catch (err) {
      setError(getApiErrorMessage(err, t.errors));
      setStep("input");
    }
  };

  const handleToggle = (tag: Tag): void => {
    setLocalActiveTags((prev) => {
      const isActive = prev.includes(tag);
      if (isActive && prev.length <= 1) return prev;
      return isActive ? prev.filter((t2) => t2 !== tag) : [...prev, tag];
    });
  };

  const handleConfirm = async (): Promise<void> => {
    setIsConfirming(true);

    try {
      await api.put("/user/preferences", { activeTags: localActiveTags });
      setProfile(description.trim(), localActiveTags);
      navigate("/feed", { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, t.errors));
      setIsConfirming(false);
    }
  };

  return (
    <motion.div
      className="flex min-h-dvh flex-col bg-surface px-6 py-10"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-muted">
            <Sparkles className="h-6 w-6 text-accent-light" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-content-primary">
            {t.onboarding.heading}
          </h1>
          <p className="text-sm text-content-muted">
            {t.onboarding.description}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <label
            htmlFor="description"
            className="text-sm font-medium text-content-secondary"
          >
            {t.onboarding.descriptionLabel}
          </label>
          <Textarea
            id="description"
            placeholder={t.onboarding.placeholder}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            disabled={step !== "input"}
            rows={5}
            maxLength={10000}
          />
          <p className="text-xs text-content-subtle">
            {t.onboarding.charHint(description.length)}
          </p>
        </div>

        {error !== null && (
          <p className="rounded-lg bg-feedback-error px-3 py-2 text-sm text-feedback-error">
            {error}
          </p>
        )}

        {step === "input" && (
          <Button
            variant="primary"
            disabled={!canExtract}
            onClick={() => {
              void handleExtract();
            }}
            className="w-full"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            {t.onboarding.extractButton}
          </Button>
        )}

        {step === "extracting" && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-elevated border-t-accent" />
            <p className="animate-pulse text-sm text-content-muted">
              {t.onboarding.analysing}
            </p>
          </div>
        )}

        {step === "review" && (
          <ExtractedTags
            tags={extractedTags}
            activeTags={localActiveTags}
            onToggle={handleToggle}
            onConfirm={() => {
              void handleConfirm();
            }}
            isConfirming={isConfirming}
          />
        )}
      </div>
    </motion.div>
  );
}
