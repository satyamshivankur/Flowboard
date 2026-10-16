import type { Meta, StoryObj } from "@storybook/react-vite";
import {
  Columns3,
  MoreHorizontal,
  Pencil,
  Rows3,
  Search,
  Trash2,
} from "lucide-react";
import { useState } from "react";

import {
  PRIORITIES,
  PRIORITY_CONFIG,
  type Priority,
} from "@/config/priorities";

import { Checkbox } from "./Checkbox";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
import { Menu } from "./Menu";
import { PriorityBadge } from "./PriorityBadge";
import { SegmentedControl } from "./SegmentedControl";
import { Select } from "./Select";
import { Separator } from "./Separator";
import { Textarea } from "./Textarea";
import { Tooltip } from "./Tooltip";

/*
 * Interactive demos live in named components rather than inline in `render`,
 * since Storybook invokes `render` as a component but the lint rule cannot
 * know that from its name.
 */

const meta = {
  title: "UI/Controls",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function InputsDemo() {
  const [value, setValue] = useState("Wire up the auth guard");

  return (
    <div className="flex max-w-sm flex-col gap-5">
      <Input
        label="Title"
        value={value}
        onChange={(event) => {
          setValue(event.target.value);
        }}
      />

      <Input label="Search" placeholder="Search tasks…" leadingIcon={Search} />

      <Input
        label="With hint"
        placeholder="Optional"
        hint="Max 500 characters"
      />

      <Input
        label="With error"
        value=""
        error="Title is required."
        onChange={() => undefined}
      />

      <Input
        label="Disabled"
        value="Read only"
        disabled
        onChange={() => undefined}
      />

      <Input label="Small" inputSize="sm" placeholder="Dense row" />
    </div>
  );
}

export const Inputs: Story = { render: () => <InputsDemo /> };

function TextareaDemo() {
  const [value, setValue] = useState(
    "Redirect unauthenticated users to the sign-in screen and preserve the intended destination.",
  );
  const [committed, setCommitted] = useState(0);

  return (
    <div className="flex max-w-md flex-col gap-5">
      <Textarea
        label="Description"
        value={value}
        maxLength={500}
        showCount
        onChange={(event) => {
          setValue(event.target.value);
        }}
        onCommit={() => {
          setCommitted((count) => count + 1);
        }}
        onCancel={() => {
          setValue("");
        }}
      />

      <p className="text-xs text-ink-400">
        Committed {committed} time(s) — try ⌘↵, then Escape
      </p>

      <Textarea
        label="With error"
        value=""
        error="Description is too long."
        onChange={() => undefined}
      />
    </div>
  );
}

/**
 * Cmd/Ctrl+Enter commits; Escape reverts the field rather than closing an
 * enclosing drawer — losing a long description to a stray Escape is the obvious
 * failure mode (Requirement 7.5).
 */
export const Textareas: Story = { render: () => <TextareaDemo /> };

function CheckboxDemo() {
  const [checked, setChecked] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Checkbox
        label="Interactive"
        checked={checked}
        onChange={(event) => {
          setChecked(event.target.checked);
        }}
      />
      <Checkbox label="Checked" checked onChange={() => undefined} />
      <Checkbox
        label="Indeterminate"
        indeterminate
        onChange={() => undefined}
      />
      <Checkbox label="Disabled" disabled onChange={() => undefined} />
      <Checkbox label="Large" size="md" checked onChange={() => undefined} />
    </div>
  );
}

export const Checkboxes: Story = { render: () => <CheckboxDemo /> };

function SegmentedDemo() {
  const [view, setView] = useState<"board" | "list">("board");
  const [density, setDensity] = useState<"comfortable" | "compact">(
    "comfortable",
  );

  return (
    <div className="flex flex-col items-start gap-5">
      <SegmentedControl
        ariaLabel="View"
        value={view}
        onChange={setView}
        options={[
          { value: "board", label: "Board", icon: Columns3 },
          { value: "list", label: "List", icon: Rows3 },
        ]}
      />

      <SegmentedControl
        ariaLabel="View, icons only"
        value={view}
        onChange={setView}
        iconOnly
        options={[
          { value: "board", label: "Board", icon: Columns3 },
          { value: "list", label: "List", icon: Rows3 },
        ]}
      />

      <SegmentedControl
        ariaLabel="Density"
        size="md"
        value={density}
        onChange={setDensity}
        options={[
          { value: "comfortable", label: "Comfortable" },
          { value: "compact", label: "Compact" },
        ]}
      />
    </div>
  );
}

export const Segmented: Story = { render: () => <SegmentedDemo /> };

function SelectDemo() {
  const [priority, setPriority] = useState<Priority | null>("high");

  return (
    <div className="flex max-w-xs flex-col gap-5">
      <Select<Priority>
        label="Priority"
        value={priority}
        onChange={setPriority}
        options={PRIORITIES.map((value) => ({
          value,
          label: PRIORITY_CONFIG[value].label,
        }))}
        renderOption={(option) => (
          <PriorityBadge priority={option.value} showLabel />
        )}
        renderValue={(option) => (
          <PriorityBadge priority={option.value} showLabel />
        )}
      />

      <Select
        label="Empty"
        value={null}
        onChange={() => undefined}
        placeholder="Select a status…"
        options={[{ value: "a", label: "To do" }]}
      />

      <Select
        label="Disabled"
        value="a"
        disabled
        onChange={() => undefined}
        options={[{ value: "a", label: "To do" }]}
      />
    </div>
  );
}

/** Options carry an icon, which is why this is a Listbox not a native select. */
export const Selects: Story = { render: () => <SelectDemo /> };

/**
 * A disabled item carries its reason, so a greyed action explains itself
 * instead of looking broken (Requirement 8.11).
 */
export const Menus: Story = {
  render: () => (
    <Menu
      label="Task actions"
      trigger={<IconButton icon={MoreHorizontal} label="Task actions" />}
      items={[
        {
          id: "edit",
          label: "Rename",
          icon: Pencil,
          onSelect: () => undefined,
        },
        {
          id: "archive",
          label: "Archive list",
          disabled: true,
          disabledReason: "Admins only",
          onSelect: () => undefined,
        },
        {
          id: "delete",
          label: "Delete task",
          icon: Trash2,
          tone: "danger",
          separatorBefore: true,
          onSelect: () => undefined,
        },
      ]}
    />
  ),
};

export const IconButtons: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        {(["primary", "secondary", "ghost", "danger"] as const).map(
          (variant) => (
            <IconButton
              key={variant}
              icon={Pencil}
              label={`Edit (${variant})`}
              variant={variant}
            />
          ),
        )}
      </div>

      <div className="flex items-center gap-3">
        <IconButton icon={Pencil} label="Extra small" size="xs" />
        <IconButton icon={Pencil} label="Small" size="sm" />
        <IconButton icon={Pencil} label="Medium" size="md" />
      </div>

      <div className="flex items-center gap-3">
        <IconButton icon={Pencil} label="Loading" loading />
        <IconButton icon={Pencil} label="Disabled" disabled />
      </div>
    </div>
  ),
};

export const Tooltips: Story = {
  render: () => (
    <div className="flex items-center gap-8 p-12">
      {(["top", "bottom", "left", "right"] as const).map((side) => (
        <Tooltip key={side} content={`Tooltip on ${side}`} side={side}>
          <button
            type="button"
            className="rounded-md bg-surface-sunken px-3 py-1.5 text-sm ring-1 ring-border"
          >
            {side}
          </button>
        </Tooltip>
      ))}
    </div>
  ),
};

export const Separators: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Separator />
      <Separator spacing="sm" />
      <div className="flex h-8 items-center gap-3">
        <span className="text-sm text-ink-600">Left</span>
        <Separator orientation="vertical" />
        <span className="text-sm text-ink-600">Right</span>
      </div>
    </div>
  ),
};
