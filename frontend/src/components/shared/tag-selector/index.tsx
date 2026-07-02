import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Tag } from '@/types';

interface TagSelectorProps {
  readonly tags: Tag[];
  readonly activeTags: Tag[];
  readonly onToggle: (tag: Tag) => void;
  readonly className?: string;
}

/**
 * Renders the user's AI-extracted tags as toggleable chips.
 * Active tags have an accent highlight. Minimum 1 tag must remain active —
 * enforcement is delegated to the parent store.
 */
export function TagSelector({
  tags,
  activeTags,
  onToggle,
  className,
}: TagSelectorProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tags.map((tag) => {
        const isActive = activeTags.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            onClick={() => {
              onToggle(tag);
            }}
            aria-pressed={isActive}
            aria-label={`${isActive ? 'Disable' : 'Enable'} ${tag}`}
          >
            <Badge variant={isActive ? 'tag-active' : 'tag'}>{tag}</Badge>
          </button>
        );
      })}
    </div>
  );
}
