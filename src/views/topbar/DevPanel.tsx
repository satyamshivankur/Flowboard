import { FlaskConical, RotateCcw, Zap } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { Menu } from "@/components/ui/Menu";
import { useConfirm } from "@/contexts/ConfirmContext";
import { useSimulation } from "@/contexts/SimulationContext";
import { useToast } from "@/contexts/ToastContext";
import { useSession } from "@/controllers/hooks/useSession";

/**
 * Simulation controls.
 *
 * There is no backend, so loading states, error toasts and optimistic rollback
 * would be unobservable without something that can be slow or fail. This panel
 * is what makes every one of those paths demonstrable on command rather than
 * theoretical (Requirement 9.8).
 *
 * "Fail next operation" is the control the demo uses: arm it, drag a card, and
 * watch it snap back with a retryable toast.
 */
export function DevPanel() {
  const { settings, setLatency, setFailureRate, failNext, reset } =
    useSimulation();
  const { resetToSeed } = useSession();
  const { confirm } = useConfirm();
  const toast = useToast();

  const latencyLabel =
    settings.maxLatencyMs === 0
      ? "instant"
      : `${String(settings.minLatencyMs)}–${String(settings.maxLatencyMs)}ms`;

  return (
    <Menu
      align="end"
      label="Simulation settings"
      trigger={
        <IconButton
          icon={FlaskConical}
          label="Simulation settings"
          variant={settings.failNext ? "danger" : "ghost"}
        />
      }
      items={[
        {
          id: "fail-next",
          label: settings.failNext
            ? "Next operation will fail"
            : "Fail next operation",
          icon: Zap,
          tone: settings.failNext ? "danger" : "default",
          onSelect: () => {
            failNext();
            toast.push({
              tone: "info",
              title: "Armed",
              description:
                "The next mutation will fail. Drag a card to see the rollback.",
            });
          },
        },
        {
          id: "latency",
          label: `Latency: ${latencyLabel}`,
          separatorBefore: true,
          onSelect: () => {
            // Cycles rather than offering a slider: three presets cover
            // "feels instant", "realistic" and "obviously slow", which is all
            // the panel needs to make loading states visible.
            if (settings.maxLatencyMs === 0) {
              setLatency(120, 380);
            } else if (settings.maxLatencyMs <= 380) {
              setLatency(800, 1600);
            } else {
              setLatency(0, 0);
            }
          },
        },
        {
          id: "failure-rate",
          label: `Failure rate: ${String(Math.round(settings.failureRate * 100))}%`,
          onSelect: () => {
            const next = settings.failureRate === 0 ? 0.25 : 0;
            setFailureRate(next);
          },
        },
        {
          id: "reset-sim",
          label: "Reset simulation",
          icon: RotateCcw,
          separatorBefore: true,
          onSelect: reset,
        },
        {
          id: "reset-seed",
          label: "Reset data to seed",
          icon: RotateCcw,
          tone: "danger",
          onSelect: () => {
            void (async () => {
              const confirmed = await confirm({
                title: "Reset all data?",
                body: "Every change you have made will be discarded and the seeded workspace restored.",
                confirmLabel: "Reset",
                tone: "danger",
              });

              if (!confirmed) return;

              await resetToSeed();
              toast.pushSuccess("Data reset", "The seeded workspace is back.");
            })();
          },
        },
      ]}
    />
  );
}

/** A compact inline form of the panel, for the mobile overflow menu. */
export function DevPanelButton() {
  const { failNext, settings } = useSimulation();
  const toast = useToast();

  return (
    <Button
      size="sm"
      variant={settings.failNext ? "danger" : "secondary"}
      icon={Zap}
      fullWidth
      onClick={() => {
        failNext();
        toast.push({
          tone: "info",
          title: "Armed",
          description: "The next mutation will fail.",
        });
      }}
    >
      {settings.failNext ? "Will fail" : "Fail next operation"}
    </Button>
  );
}
