import * as React from 'react';

import { TagSelector } from '@/components/shared/tag-selector';
import { useTranslation } from '@/hooks/use-translation';
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
  const t = useTranslation();

  const handleToggle = (tag: Tag): void => {
    const isActive = activeTags.includes(tag);
    if (isActive && activeTags.length <= 1) return;

    const previous = activeTags;
    const next = isActive
      ? activeTags.filter((t2) => t2 !== tag)
      : [...activeTags, tag];

    setTags(next);
    addToast({
      type: 'success',
      message: isActive ? t.tagManager.toastDeactivated(tag) : t.tagManager.toastActivated(tag),
    });

    void api
      .put('/user/preferences', { activeTags: next })
      .catch(() => {
        setTags(previous);
        addToast({ type: 'error', message: t.tagManager.toastError });
      });
  };

  if (extractedTags.length === 0) {
    return <p className="text-sm text-content-subtle">{t.tagManager.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-content-muted">
        {t.tagManager.hintBefore}{' '}
        <span className="font-medium text-accent-light">{t.tagManager.hintEmphasis}</span>{' '}
        {t.tagManager.hintAfter}
      </p>

      <TagSelector tags={extractedTags} activeTags={activeTags} onToggle={handleToggle} />

      <p className="text-xs text-content-subtle">
        {t.tagManager.count(activeTags.length, extractedTags.length)}
      </p>
    </div>
  );
}
