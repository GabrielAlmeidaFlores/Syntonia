import { BookOpen, LogOut, User } from 'lucide-react';
import * as React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth';

const BOTTOM_NAV = [
  { label: 'Feed', href: '/feed', icon: BookOpen, exact: true },
  { label: 'Profile', href: '/profile', icon: User, exact: false },
] as const;

/**
 * Authenticated layout for the main app.
 * Renders the page outlet above a fixed bottom navigation bar.
 */
export function FeedLayout(): React.JSX.Element {
  const logout = useAuthStore((s) => s.logout);

  return (
    <div className="relative flex h-dvh flex-col overflow-hidden bg-surface">
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

      <nav
        className="flex h-16 shrink-0 items-center justify-around border-t border-surface-border bg-surface-card px-4"
        aria-label="Main navigation"
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
                      isActive ? 'text-accent-light' : 'text-gray-500',
                    )}
                    aria-hidden
                  />
                </div>
                <span
                  className={cn(
                    'text-xs transition-colors duration-200',
                    isActive ? 'font-semibold text-accent-light' : 'font-medium text-gray-500',
                  )}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        ))}

        <button
          type="button"
          onClick={logout}
          className="flex flex-col items-center gap-0.5"
          aria-label="Log out"
        >
          <div className="rounded-xl px-4 py-1.5">
            <LogOut className="h-5 w-5 text-gray-500" aria-hidden />
          </div>
          <span className="text-xs font-medium text-gray-500">Logout</span>
        </button>
      </nav>
    </div>
  );
}
