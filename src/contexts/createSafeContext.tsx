import { createContext, useContext } from "react";

/**
 * Builds a Context whose consumer hook throws a useful error outside its
 * provider, rather than silently handing back `undefined` and failing three
 * frames later with "cannot read property of undefined" (Requirement 12.3).
 */
export function createSafeContext<T>(name: string): {
  readonly Provider: React.Provider<T | undefined>;
  readonly useValue: () => T;
} {
  const Context = createContext<T | undefined>(undefined);
  Context.displayName = name;

  function useValue(): T {
    const value = useContext(Context);

    if (value === undefined) {
      throw new Error(
        `use${name} must be used inside <${name}Provider>. ` +
          `Wrap the tree in <AppProviders> or add the provider directly.`,
      );
    }

    return value;
  }

  return { Provider: Context.Provider, useValue };
}
