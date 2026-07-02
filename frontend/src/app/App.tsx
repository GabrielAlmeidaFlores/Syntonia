import * as Toast from '@radix-ui/react-toast';
import * as Tooltip from '@radix-ui/react-tooltip';
import * as React from 'react';

import { ToastContainer, ToastViewport } from '@/components/ui/toast';
import { AppRouter } from '@/router';

/** Root application component. Wraps the router with Toast and Tooltip providers. */
export function App(): React.JSX.Element {
  return (
    <Tooltip.Provider delayDuration={300} skipDelayDuration={150}>
      <Toast.Provider>
        <AppRouter />
        <ToastContainer />
        <ToastViewport />
      </Toast.Provider>
    </Tooltip.Provider>
  );
}
