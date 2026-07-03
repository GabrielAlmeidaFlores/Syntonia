import * as React from 'react';

import { TagSelector } from '@/components/shared/tag-selector';
import { api } from '@/services/api';
import { useToastStore } from '@/stores/toast';
import { useUserStore } from '@/stores/user';
import type { Tag } from '@/types';

/**
 * Tag enable/disable manager on the ProfilePage.
 *
 * Shows ALL AI-extracted tags (`extractedTags`) as toggleable chips.
 * Deactivated tags stay visible with a muted style so they can be re-enabled.
 * Each toggle immediately calls PUT /user/preferences — no save button.
 * On error the previous state is restored and a toast is shown.
 */
export function TagManager(): React.JSX.Element {
  const extractedTags = useUserStore((s) => s.extractedTags);
  const activeTags = useUserStore((s) => s.activeTags);
  const setTags = useUserStore((s) => s.setTags);
  const addToast = useToastStore((s) => s.addToast);

  const handleToggle = (tag: Tag): void => {
    const isActive = activeTags.includes(tag);
    if (isActive && activeTags.length <= 1) return;

    const previous = activeTags;
    const next = isActive
      ? activeTags.filter((t) => t !== tag)
      : [...activeTags, tag];

    setTags(next);
    addToast({
      type: 'success',
      message: isActive ? `"${tag}" deactivated.` : `"${tag}" activated.`,
    });

    void api
      .put('/user/preferences', { activeTags: next })
      .catch(() => {
        setTags(previous);
        addToast({ type: 'error', message: 'Failed to update tags. Please try again.' });
      });
  };

  if (extractedTags.length === 0) {
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

      <TagSelector tags={extractedTags} activeTags={activeTags} onToggle={handleToggle} />

      <p className="text-xs text-gray-600">
        {activeTags.length} of {extractedTags.length} active
      </p>
    </div>
  );
}
