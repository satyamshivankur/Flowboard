import type { Meta, StoryObj } from "@storybook/react-vite";
import { FileText } from "lucide-react";
import { useState } from "react";

import { Button } from "./Button";
import {
  CommandPalette,
  type CommandPaletteGroup,
} from "./CommandPalette";
import { ConfirmDialog } from "./ConfirmDialog";
import { Dialog } from "./Dialog";
import { Drawer } from "./Drawer";
import { Highlight } from "./Highlight";
import { Input } from "./Input";
import { Kbd } from "./Kbd";
import { ScrollShadow } from "./ScrollShadow";
import { StatusPill } from "./StatusPill";

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

/*
 * The palette is props-only, including its item labels — it knows nothing
 * about tasks, permissions or how a match is highlighted. That is what lets it
 * be driven from literal data here, with no store and no providers
 * (Requirement 11.4).
 */
const PALETTE_GROUPS: CommandPaletteGroup[] = [
  {
    id: "backlog",
    label: "Acme / Engineering / Q2 / Backlog",
    items: [
      {
        id: "t-001",
        icon: FileText,
        label: (
          <Highlight text="Define onboarding checklist" query="onboarding" />
        ),
        meta: <StatusPill name="To do" colorToken="status-todo" />,
      },
      {
        id: "t-002",
        icon: FileText,
        label: <Highlight text="Audit empty states" query="empty" />,
        description: (
          <Highlight
            text="…states we should audit across the product…"
            query="audit"
          />
        ),
        meta: <StatusPill name="In progress" colorToken="status-active" />,
      },
    ],
  },
  {
    id: "sprint",
    label: "Acme / Engineering / Q2 / Sprint 14",
    items: [
      {
        id: "t-007",
        icon: FileText,
        label: <Highlight text="Add keyboard navigation" query="keyboard" />,
        meta: <StatusPill name="Done" colorToken="status-done" />,
      },
    ],
  },
];

function CommandPaletteDemo() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Filtering is the caller's job, so the story does it the crude way to keep
  // the focus on the primitive's own behaviour.
  const groups = PALETTE_GROUPS.filter(() => query.trim().length > 0);

  return (
    <div className="flex flex-col items-start gap-3">
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open palette
      </Button>

      <p className="text-xs text-ink-400">
        Type anything to see results. Arrow keys navigate, Enter chooses, Escape
        closes. Switch to the phone viewport to see the full-screen form.
      </p>

      <CommandPalette
        open={open}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
        query={query}
        onQueryChange={setQuery}
        groups={groups}
        onSelect={() => {
          setOpen(false);
          setQuery("");
        }}
        label="Search tasks"
        placeholder="Search tasks by title or description…"
        hintLabel="Search every task you can see in this workspace."
        emptyLabel="No tasks match."
        footer={
          <span className="flex items-center gap-1 text-xs text-ink-400">
            <Kbd keys={["↑", "↓"]} /> to navigate
          </span>
        }
      />
    </div>
  );
}

export const CommandPalettes: Story = {
  render: () => <CommandPaletteDemo />,
};

/** The palette at its base-viewport shape, which is a full-screen sheet. */
export const CommandPalettePhone: Story = {
  name: "Command palette · phone",
  parameters: { viewport: { defaultViewport: "phone" } },
  render: () => <CommandPaletteDemo />,
};

export const Highlights: Story = {
  render: () => (
    <div className="flex flex-col gap-2 text-sm text-ink-900">
      <Highlight text="Define onboarding checklist" query="onboarding" />
      {/* Case-insensitive, and every occurrence rather than just the first. */}
      <Highlight text="Audit the audit of the audit" query="AUDIT" />
      {/*
        A regex metacharacter in the query. The needle is escaped before it
        reaches the `RegExp`, so this renders instead of throwing — which a
        single `(` would otherwise do on a keystroke.
      */}
      <Highlight text="Rework the task detail (layout)" query="(layout)" />
      {/* An empty query leaves the text untouched. */}
      <Highlight text="Nothing to highlight here" query="" />
    </div>
  ),
};
