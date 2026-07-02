import * as TabsPrimitive from '@radix-ui/react-tabs';
import { User } from 'lucide-react';
import * as React from 'react';

import { DescriptionForm } from './description-form';
import { TagManager } from './tag-manager';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';

/**
 * Profile page at /profile.
 *
 * Two-tab layout: Description (edit free-text + trigger AI extraction)
 * and Tags (enable/disable individual AI-extracted tags).
 */
export default function ProfilePage(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-surface scrollbar-thin">
      <div className="flex flex-col gap-4 border-b border-surface-border px-5 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted">
            <User className="h-6 w-6 text-accent-light" aria-hidden />
          </div>
          <div>
            <p className="font-semibold text-white">{user?.email ?? 'User'}</p>
            <p className="text-xs text-gray-500">Syntonia profile</p>
          </div>
        </div>
      </div>

      <TabsPrimitive.Root defaultValue="description" className="flex flex-1 flex-col">
        <TabsPrimitive.List className="flex border-b border-surface-border px-5">
          {(['description', 'tags'] as const).map((tab) => (
            <TabsPrimitive.Trigger
              key={tab}
              value={tab}
              className={cn(
                'px-4 py-3 text-sm font-medium capitalize transition-colors',
                'text-gray-500 hover:text-gray-300',
                'data-[state=active]:border-b-2 data-[state=active]:border-accent data-[state=active]:text-white',
              )}
            >
              {tab}
            </TabsPrimitive.Trigger>
          ))}
        </TabsPrimitive.List>

        <TabsPrimitive.Content value="description" className="flex-1 px-5 py-6">
          <DescriptionForm />
        </TabsPrimitive.Content>

        <TabsPrimitive.Content value="tags" className="flex-1 px-5 py-6">
          <TagManager />
        </TabsPrimitive.Content>
      </TabsPrimitive.Root>
    </div>
  );
}
