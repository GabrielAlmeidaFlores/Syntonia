import { Sparkles } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { api } from '@/services/api';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';
import type { UpdateProfileResponse } from '@/types';

type ExtractionState = 'idle' | 'extracting';

/**
 * Description editing form on the ProfilePage.
 *
 * Saving a new description calls PUT /user/profile. MSW intercepts the request,
 * runs mockExtractTags() to simulate Gemini AI tag extraction, and returns the
 * new activeTags after a 2s delay that mirrors real API latency.
 * Both the description and extracted tags are then synced to the user store.
 * Result feedback is shown via toast only — no inline label.
 */
export function DescriptionForm(): React.JSX.Element {
  const { description, setProfile } = useUserStore();
  const addToast = useToastStore((s) => s.addToast);

  const [value, setValue] = React.useState(description);
  const [state, setState] = React.useState<ExtractionState>('idle');

  const isDirty = value.trim() !== description.trim();
  const canSave = isDirty && value.trim().length >= 20;

  const handleSave = async (): Promise<void> => {
    setState('extracting');

    try {
      const response = await api.put<UpdateProfileResponse>('/user/profile', {
        description: value.trim(),
      });

      setProfile(response.description, response.activeTags);
      addToast({
        type: 'success',
        message: `Profile updated — ${String(response.activeTags.length)} tags extracted.`,
      });
    } catch {
      addToast({ type: 'error', message: 'Failed to save profile. Please try again.' });
    } finally {
      setState('idle');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="profile-description" className="text-sm font-medium text-gray-300">
          Profile description
        </label>
        <p className="text-xs text-gray-500">
          Describe your background and interests. Syntonia uses this to extract your areas of
          interest and generate relevant content.
        </p>
      </div>

      <Textarea
        id="profile-description"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
        }}
        disabled={state === 'extracting'}
        rows={5}
        placeholder="e.g. Backend developer working with AWS Lambda and TypeScript…"
      />

      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-600">{value.length} / 500 characters</p>

        <Button
          variant="primary"
          size="sm"
          disabled={!canSave || state === 'extracting'}
          onClick={() => {
            void handleSave();
          }}
        >
          {state === 'extracting' ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
              Extracting…
            </span>
          ) : (
            <>
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Save & extract tags
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
