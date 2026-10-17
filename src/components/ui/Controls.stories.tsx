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

import type { AvatarColorToken } from "@/config/avatars";
import {
  PRIORITIES,
  PRIORITY_CONFIG,
  type Priority,
} from "@/config/priorities";

import { AssigneePicker } from "./AssigneePicker";
import { Avatar } from "./Avatar";
import type { AvatarGroupMember } from "./AvatarGroup";
import { Checkbox } from "./Checkbox";
import { DatePicker } from "./DatePicker";
import { DueDatePicker } from "./DueDatePicker";
import { IconButton } from "./IconButton";
import { Input } from "./Input";
import { Menu } from "./Menu";
import { PriorityBadge } from "./PriorityBadge";
import { PriorityPicker } from "./PriorityPicker";
import { SegmentedControl } from "./SegmentedControl";
import { Select, type SelectOption } from "./Select";
import { Separator } from "./Separator";
import {
  StatusPicker,
  type StatusPickerOption,
} from "./StatusPicker";
import { StatusPill } from "./StatusPill";
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

/*
 * The three shapes a real option takes in this app. Each carries its own
 * visual, so the closed trigger and the open list cannot disagree — which is
 * the failure the old `renderOption`/`renderValue` pair made easy.
 */
const STATUS_OPTIONS: SelectOption<string>[] = [
  {
    value: "st-todo",
    label: "To do",
    content: (
      <StatusPill name="To do" colorToken="status-todo" variant="dot-label" />
    ),
  },
  {
    value: "st-active",
    label: "In progress",
    content: (
      <StatusPill
        name="In progress"
        colorToken="status-active"
        variant="dot-label"
      />
    ),
  },
  {
    value: "st-done",
    label: "Done",
    content: (
      <StatusPill name="Done" colorToken="status-done" variant="dot-label" />
    ),
  },
];

const ASSIGNEE_OPTIONS: SelectOption<string>[] = [
  { value: "u-alice", label: "Alice Nguyen", avatarToken: "avatar-indigo" },
  { value: "u-bob", label: "Bob Mensah", avatarToken: "avatar-teal" },
  { value: "u-carol", label: "Carol Diaz", avatarToken: "avatar-amber" },
].map((user) => ({
  value: user.value,
  label: user.label,
  content: (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar
        name={user.label}
        avatarToken={user.avatarToken as AvatarColorToken}
        size="xs"
        showTooltip={false}
      />
      <span className="truncate">{user.label}</span>
    </span>
  ),
  // The trigger has less room than a row, so it shows the avatar alone.
  triggerContent: (
    <Avatar
      name={user.label}
      avatarToken={user.avatarToken as AvatarColorToken}
      size="xs"
      showTooltip={false}
    />
  ),
}));

function SelectDemo() {
  const [priority, setPriority] = useState<Priority | null>("high");
  const [status, setStatus] = useState<string | null>("st-active");
  const [assignee, setAssignee] = useState<string | null>(null);

  return (
    <div className="flex max-w-xs flex-col gap-5">
      <Select<Priority>
        label="Priority"
        value={priority}
        onChange={setPriority}
        options={PRIORITIES.map((value) => ({
          value,
          label: PRIORITY_CONFIG[value].label,
          content: <PriorityBadge priority={value} showLabel />,
        }))}
      />

      <Select
        label="Status"
        value={status}
        onChange={setStatus}
        options={STATUS_OPTIONS}
      />

      {/* `triggerContent` differing from `content`: the row shows the avatar
          and the name, the button shows only the avatar. */}
      <Select
        label="Assignee"
        value={assignee}
        onChange={setAssignee}
        placeholder="Unassigned"
        options={ASSIGNEE_OPTIONS}
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

/*
 * A fixed reference "today", so the ring and the opening month are the same
 * every time the workbench is opened.
 */
const PICKER_STATUSES: StatusPickerOption[] = [
  { id: "st-todo", name: "To do", colorToken: "status-todo" },
  { id: "st-active", name: "In progress", colorToken: "status-active" },
  { id: "st-done", name: "Done", colorToken: "status-done" },
];

const SEED_MEMBERS: AvatarGroupMember[] = [
  { id: "u-alice", name: "Alice Nguyen", avatarToken: "avatar-indigo" },
  { id: "u-bob", name: "Bob Mensah", avatarToken: "avatar-teal" },
  { id: "u-carol", name: "Carol Diaz", avatarToken: "avatar-amber" },
];

const STORY_NOW = "2026-10-16T09:00:00.000Z";

function DatePickerDemo() {
  const [due, setDue] = useState<string | null>("2026-10-21T09:00:00.000Z");
  const [empty, setEmpty] = useState<string | null>(null);

  return (
    <div className="flex max-w-xs flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-ink-600">With a value</p>
        <DatePicker
          label="Due date"
          value={due}
          now={STORY_NOW}
          onChange={setDue}
        />
        <p className="text-xs text-ink-400">Stored as {due ?? "null"}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-ink-600">Empty</p>
        <DatePicker
          label="Start date"
          value={empty}
          now={STORY_NOW}
          onChange={setEmpty}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-ink-600">
          Bounded — this month onward only
        </p>
        <DatePicker
          label="Bounded date"
          value={null}
          now={STORY_NOW}
          minDate={new Date(2026, 9, 16)}
          maxDate={new Date(2026, 11, 31)}
          onChange={() => undefined}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <p className="text-xs font-medium text-ink-600">Disabled</p>
        <DatePicker
          label="Read-only date"
          value="2026-10-21T09:00:00.000Z"
          now={STORY_NOW}
          disabled
          onChange={() => undefined}
        />
      </div>

      <p className="text-xs text-ink-400">
        Calendar-only — there is nothing to type into. Opening the panel lands
        focus on a day; arrows move one day, Home and End jump to the ends of
        the week, PageUp and PageDown change month, and holding Shift turns
        those into year jumps.
      </p>
    </div>
  );
}

export const DatePickers: Story = { render: () => <DatePickerDemo /> };

/** The same field on a phone, where the calendar anchors below the input. */
export const DatePickerPhone: Story = {
  name: "Date picker · phone",
  parameters: { viewport: { defaultViewport: "phone" } },
  render: () => <DatePickerDemo />,
};

/*
 * The inline pickers: a badge, pill, chip or avatar stack that edits where it
 * is displayed. No chevron — the affordance is the hover and focus highlight,
 * which is why the read-only column below looks identical minus the
 * interactivity.
 */
function InlinePickerDemo() {
  const [priority, setPriority] = useState<Priority>("high");
  const [status, setStatus] = useState("st-active");
  const [due, setDue] = useState<string | null>("2026-10-21T09:00:00.000Z");
  const [undated, setUndated] = useState<string | null>(null);
  // `noUncheckedIndexedAccess` is on, so the literal index is narrowed.
  const [assigned, setAssigned] = useState<string[]>(["u-alice"]);
  const [none, setNone] = useState<string[]>([]);

  const toggle =
    (set: (next: string[]) => void, current: string[]) => (userId: string) => {
      set(
        current.includes(userId)
          ? current.filter((id) => id !== userId)
          : [...current, userId],
      );
    };

  return (
    <div className="grid gap-x-8 gap-y-4 sm:grid-cols-[auto_1fr_1fr]">
      <p className="text-xs font-medium text-ink-400">Field</p>
      <p className="text-xs font-medium text-ink-400">Editable</p>
      <p className="text-xs font-medium text-ink-400">Read-only</p>

      <p className="text-xs text-ink-600">Priority</p>
      <PriorityPicker value={priority} showLabel onChange={setPriority} />
      <PriorityPicker value={priority} showLabel disabled onChange={setPriority} />

      <p className="text-xs text-ink-600">Status</p>
      <StatusPicker value={status} options={PICKER_STATUSES} onChange={setStatus} />
      <StatusPicker
        value={status}
        options={PICKER_STATUSES}
        disabled
        onChange={setStatus}
      />

      <p className="text-xs text-ink-600">Due date</p>
      <DueDatePicker value={due} now={STORY_NOW} onChange={setDue} />
      <DueDatePicker value={due} now={STORY_NOW} disabled onChange={setDue} />

      <p className="text-xs text-ink-600">Due date, unset</p>
      <DueDatePicker value={undated} now={STORY_NOW} onChange={setUndated} />
      <span className="text-xs text-ink-400">
        nothing — a placeholder that cannot be set is noise
      </span>

      <p className="text-xs text-ink-600">Assignees</p>
      <AssigneePicker
        assignees={SEED_MEMBERS.filter((m) => assigned.includes(m.id))}
        members={SEED_MEMBERS}
        align="start"
        onToggle={toggle(setAssigned, assigned)}
      />
      <AssigneePicker
        assignees={SEED_MEMBERS.filter((m) => assigned.includes(m.id))}
        members={SEED_MEMBERS}
        disabled
        onToggle={() => undefined}
      />

      <p className="text-xs text-ink-600">Assignees, empty</p>
      <AssigneePicker
        assignees={[]}
        members={SEED_MEMBERS}
        align="start"
        onToggle={toggle(setNone, none)}
      />
      <span className="text-xs text-ink-400">nothing</span>
    </div>
  );
}

export const InlinePickers: Story = { render: () => <InlinePickerDemo /> };
