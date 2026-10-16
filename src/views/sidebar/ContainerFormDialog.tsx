import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { CONTAINER_REGISTRY, type ContainerType } from "@/config/containers";
import { MAX_NAME_LEN } from "@/config/limits";
import { useAction } from "@/controllers/hooks/useAction";
import { useContainerActions } from "@/controllers/hooks/useContainerActions";

/** What the dialog is currently doing. `null` means closed. */
export type ContainerFormRequest =
  | {
      readonly mode: "create";
      readonly parentId: string;
      readonly type: ContainerType;
      readonly parentName: string;
    }
  | {
      readonly mode: "rename";
      readonly containerId: string;
      readonly currentName: string;
      readonly type: ContainerType;
    };

export interface ContainerFormDialogProps {
  readonly request: ContainerFormRequest | null;
  readonly onClose: () => void;
}

/** A stable identity per request, so a new one remounts the form. */
function requestKey(request: ContainerFormRequest): string {
  return request.mode === "create"
    ? `create:${request.parentId}:${request.type}`
    : `rename:${request.containerId}`;
}

interface ContainerFormProps {
  readonly request: ContainerFormRequest;
  readonly onClose: () => void;
}

/**
 * Create and rename, in one form.
 *
 * The two differ only in their initial value and which action they call, so a
 * second component would be the same form twice.
 *
 * State is initialised straight from props and the parent remounts this via
 * `key` when the request changes — rather than resetting through an effect,
 * which React recommends against and which would briefly render the previous
 * node's name.
 */
function ContainerForm({ request, onClose }: ContainerFormProps) {
  const containers = useContainerActions();
  const { run } = useAction();

  const [name, setName] = useState(
    request.mode === "rename" ? request.currentName : "",
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const typeLabel = CONTAINER_REGISTRY[request.type].label;

  function handleSubmit() {
    setSaving(true);
    setError(undefined);

    void (async () => {
      const result =
        request.mode === "create"
          ? await run(() =>
              containers.create(request.parentId, request.type, name),
            )
          : await run(() => containers.rename(request.containerId, name));

      setSaving(false);

      if (result.ok) {
        onClose();
        return;
      }

      /*
       * A field-scoped validation error belongs on the input. Anything else —
       * a permission denial, a network failure — has already been surfaced as a
       * toast by `run`, so the dialog gets out of the way.
       */
      if (result.error.code === "VALIDATION") {
        setError(result.error.message);
        return;
      }

      onClose();
    })();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={
        request.mode === "rename"
          ? `Rename ${typeLabel.toLowerCase()}`
          : `New ${typeLabel.toLowerCase()}`
      }
      {...(request.mode === "create"
        ? { description: `Inside "${request.parentName}"` }
        : {})}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit} loading={saving}>
            {request.mode === "rename" ? "Rename" : "Create"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <Input
          label="Name"
          value={name}
          maxLength={MAX_NAME_LEN}
          autoFocus
          placeholder={`${typeLabel} name`}
          error={error}
          onChange={(event) => {
            setName(event.target.value);
            setError(undefined);
          }}
        />

        {/* Lets Enter submit without a second visible button. */}
        <button type="submit" className="sr-only">
          {request.mode === "rename" ? "Rename" : "Create"}
        </button>
      </form>
    </Dialog>
  );
}

export function ContainerFormDialog({
  request,
  onClose,
}: ContainerFormDialogProps) {
  /*
   * Unmounted while closed, which means the Dialog's exit transition is skipped
   * for this one case. A form that animates out while showing stale values is
   * worse than one that closes immediately, and `useLatched` cannot help here —
   * the state being preserved would be the user's half-typed input.
   */
  if (!request) return null;

  return (
    <ContainerForm
      key={requestKey(request)}
      request={request}
      onClose={onClose}
    />
  );
}
