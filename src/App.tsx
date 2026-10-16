/**
 * App shell placeholder.
 *
 * Replaced in Phase 5 by `AppShell` composed inside `AppProviders`. Kept
 * deliberately thin so the scaffold builds and the Tailwind token pipeline can
 * be verified before any feature work lands.
 */
export function App() {
  return (
    <div className="flex h-dvh items-center justify-center bg-surface-sunken p-4">
      <div className="rounded-lg bg-surface p-6 shadow-card">
        <h1 className="text-lg font-semibold tracking-tight text-ink-900">
          Flowboard
        </h1>
        <p className="mt-1 text-sm text-ink-600">Scaffold ready.</p>
      </div>
    </div>
  );
}
