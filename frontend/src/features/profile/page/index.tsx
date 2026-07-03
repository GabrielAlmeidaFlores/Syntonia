import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Settings, User } from 'lucide-react';
import * as React from 'react';

import { DescriptionForm } from './description-form';
import { SettingsPanel } from './settings-panel';
import { TagManager } from './tag-manager';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';
import type { UserPreferences } from '@/types';

type Tab = 'profile' | 'settings';

const TAB_ORDER: Record<Tab, number> = { profile: 0, settings: 1 };

/**
 * Profile page at /profile.
 *
 * Renders two tabs at the top:
 *   - Profile: description form + tag manager (existing content).
 *   - Settings: theme and language selectors.
 *
 * Tab content uses a direction-aware slide animation: switching to Settings
 * slides from the right; switching back to Profile slides from the left.
 * On mount, calls GET /user/preferences to hydrate the Zustand userStore.
 */
export default function ProfilePage(): React.JSX.Element {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const setProfile = useUserStore((s) => s.setProfile);
  const [activeTab, setActiveTab] = React.useState<Tab>('profile');
  const [slideDirection, setSlideDirection] = React.useState<1 | -1>(1);
  const t = useTranslation();

  const TABS: Array<{ value: Tab; label: string; icon: typeof User }> = [
    { value: 'profile', label: t.profile.tabProfile, icon: User },
    { value: 'settings', label: t.profile.tabSettings, icon: Settings },
  ];

  const handleTabChange = React.useCallback((tab: Tab): void => {
    setSlideDirection(TAB_ORDER[tab] > TAB_ORDER[activeTab] ? 1 : -1);
    setActiveTab(tab);
  }, [activeTab]);

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
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted">
            <User className="h-6 w-6 text-accent-light" aria-hidden />
          </div>
          <div>
            <p className="font-semibold text-content-primary">{user?.email ?? 'User'}</p>
            <p className="text-xs text-content-subtle">{t.profile.subtitle}</p>
          </div>
        </motion.div>

        <div className="flex gap-1 rounded-xl bg-surface-elevated p-1" role="tablist">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => {
                  handleTabChange(tab.value);
                }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-accent text-white shadow-sm'
                    : 'text-content-muted hover:text-content-primary',
                )}
              >
                <tab.icon className="h-4 w-4" aria-hidden />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-8 px-5 py-6">
        <div className="overflow-x-hidden">
          <AnimatePresence mode="wait" initial={false} custom={slideDirection}>
            <motion.div
              key={activeTab}
              custom={slideDirection}
              variants={{
                initial: (dir: number) => ({ opacity: 0, x: dir * 20 }),
                animate: { opacity: 1, x: 0 },
                exit: (dir: number) => ({ opacity: 0, x: dir * -20 }),
              }}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="flex flex-col gap-8"
            >
            {activeTab === 'profile' && (
              <>
                <DescriptionForm />
                <div className="border-t border-surface-border pt-6">
                  <TagManager />
                </div>
              </>
            )}

            {activeTab === 'settings' && <SettingsPanel />}
          </motion.div>
        </AnimatePresence>
        </div>

        <div className="border-t border-surface-border pb-2 pt-6">
          <Button
            variant="ghost"
            onClick={logout}
            className="flex w-full items-center justify-center gap-2 text-content-muted hover:text-content-primary"
            aria-label={t.profile.ariaLogout}
          >
            <LogOut className="h-4 w-4" aria-hidden />
            {t.profile.logout}
          </Button>
        </div>
      </div>
    </div>
  );
}
