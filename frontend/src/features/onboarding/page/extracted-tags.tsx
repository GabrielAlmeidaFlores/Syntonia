import { Check, Sparkles } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Tag } from '@/types';

interface ExtractedTagsProps {
  readonly tags: Tag[];
  readonly activeTags: Tag[];
  readonly onToggle: (tag: Tag) => void;
  readonly onConfirm: () => void;
  readonly isConfirming: boolean;
}

/**
 * Displays AI-extracted tags after the user submits their description.
 * All extracted tags start as active. The user can toggle individual tags before confirming.
 */
export function ExtractedTags({
  tags,
  activeTags,
  onToggle,
  onConfirm,
  isConfirming,
}: ExtractedTagsProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-5 animate-slide-up">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Check className="h-4 w-4 text-green-400" aria-hidden />
          <p className="text-sm font-medium text-green-400">Tags extracted successfully</p>
        </div>
        <p className="text-sm text-gray-400">
          Review your areas of interest. Only active tags (highlighted) will be used to generate
          your feed.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
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
              <Badge
                className={cn(
                  'cursor-pointer transition-all',
                  isActive
                    ? 'border-accent bg-accent-muted text-accent-light'
                    : 'border-surface-border bg-transparent text-gray-500',
                )}
              >
                {tag}
              </Badge>
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        {activeTags.length} of {tags.length} tags active
      </p>

      <Button
        variant="primary"
        className="w-full"
        disabled={isConfirming || activeTags.length === 0}
        onClick={onConfirm}
      >
        {isConfirming ? (
          <span className="flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Saving…
          </span>
        ) : (
          <>
            <Sparkles className="h-4 w-4" aria-hidden />
            Start my feed
          </>
        )}
      </Button>
    </div>
  );
}
