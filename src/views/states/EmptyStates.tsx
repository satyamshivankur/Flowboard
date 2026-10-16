import { FolderOpen, Lock } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";

export interface PermissionDeniedStateProps {
  readonly resourceName?: string | undefined;
  readonly suggestions: readonly { id: string; name: string }[];
  readonly onNavigate: (listId: string) => void;
}

/**
 * Shown when the selected list is no longer visible to the current user.
 *
 * This is the state a user switch lands in: Bob cannot see Infra, so if Alice
 * had it open, switching to Bob must say so and offer a way out rather than
 * rendering an empty board that looks broken (Requirement 8.13).
 */
export function PermissionDeniedState({
  resourceName,
  suggestions,
  onNavigate,
}: PermissionDeniedStateProps) {
  const first = suggestions[0];

  return (
    <EmptyState
      icon={Lock}
      title={
        resourceName === undefined
          ? "You don't have access to this list"
          : `You don't have access to "${resourceName}"`
      }
      description={
        suggestions.length === 0
          ? "No lists are available to you in this workspace."
          : "Pick a list you can see from the sidebar, or jump to the first one."
      }
      action={
        first && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onNavigate(first.id);
            }}
          >
            Open &ldquo;{first.name}&rdquo;
          </Button>
        )
      }
    />
  );
}

export interface NoListSelectedStateProps {
  readonly suggestions: readonly { id: string; name: string }[];
  readonly onNavigate: (listId: string) => void;
}

export function NoListSelectedState({
  suggestions,
  onNavigate,
}: NoListSelectedStateProps) {
  const first = suggestions[0];

  return (
    <EmptyState
      icon={FolderOpen}
      title="Select a list"
      description={
        suggestions.length === 0
          ? "No lists are available to you in this workspace."
          : "Choose a list from the sidebar to see its board."
      }
      action={
        first && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onNavigate(first.id);
            }}
          >
            Open &ldquo;{first.name}&rdquo;
          </Button>
        )
      }
    />
  );
}
