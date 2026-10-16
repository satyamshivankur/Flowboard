import type { Meta, StoryObj } from "@storybook/react-vite";

import { AVATAR_COLOR_TOKENS } from "@/config/avatars";
import { PRIORITIES } from "@/config/priorities";
import { STATUS_COLOR_TOKENS } from "@/config/statusCategories";

import { Avatar } from "./Avatar";
import { AvatarGroup } from "./AvatarGroup";
import { Badge } from "./Badge";
import { DueDateChip } from "./DueDateChip";
import { PriorityBadge } from "./PriorityBadge";
import { StatusPill } from "./StatusPill";

/**
 * The token-driven displays, side by side.
 *
 * Grouped into one story file on purpose: the guarantee worth reviewing is that
 * a priority or status looks identical wherever it appears, and that is only
 * checkable by seeing every variant of every token together
 * (Requirement 13.6).
 */
const meta = {
  title: "UI/Token displays",
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const NOW = "2026-10-16T09:00:00.000Z";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="w-24 shrink-0 text-xs font-medium text-ink-400">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}

export const Priority: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Row label="flag">
        {PRIORITIES.map((priority) => (
          <PriorityBadge key={priority} priority={priority} showLabel />
        ))}
      </Row>
      <Row label="pill">
        {PRIORITIES.map((priority) => (
          <PriorityBadge key={priority} priority={priority} variant="pill" />
        ))}
      </Row>
      <Row label="dot">
        {PRIORITIES.map((priority) => (
          <PriorityBadge key={priority} priority={priority} variant="dot" />
        ))}
      </Row>
    </div>
  ),
};

export const Status: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Row label="pill">
        {STATUS_COLOR_TOKENS.map((token) => (
          <StatusPill key={token} name={token.replace("status-", "")} colorToken={token} />
        ))}
      </Row>
      <Row label="dot + label">
        {STATUS_COLOR_TOKENS.map((token) => (
          <StatusPill
            key={token}
            name={token.replace("status-", "")}
            colorToken={token}
            variant="dot-label"
          />
        ))}
      </Row>
      <Row label="dot">
        {STATUS_COLOR_TOKENS.map((token) => (
          <StatusPill
            key={token}
            name={token.replace("status-", "")}
            colorToken={token}
            variant="dot"
          />
        ))}
      </Row>
    </div>
  ),
};

/** Overdue and due-today are the only coloured states, by design. */
export const DueDates: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Row label="inline">
        <DueDateChip date="2026-10-12T00:00:00.000Z" now={NOW} />
        <DueDateChip date="2026-10-16T00:00:00.000Z" now={NOW} />
        <DueDateChip date="2026-10-24T00:00:00.000Z" now={NOW} />
        <DueDateChip date="2025-12-01T00:00:00.000Z" now={NOW} />
      </Row>
      <Row label="chip">
        <DueDateChip date="2026-10-12T00:00:00.000Z" now={NOW} variant="chip" />
        <DueDateChip date="2026-10-16T00:00:00.000Z" now={NOW} variant="chip" />
        <DueDateChip date="2026-10-24T00:00:00.000Z" now={NOW} variant="chip" />
      </Row>
      <Row label="null">
        <span className="text-xs text-ink-400">
          renders nothing — the caller decides on a placeholder
        </span>
      </Row>
    </div>
  ),
};

export const Avatars: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <Row label="tokens">
        {AVATAR_COLOR_TOKENS.map((token, index) => (
          <Avatar
            key={token}
            name={`User ${String(index + 1)}`}
            avatarToken={token}
            size="md"
          />
        ))}
      </Row>
      <Row label="sizes">
        <Avatar name="Alice Nguyen" avatarToken="avatar-indigo" size="xs" />
        <Avatar name="Alice Nguyen" avatarToken="avatar-indigo" size="sm" />
        <Avatar name="Alice Nguyen" avatarToken="avatar-indigo" size="md" />
        <Avatar name="Alice Nguyen" avatarToken="avatar-indigo" size="lg" />
      </Row>
      <Row label="group">
        <AvatarGroup
          users={[
            { id: "1", name: "Alice Nguyen", avatarToken: "avatar-indigo" },
            { id: "2", name: "Bob Mensah", avatarToken: "avatar-teal" },
          ]}
        />
        <AvatarGroup
          users={[
            { id: "1", name: "Alice Nguyen", avatarToken: "avatar-indigo" },
            { id: "2", name: "Bob Mensah", avatarToken: "avatar-teal" },
            { id: "3", name: "Carol Diaz", avatarToken: "avatar-amber" },
            { id: "4", name: "Dan Reed", avatarToken: "avatar-rose" },
            { id: "5", name: "Eve Soto", avatarToken: "avatar-violet" },
          ]}
        />
      </Row>
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      {(["solid", "soft", "outline"] as const).map((variant) => (
        <Row key={variant} label={variant}>
          {(
            ["neutral", "brand", "success", "warning", "danger", "info"] as const
          ).map((tone) => (
            <Badge key={tone} tone={tone} variant={variant}>
              {tone}
            </Badge>
          ))}
        </Row>
      ))}
    </div>
  ),
};
