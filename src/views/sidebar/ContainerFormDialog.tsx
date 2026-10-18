import { useId, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { CONTAINER_REGISTRY, type ContainerType } from "@/config/containers";
import { MAX_NAME_LEN } from "@/config/limits";
import { useAction } from "@/controllers/hooks/useAction";
import {
  useAccessMembers,
  useContainerAccess,
} from "@/controllers/hooks/useContainerAccess";
import { useContainerActions } from "@/controllers/hooks/useContainerActions";
import { defaultAccessFor, type ContainerAccess } from "@/model/access";

import { AccessFields } from "./AccessFields";

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
    }
  | {
      readonly mode: "access";
      readonly containerId: string;
    };

export interface ContainerFormDialogProps {
  readonly request: ContainerFormRequest | null;
  readonly onClose: () => void;
}

/** A stable identity per request, so a new one remounts the form. */
function requestKey(request: ContainerFormRequest): string {
  switch (request.mode) {
    case "create":
      return `create:${request.parentId}:${request.type}`;
    case "rename":
      return `rename:${request.containerId}`;
    case "access":
      return `access:${request.containerId}`;
    default: {
      const exhaustive: never = request;
      return exhaustive;
    }
  }
}

interface ContainerFormProps {
  readonly request: Extract<
    ContainerFormRequest,
    { mode: "create" } | { mode: "rename" }
  >;
  readonly onClose: () => void;
}

/**
 * Create and rename, in one form.
 *
 * The two differ only in their initial value, which fields they show and which
 * action they call, so a second component would be the same form twice.
 *
 * State is initialised straight from props and the parent remounts this via
 * `key` when the request changes — rather than resetting through an effect,
 * which React recommends against and which would briefly render the previous
 * node's name.
 */
function ContainerForm({ request, onClose }: ContainerFormProps) {
  const containers = useContainerActions();
  const { run } = useAction();
  const formId = useId();

  const isCreate = request.mode === "create";
  const parentId = isCreate ? request.parentId : null;
  const members = useAccessMembers(parentId);

  const [name, setName] = useState(
    request.mode === "rename" ? request.currentName : "",
  );
  /*
   * Seeded from `defaultAccessFor` rather than from "everyone", so the form
   * opens on the restricted default and the admin has to widen it deliberately
   * (Requirement 8.15).
   */
  const [access, setAccess] = useState<ContainerAccess>(() =>
    defaultAccessFor(request.type),
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const config = CONTAINER_REGISTRY[request.type];
  const typeLabel = config.label;
  const showAccess = isCreate && config.grantable;

  function handleSubmit() {
    setSaving(true);
    setError(undefined);

    void (async () => {
      const result =
        request.mode === "create"
          ? await run(() =>
              containers.create(
                request.parentId,
                request.type,
                name,
                config.grantable ? access : undefined,
              ),
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
      size={showAccess ? "md" : "sm"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          {/*
            `form` rather than `onClick`, so the footer button *is* the form's
            submit control even though the Dialog renders it outside the form
            element. That buys Enter-to-submit without the sr-only duplicate
            button this used to carry — which put two controls named "Create"
            in the same dialog (Requirement 17.1).
          */}
          <Button
            variant="primary"
            type="submit"
            form={formId}
            loading={saving}
          >
            {request.mode === "rename" ? "Rename" : "Create"}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        className="flex flex-col gap-4"
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

        {showAccess && (
          <AccessFields
            typeLabel={typeLabel}
            access={access}
            members={members}
            onChange={setAccess}
          />
        )}
      </form>
    </Dialog>
  );
}

interface ContainerAccessFormProps {
  readonly containerId: string;
  readonly onClose: () => void;
}

/**
 * Access for a container that already exists (Requirement 8.16).
 *
 * Separate from `ContainerForm` because it shares no field with it — the name
 * is read-only context here — but it renders the identical `AccessFields`, so
 * "decide access" looks the same whether it happens at creation or a week
 * later.
 */
function ContainerAccessForm({
  containerId,
  onClose,
}: ContainerAccessFormProps) {
  const vm = useContainerAccess(containerId);
  const containers = useContainerActions();
  const { run } = useAction();

  /*
   * A local draft, committed on save. Editing the store per checkbox would mean
   * a half-made decision is live — tick Bob, and Bob sees the list before the
   * admin has finished deciding — and every tick would pay the simulated
   * latency.
   */
  const [draft, setDraft] = useState<ContainerAccess>(vm.access);
  const [saving, setSaving] = useState(false);

  function handleSave() {
    setSaving(true);

    void (async () => {
      const result = await run(() => containers.setAccess(containerId, draft), {
        successTitle: `Updated access for "${vm.name}"`,
      });

      setSaving(false);

      if (result.ok) onClose();
    })();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Access for "${vm.name}"`}
      description={
        vm.canEdit
          ? "Admins always have access. Choose who else does."
          : (vm.reason ?? "You cannot change this.")
      }
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={saving}
            disabled={!vm.canEdit}
          >
            Save access
          </Button>
        </>
      }
    >
      <AccessFields
        typeLabel={vm.typeLabel}
        access={draft}
        members={vm.members}
        disabled={!vm.canEdit}
        onChange={setDraft}
      />
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

  if (request.mode === "access") {
    return (
      <ContainerAccessForm
        key={requestKey(request)}
        containerId={request.containerId}
        onClose={onClose}
      />
    );
  }

  return (
    <ContainerForm
      key={requestKey(request)}
      request={request}
      onClose={onClose}
    />
  );
}
