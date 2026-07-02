import { Sparkles } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';

import { ExtractedTags } from './extracted-tags';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TAG_EXTRACTION_DELAY_MS } from '@/lib/constants';
import { sleep } from '@/lib/utils';
import { mockExtractTags } from '@/mocks/data';
import { useUserStore } from '@/stores/user';
import type { Tag } from '@/types';

type Step = 'input' | 'extracting' | 'review';

/**
 * Post-signup onboarding page at /onboarding.
 *
 * Guides the user through writing a profile description, simulating AI tag
 * extraction, and confirming their areas of interest before redirecting to /feed.
 */
export default function OnboardingPage(): React.JSX.Element {
  const navigate = useNavigate();
  const { setProfile } = useUserStore();

  const [step, setStep] = React.useState<Step>('input');
  const [description, setDescription] = React.useState('');
  const [extractedTags, setExtractedTags] = React.useState<Tag[]>([]);
  const [localActiveTags, setLocalActiveTags] = React.useState<Tag[]>([]);
  const [isConfirming, setIsConfirming] = React.useState(false);

  const canExtract = description.trim().length >= 20;

  const handleExtract = async (): Promise<void> => {
    setStep('extracting');
    await sleep(TAG_EXTRACTION_DELAY_MS);

    const tags = mockExtractTags(description);
    setExtractedTags(tags);
    setLocalActiveTags(tags);
    setStep('review');
  };

  const handleToggle = (tag: Tag): void => {
    setLocalActiveTags((prev) => {
      const isActive = prev.includes(tag);
      if (isActive && prev.length <= 1) return prev;
      return isActive ? prev.filter((t) => t !== tag) : [...prev, tag];
    });
  };

  const handleConfirm = async (): Promise<void> => {
    setIsConfirming(true);
    await sleep(600);
    setProfile(description, localActiveTags);
    navigate('/feed', { replace: true });
  };

  return (
    <div className="flex min-h-dvh flex-col bg-surface px-6 py-10">
      <div className="mx-auto flex w-full max-w-md flex-col gap-8">
        <div className="flex flex-col gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent-muted">
            <Sparkles className="h-6 w-6 text-accent-light" aria-hidden />
          </div>
          <h1 className="text-2xl font-bold text-white">Set up your profile</h1>
          <p className="text-sm text-gray-400">
            Describe your background and what you want to learn. Syntonia's AI will extract your
            areas of interest and personalise your feed.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <label htmlFor="description" className="text-sm font-medium text-gray-300">
            Your profile description
          </label>
          <Textarea
            id="description"
            placeholder="e.g. Senior backend developer working with AWS Lambda and TypeScript. Building serverless APIs and learning Kubernetes."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
            }}
            disabled={step !== 'input'}
            rows={5}
          />
          <p className="text-xs text-gray-500">
            Minimum 20 characters · {description.length} / 500
          </p>
        </div>

        {step === 'input' && (
          <Button
            variant="primary"
            disabled={!canExtract}
            onClick={() => {
              void handleExtract();
            }}
            className="w-full"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Extract my interests
          </Button>
        )}

        {step === 'extracting' && (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-elevated border-t-accent" />
            <p className="animate-pulse text-sm text-gray-400">
              Analysing your profile with AI…
            </p>
          </div>
        )}

        {step === 'review' && (
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
    </div>
  );
}
