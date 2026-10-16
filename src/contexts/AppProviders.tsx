import type { ReactNode } from "react";

import { ConfirmProvider } from "./ConfirmContext";
import { DensityProvider } from "./DensityContext";
import { NavigationProvider } from "./NavigationContext";
import { SidebarProvider } from "./SidebarContext";
import { SimulationProvider } from "./SimulationContext";
import { ToastProvider } from "./ToastContext";

/**
 * One place where provider order is explicit.
 *
 * Composing them here rather than nesting ad hoc in `main.tsx` means a test or
 * a Storybook story wraps a component in exactly the same environment the app
 * uses (Requirement 12.5).
 *
 * Order matters in one direction only: `ToastProvider` is outermost because the
 * view-model hooks surface every failed mutation through it, so anything that
 * can fail must be inside it. The rest are independent.
 */
export function AppProviders({
  children,
  initialListId = null,
  initialExpandedIds = [],
  initialOpenTaskId = null,
}: {
  children: ReactNode;
  initialListId?: string | null;
  initialExpandedIds?: readonly string[];
  initialOpenTaskId?: string | null;
}) {
  return (
    <ToastProvider>
      <SimulationProvider>
        <DensityProvider>
          <SidebarProvider initialExpandedIds={initialExpandedIds}>
            <NavigationProvider
              initialListId={initialListId}
              initialOpenTaskId={initialOpenTaskId}
            >
              <ConfirmProvider>{children}</ConfirmProvider>
            </NavigationProvider>
          </SidebarProvider>
        </DensityProvider>
      </SimulationProvider>
    </ToastProvider>
  );
}
