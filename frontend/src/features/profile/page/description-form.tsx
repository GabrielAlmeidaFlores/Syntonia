import { Sparkles } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { TAG_EXTRACTION_DELAY_MS } from '@/lib/constants';
import { sleep } from '@/lib/utils';
import { mockExtractTags } from '@/mocks/data';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';
import type { Tag } from '@/types';

type ExtractionState = 'idle' | 'extracting' | 'done';

/**
 * Description editing form on the ProfilePage.
 *
 * Saving a new description triggers simulated AI tag re-extraction,
 * updating both the description and activeTags in the user store.
 */
export function DescriptionForm(): React.JSX.Element {
  const { description, setProfile } = useUserStore();
  const addToast = useToastStore((s) => s.addToast);

  const [value, setValue] = React.useState(description);
  const [state, setState] = React.useState<ExtractionState>('idle');
  const [extractedTags, setExtractedTags] = React.useState<Tag[]>([]);

  const isDirty = value.trim() !== description.trim();
  const canSave = isDirty && value.trim().length >= 20;

  const handleSave = async (): Promise<void> => {
    setState('extracting');
    await sleep(TAG_EXTRACTION_DELAY_MS);

    const tags = mockExtractTags(value.trim());
    setExtractedTags(tags);
    setProfile(value.trim(), tags);
    setState('done');

    addToast({
      type: 'success',
      message: `Profile updated — ${tags.length.toString()} tags extracted.`,
    });
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
          if (state === 'done') setState('idle');
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

      {state === 'done' && extractedTags.length > 0 && (
        <p className="animate-fade-in text-xs text-green-400">
          ✓ {extractedTags.length} tags extracted and saved to your profile.
        </p>
      )}
    </div>
  );
}
