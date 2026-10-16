import {
  Building2,
  Folder,
  LayoutGrid,
  List,
  type LucideIcon,
} from "lucide-react";

/**
 * The hierarchy's node types.
 *
 * This union is deliberately the ONLY place the set is enumerated. Nothing
 * downstream may restate it — validation, the sidebar, drag-and-drop and the
 * create menus all read CONTAINER_REGISTRY instead (Requirement 21.4).
 */
export type ContainerType = "workspace" | "space" | "folder" | "list";

/** Whether a container is visible by default or requires an explicit grant. */
export type Visibility = "public" | "private";

/**
 * Configuration for one node type.
 *
 * Generic over the type name so the production registry stays pinned to
 * `ContainerType` while `registry.test.ts` can inject a synthetic level and
 * prove the consuming logic is genuinely registry-driven rather than
 * hard-coded (Requirement 18.9).
 */
export interface ContainerTypeConfig<T extends string = ContainerType> {
  readonly type: T;
  readonly label: string;
  readonly labelPlural: string;
  readonly icon: LucideIcon;
  /** Types that may be created directly inside this one. Empty means leaf. */
  readonly childTypes: readonly T[];
  /** True when this type holds tasks rather than containers. */
  readonly holdsTasks: boolean;
  /** True when a permission grant may be attached to this type. */
  readonly grantable: boolean;
  /** True when a user may create, rename or archive nodes of this type. */
  readonly mutable: boolean;
}

/** A registry keyed by type name. Widened so tests can extend it. */
export type ContainerRegistry<T extends string = ContainerType> = Record<
  T,
  ContainerTypeConfig<T>
>;

/**
 * The hierarchy, as data.
 *
 * Adding a level — say a `subfolder` between folder and list — is one entry
 * here plus one `childTypes` edit. No validation, reorder, move or tree-render
 * code changes, and `config.test.ts` proves that by driving the same logic
 * through a synthetic type.
 */
export const CONTAINER_REGISTRY: ContainerRegistry = {
  workspace: {
    type: "workspace",
    label: "Workspace",
    labelPlural: "Workspaces",
    icon: Building2,
    childTypes: ["space"],
    holdsTasks: false,
    grantable: false,
    mutable: false,
  },
  space: {
    type: "space",
    label: "Space",
    labelPlural: "Spaces",
    icon: LayoutGrid,
    childTypes: ["folder"],
    holdsTasks: false,
    grantable: true,
    mutable: true,
  },
  folder: {
    type: "folder",
    label: "Folder",
    labelPlural: "Folders",
    icon: Folder,
    childTypes: ["list"],
    holdsTasks: false,
    grantable: true,
    mutable: true,
  },
  list: {
    type: "list",
    label: "List",
    labelPlural: "Lists",
    icon: List,
    childTypes: [],
    holdsTasks: true,
    grantable: true,
    mutable: true,
  },
};

/** Every container type, in hierarchy order. */
export const CONTAINER_TYPES = Object.keys(
  CONTAINER_REGISTRY,
) as ContainerType[];

/**
 * The registry lookup used wherever a type's configuration is needed. Takes a
 * registry argument so tests can inject a synthetic hierarchy.
 */
export function containerConfig<T extends string>(
  type: T,
  registry: Partial<Record<T, ContainerTypeConfig<T>>>,
): ContainerTypeConfig<T>;
export function containerConfig(
  type: ContainerType,
): ContainerTypeConfig<ContainerType>;
export function containerConfig(
  type: string,
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): ContainerTypeConfig<string> {
  const config = registry[type];

  if (!config) {
    throw new Error(`Unknown container type: ${type}`);
  }

  return config;
}

/**
 * The single parent/child rule in the app. Validation, the create menus and the
 * drag-and-drop drop-target check all call this rather than comparing literals.
 */
export function canContain(
  parent: string,
  child: string,
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): boolean {
  return containerConfig(parent, registry).childTypes.includes(child);
}

/** True when this type holds tasks — i.e. it is a list in the default config. */
export function holdsTasks(
  type: string,
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): boolean {
  return containerConfig(type, registry).holdsTasks;
}

/** True when nodes of this type may be created, renamed or archived. */
export function isMutableType(
  type: string,
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): boolean {
  return containerConfig(type, registry).mutable;
}

/** True when a permission grant may attach to this type. */
export function isGrantableType(
  type: string,
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): boolean {
  return containerConfig(type, registry).grantable;
}

/**
 * The root type — the one no other type may contain.
 *
 * Derived rather than declared, so a registry with a new top level does not
 * need a second place updated.
 */
export function rootContainerType(
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): string {
  const configs = Object.values(registry).filter(
    (config): config is ContainerTypeConfig<string> => config !== undefined,
  );

  const childTypes = new Set(configs.flatMap((config) => config.childTypes));
  const roots = configs.filter((config) => !childTypes.has(config.type));
  const [root] = roots;

  if (roots.length !== 1 || !root) {
    throw new Error(
      `Container registry must have exactly one root type, found ${String(roots.length)}`,
    );
  }

  return root.type;
}

/**
 * The type that holds tasks. Derived from the registry so that moving tasks to
 * a different level later is a configuration change.
 */
export function taskHoldingType(
  registry: Partial<
    Record<string, ContainerTypeConfig<string>>
  > = CONTAINER_REGISTRY,
): string {
  const holders = Object.values(registry).filter(
    (config) => config?.holdsTasks === true,
  );
  const [holder] = holders;

  if (holders.length !== 1 || !holder) {
    throw new Error(
      `Exactly one container type must hold tasks, found ${String(holders.length)}`,
    );
  }

  return holder.type;
}
