import { RefreshCw, Sparkles } from 'lucide-react';
import * as React from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';

interface EmptyFeedScreenProps {
  readonly onReload: () => void;
}

/**
 * Displayed when the feed contains no posts.
 * Guides the user to configure their profile and provides a reload action.
 */
export function EmptyFeedScreen({ onReload }: EmptyFeedScreenProps): React.JSX.Element {
  const navigate = useNavigate();
  const t = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-elevated">
        <Sparkles className="h-9 w-9 text-accent-light" aria-hidden />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-content-primary">{t.emptyFeed.heading}</h2>
        <p className="max-w-xs text-sm text-content-muted">{t.emptyFeed.description}</p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button
          variant="primary"
          onClick={() => {
            navigate('/profile');
          }}
        >
          {t.emptyFeed.configureButton}
        </Button>

        <Button variant="ghost" onClick={onReload}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          {t.emptyFeed.reloadButton}
        </Button>
      </div>
    </div>
  );
}
