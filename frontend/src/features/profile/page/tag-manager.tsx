import * as React from 'react';

import { TagSelector } from '@/components/shared/tag-selector';
import { Button } from '@/components/ui/button';
import { sleep } from '@/lib/utils';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';
import type { Tag } from '@/types';

/**
 * Tag enable/disable manager on the ProfilePage.
 *
 * Shows the user's AI-extracted tags as toggleable chips and persists
 * the active subset via the user store when saved.
 */
export function TagManager(): React.JSX.Element {
  const { activeTags, setTags } = useUserStore();
  const addToast = useToastStore((s) => s.addToast);

  const [localTags, setLocalTags] = React.useState<Tag[]>(activeTags);
  const [saving, setSaving] = React.useState(false);

  const isDirty =
    JSON.stringify([...localTags].sort()) !== JSON.stringify([...activeTags].sort());

  const handleToggle = (tag: Tag): void => {
    setLocalTags((prev) => {
      const isActive = prev.includes(tag);
      if (isActive && prev.length <= 1) return prev;
      return isActive ? prev.filter((t) => t !== tag) : [...prev, tag];
    });
  };

  const handleSave = async (): Promise<void> => {
    setSaving(true);
    await sleep(400);
    setTags(localTags);
    setSaving(false);
    addToast({ type: 'success', message: 'Active tags saved.' });
  };

  React.useEffect(() => {
    setLocalTags(activeTags);
  }, [activeTags]);

  if (activeTags.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        Save a profile description first to extract your areas of interest.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-gray-400">
        Toggle which extracted areas are active. Only{' '}
        <span className="font-medium text-accent-light">active tags</span> are used to generate
        your feed content.
      </p>

      <TagSelector tags={activeTags} activeTags={localTags} onToggle={handleToggle} />

      <div className="flex items-center justify-between pt-1">
        <p className="text-xs text-gray-600">
          {localTags.length} of {activeTags.length} active
        </p>

        <Button
          variant="primary"
          size="sm"
          disabled={!isDirty || saving}
          onClick={() => {
            void handleSave();
          }}
        >
          {saving ? 'Saving…' : 'Save tags'}
        </Button>
      </div>
    </div>
  );
}
