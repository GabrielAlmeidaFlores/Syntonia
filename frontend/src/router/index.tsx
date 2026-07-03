import * as React from 'react';
import {
  createBrowserRouter,
  Navigate,
  RouterProvider,
  useLocation,
} from 'react-router-dom';

import { FeedLayout } from '@/app/layouts';
import { useAuthStore } from '@/stores/auth';
import { useUserStore } from '@/stores/user';

const MockCognitoPage = React.lazy(async () => import('@/features/auth/login/page'));
const OnboardingPage = React.lazy(async () => import('@/features/onboarding/page'));
const FeedPage = React.lazy(async () => import('@/features/feed/page'));
const ProfilePage = React.lazy(async () => import('@/features/profile/page'));
const PostPage = React.lazy(async () => import('@/features/post/page'));
const SavedGridPage = React.lazy(async () => import('@/features/saved/page'));
const SavedFeedPage = React.lazy(async () => import('@/features/saved/feed'));

function SuspenseFallback(): React.JSX.Element {
  return (
    <div className="flex h-dvh items-center justify-center bg-surface">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-surface-elevated border-t-accent" />
    </div>
  );
}

function withSuspense(Component: React.ComponentType): React.JSX.Element {
  return (
    <React.Suspense fallback={<SuspenseFallback />}>
      <Component />
    </React.Suspense>
  );
}

function RequireAuth({
  children,
}: {
  readonly children: React.JSX.Element;
}): React.JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const location = useLocation();

  if (!isAuthenticated) {
    return (
      <Navigate
        to={`/auth/login?returnTo=${encodeURIComponent(location.pathname)}`}
        replace
      />
    );
  }

  return children;
}

function RootRedirect(): React.JSX.Element {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const description = useUserStore((s) => s.description);

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" replace />;
  }

  if (description.trim().length === 0) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Navigate to="/feed" replace />;
}

const router = createBrowserRouter([
  { path: '/', element: <RootRedirect /> },
  { path: '/auth/login', element: withSuspense(MockCognitoPage) },
  {
    path: '/onboarding',
    element: <RequireAuth>{withSuspense(OnboardingPage)}</RequireAuth>,
  },
  {
    element: (
      <RequireAuth>
        <FeedLayout />
      </RequireAuth>
    ),
    children: [
      { path: '/feed', element: withSuspense(FeedPage) },
      { path: '/saved', element: withSuspense(SavedGridPage) },
      { path: '/profile', element: withSuspense(ProfilePage) },
    ],
  },
  {
    path: '/post/:id',
    element: <RequireAuth>{withSuspense(PostPage)}</RequireAuth>,
  },
  {
    path: '/saved/feed',
    element: <RequireAuth>{withSuspense(SavedFeedPage)}</RequireAuth>,
  },
]);

/** Application router. Renders all routes with lazy-loaded pages. */
export function AppRouter(): React.JSX.Element {
  return <RouterProvider router={router} />;
}

