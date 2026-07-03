import { BookOpen, Bookmark, User } from 'lucide-react';
import * as React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useTranslation } from '@/hooks/use-translation';
import { cn } from '@/lib/utils';

/**
 * Authenticated layout for the main app.
 * Renders the page outlet above a fixed bottom navigation bar
 * with three tabs: Feed, Saved, and Profile.
 * Logout is handled inside ProfilePage.
 */
export function FeedLayout(): React.JSX.Element {
  const t = useTranslation();

  const BOTTOM_NAV = [
    { label: t.nav.feed, href: '/feed', icon: BookOpen, exact: true },
    { label: t.nav.saved, href: '/saved', icon: Bookmark, exact: true },
    { label: t.nav.profile, href: '/profile', icon: User, exact: false },
  ] as const;

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-surface">
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      <nav
        className="flex h-16 shrink-0 items-center justify-around border-t border-surface-border bg-surface-card px-4"
        aria-label={t.nav.ariaMain}
      >
        {BOTTOM_NAV.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end={item.exact}
            className="flex flex-col items-center gap-0.5"
          >
            {({ isActive }) => (
              <>
                <div
                  className={cn(
                    'rounded-xl px-4 py-1.5 transition-all duration-200',
                    isActive ? 'bg-accent-muted' : '',
                  )}
                >
                  <item.icon
                    className={cn(
                      'h-5 w-5 transition-colors duration-200',
                      isActive ? 'text-accent-light' : 'text-content-subtle',
                    )}
                    aria-hidden
                  />
                </div>
                <span
                  className={cn(
                    'text-xs transition-colors duration-200',
                    isActive ? 'font-semibold text-accent-light' : 'font-medium text-content-subtle',
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

