import { LogOut, User } from 'lucide-react';
import * as React from 'react';

import { DescriptionForm } from './description-form';
import { TagManager } from './tag-manager';

import { Button } from '@/components/ui/button';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';
import type { UserPreferences } from '@/types';

/**
 * Profile page at /profile.
 *
 * On mount, calls GET /user/preferences to hydrate the Zustand userStore with
 * the server-side description and activeTags. This ensures the profile is always
 * in sync with the "backend" even after a page refresh.
 *
 * Single scrollable layout: DescriptionForm followed by TagManager stacked
 * vertically, with a Logout button at the bottom.
 */
export default function ProfilePage(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setProfile = useUserStore((s) => s.setProfile);

  React.useEffect(() => {
    void api.get<UserPreferences>('/user/preferences').then((prefs) => {
      if (prefs.description !== null) {
        setProfile(prefs.description, prefs.activeTags);
      }
    });
  }, [setProfile]);

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

      <div className="flex flex-col gap-8 px-5 py-6">
        <DescriptionForm />

        <div className="border-t border-surface-border pt-6">
          <TagManager />
        </div>

        <div className="border-t border-surface-border pt-6 pb-2">
          <Button
            variant="ghost"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 text-gray-400 hover:text-white"
            aria-label="Log out"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}

