import { useEffect } from "react";

import { useSession } from "@/controllers/hooks/useSession";

import { AppShell } from "./views/AppShell";

/**
 * The app root.
 *
 * Hydration is kicked off here rather than at module load, so the store is
 * never mutated as a side effect of an import — which would make it impossible
 * to build a clean store for a test or a story.
 */
export function App() {
  const { hydrate } = useSession();

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  return <AppShell />;
}
