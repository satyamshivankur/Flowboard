import type { Meta, StoryObj } from "@storybook/react-vite";
import { Inbox, ListTodo, Plus, Search } from "lucide-react";
import { useState } from "react";

import { Button } from "./Button";
import { Card } from "./Card";
import { EmptyState } from "./EmptyState";
import { Kbd } from "./Kbd";
import { Skeleton } from "./Skeleton";
import { Spinner } from "./Spinner";
import { Toast } from "./Toast";

const meta = {
  title: "UI/Feedback",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Each skeleton variant is sized to the layout it stands in for, so the
 * placeholder does not collapse into the final content and shift everything
 * around it (Requirement 14.1).
 */
export const Skeletons: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-8">
      <div className="w-64">
        <p className="mb-2 text-xs font-medium text-ink-400">text</p>
        <Skeleton variant="text" />
      </div>
      <div className="w-column">
        <p className="mb-2 text-xs font-medium text-ink-400">card</p>
        <Skeleton variant="card" />
      </div>
      <div className="w-64">
        <p className="mb-2 text-xs font-medium text-ink-400">tree</p>
        <Skeleton variant="tree" lines={5} />
      </div>
      <div className="w-96">
        <p className="mb-2 text-xs font-medium text-ink-400">row</p>
        <Skeleton variant="row" lines={4} />
      </div>
      <div>
        <p className="mb-2 text-xs font-medium text-ink-400">column</p>
        <Skeleton variant="column" lines={2} />
      </div>
    </div>
  ),
};

export const EmptyStates: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-6">
      <Card className="w-column" padding="none">
        <EmptyState
          icon={ListTodo}
          title="No tasks yet"
          description="Create the first task in this list to get started."
          action={
            <Button size="sm" variant="primary" icon={Plus}>
              New task
            </Button>
          }
        />
      </Card>

      <div className="w-column">
        <EmptyState icon={Inbox} title="Nothing here" size="sm" isDropTarget />
      </div>

      <div className="w-column">
        <EmptyState
          icon={Inbox}
          title="Drop to move"
          size="sm"
          isDropTarget
          isDragOver
        />
      </div>

      <div className="w-64">
        <EmptyState
          icon={Search}
          title="No matches"
          description="Try a different search term."
          size="sm"
        />
      </div>
    </div>
  ),
};

function ToastDemo() {
  const [dismissed, setDismissed] = useState<readonly string[]>([]);

  const toasts = [
    { id: "1", tone: "success" as const, title: "Task moved to Done" },
    {
      id: "2",
      tone: "error" as const,
      title: "Connection problem",
      description: "Network request failed. Please try again.",
      action: { label: "Try again", onClick: () => undefined },
    },
    {
      id: "3",
      tone: "warning" as const,
      title: "Not allowed",
      description: "You don't have permission to archive lists.",
    },
    {
      id: "4",
      tone: "info" as const,
      title: "Status remapped",
      description: "Backlog has no In review status, so the task is now To do.",
    },
  ];

  return (
    <div className="flex w-80 flex-col gap-2">
      {toasts
        .filter((toast) => !dismissed.includes(toast.id))
        .map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onDismiss={(id) => {
              setDismissed((current) => [...current, id]);
            }}
          />
        ))}

      {dismissed.length === 4 && (
        <Button
          size="sm"
          onClick={() => {
            setDismissed([]);
          }}
        >
          Reset
        </Button>
      )}
    </div>
  );
}

export const Toasts: Story = { render: () => <ToastDemo /> };

export const Spinners: Story = {
  render: () => (
    <div className="flex items-center gap-4 text-ink-600">
      <Spinner size="xs" />
      <Spinner size="sm" />
      <Spinner size="md" label="Loading" />
    </div>
  ),
};

export const Shortcuts: Story = {
  render: () => (
    <div className="flex items-center gap-4">
      <Kbd keys={["⌘", "K"]} />
      <Kbd keys={["⌘", "↵"]} />
      <Kbd keys={["Esc"]} />
      <Kbd keys={["↑"]} />
    </div>
  ),
};

/** Card states, including the two that only appear during a drag. */
export const Cards: Story = {
  render: () => (
    <div className="flex flex-wrap items-start gap-4">
      {(
        [
          { label: "resting", props: {} },
          { label: "interactive", props: { interactive: true } },
          { label: "elevated", props: { elevated: true } },
          { label: "selected", props: { selected: true } },
          { label: "dragging (source)", props: { dragging: true } },
          { label: "overlay (clone)", props: { overlay: true } },
        ] as const
      ).map(({ label, props }) => (
        <Card key={label} {...props} className="w-48">
          <p className="text-sm font-medium text-ink-900">Wire up auth guard</p>
          <p className="mt-1 text-xs text-ink-400">{label}</p>
        </Card>
      ))}
    </div>
  ),
};
