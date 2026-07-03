import * as Toast from '@radix-ui/react-toast';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as React from 'react';

import { ToastContainer, ToastViewport } from '@/components/ui/toast';
import { AppRouter } from '@/router';

/**
 * Root application component.
 *
 * On desktop, centers the app in a max-w-[560px] phone-style container.
 * The outer background uses a mesh-gradient effect — two soft color orbs
 * (indigo + violet) on a deep slate base — so the app frame is visually
 * distinct from the page without being harsh.
 * On mobile the container is naturally full-width with no outer background visible.
 */
export function App(): React.JSX.Element {
  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
      <Toast.Provider>
        <div className="relative flex min-h-dvh justify-center overflow-hidden bg-[#060714]">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: [
                'radial-gradient(ellipse 70% 60% at 20% 10%, rgba(79,70,229,0.28) 0%, transparent 70%)',
                'radial-gradient(ellipse 60% 55% at 80% 85%, rgba(124,58,237,0.22) 0%, transparent 65%)',
                'radial-gradient(ellipse 50% 40% at 55% 45%, rgba(99,102,241,0.10) 0%, transparent 60%)',
              ].join(', '),
            }}
          />
          <div className="relative w-full max-w-[560px]">
            <AppRouter />
          </div>
        </div>
        <ToastContainer />
        <ToastViewport />
      </Toast.Provider>
    </Tooltip.Provider>
  );
}
