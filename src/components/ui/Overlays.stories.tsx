import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";

import { Button } from "./Button";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import { Drawer } from "./Drawer";
import { Input } from "./Input";
import { ScrollShadow } from "./ScrollShadow";

/*
 * Interactive demos live in named components rather than inline in `render`.
 * Storybook invokes a `render` function as a component, but the lint rule
 * cannot know that from its name — and extracting them is clearer regardless.
 */

const meta = {
  title: "UI/Overlays",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function DialogDemo() {
  const [size, setSize] = useState<"sm" | "md" | "lg" | null>(null);

  return (
    <div className="flex items-center gap-3">
      {(["sm", "md", "lg"] as const).map((value) => (
        <Button
          key={value}
          variant="secondary"
          onClick={() => {
            setSize(value);
          }}
        >
          Open {value}
        </Button>
      ))}

      <Dialog
        open={size !== null}
        onClose={() => {
          setSize(null);
        }}
        title="Create a list"
        description="Lists hold tasks and own their own status set."
        size={size ?? "md"}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setSize(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="primary">Create list</Button>
          </>
        }
      >
        <Input label="Name" placeholder="Sprint 15" autoFocus />
      </Dialog>
    </div>
  );
}

export const Dialogs: Story = { render: () => <DialogDemo /> };

function ConfirmDemo() {
  const [open, setOpen] = useState<"danger" | "default" | null>(null);

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="danger"
        onClick={() => {
          setOpen("danger");
        }}
      >
        Delete task
      </Button>

      <Button
        variant="secondary"
        onClick={() => {
          setOpen("default");
        }}
      >
        Neutral confirm
      </Button>

      <ConfirmDialog
        open={open !== null}
        tone={open ?? "default"}
        title={
          open === "danger"
            ? 'Delete "Wire up the auth guard"?'
            : "Move this task?"
        }
        body={
          open === "danger"
            ? "2 subtasks will be deleted too. This cannot be undone."
            : "Its status will be remapped to the destination list."
        }
        confirmLabel={open === "danger" ? "Delete" : "Move"}
        onConfirm={() => {
          setOpen(null);
        }}
        onCancel={() => {
          setOpen(null);
        }}
      />
    </div>
  );
}

/**
 * The destructive confirmation. Naming the cascade in the body is what makes
 * the consequence stated before it happens rather than after
 * (Requirement 14.9).
 */
export const Confirmations: Story = { render: () => <ConfirmDemo /> };

function DrawerDemo() {
  const [side, setSide] = useState<"right" | "bottom" | "left" | null>(null);

  return (
    <div className="flex items-center gap-3">
      {(["right", "bottom", "left"] as const).map((value) => (
        <Button
          key={value}
          variant="secondary"
          onClick={() => {
            setSide(value);
          }}
        >
          Open {value}
        </Button>
      ))}

      <Drawer
        open={side !== null}
        onClose={() => {
          setSide(null);
        }}
        side={side ?? "right"}
        label="Task details"
        widthClassName={side === "left" ? "md:w-sidebar" : "md:w-drawer"}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold text-ink-900">Task details</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSide(null);
            }}
          >
            Close
          </Button>
        </div>

        <ScrollShadow>
          <div className="flex flex-col gap-4 px-5 py-4">
            {Array.from({ length: 12 }, (_, index) => (
              <Input
                key={index}
                label={`Field ${String(index + 1)}`}
                placeholder="Scroll to see the edge fades"
              />
            ))}
          </div>
        </ScrollShadow>
      </Drawer>
    </div>
  );
}

/**
 * One component, three positions.
 *
 * Switch the viewport to Phone and reopen the `right` drawer: the same panel
 * becomes a bottom sheet, because the difference is positioning rather than
 * behaviour (Requirement 20.7).
 */
export const Drawers: Story = { render: () => <DrawerDemo /> };

export const ScrollShadows: Story = {
  render: () => (
    <div className="flex h-64 w-72 flex-col rounded-lg bg-surface ring-1 ring-border">
      <ScrollShadow>
        <ul className="flex flex-col">
          {Array.from({ length: 24 }, (_, index) => (
            <li
              key={index}
              className="flex h-11 shrink-0 items-center border-b border-border px-3 text-sm text-ink-900"
            >
              Row {index + 1}
            </li>
          ))}
        </ul>
      </ScrollShadow>
    </div>
  ),
};
