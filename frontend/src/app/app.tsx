import * as Toast from '@radix-ui/react-toast';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as React from 'react';

import { ToastContainer, ToastViewport } from '@/components/ui/toast';
import { AppRouter } from '@/router';

/**
 * Root application component.
 *
 * On desktop, centers the app in a max-w-[430px] container so it renders as a
 * phone-sized view rather than stretching to fill the full viewport width.
 * On mobile the container is naturally full-width.
 */
export function App(): React.JSX.Element {
  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
      <Toast.Provider>
        <div className="flex min-h-dvh justify-center bg-gray-950">
          <div className="relative w-full max-w-[430px]">
            <AppRouter />
          </div>
        </div>
        <ToastContainer />
        <ToastViewport />
      </Toast.Provider>
    </Tooltip.Provider>
  );
}
