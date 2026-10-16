import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { VIEW_IDS, VIEW_REGISTRY, type ViewId } from "@/config/views";
import { useNavigation } from "@/contexts/NavigationContext";

export interface ViewSwitcherProps {
  readonly className?: string;
}

/**
 * Board / list toggle.
 *
 * Maps over `VIEW_REGISTRY` rather than listing the views, so adding a calendar
 * view needs no change here (Requirement 21.5).
 */
export function ViewSwitcher({ className }: ViewSwitcherProps) {
  const { view, setView } = useNavigation();

  return (
    <SegmentedControl<ViewId>
      ariaLabel="View"
      value={view}
      onChange={setView}
      className={className}
      options={VIEW_IDS.map((id) => ({
        value: id,
        label: VIEW_REGISTRY[id].label,
        icon: VIEW_REGISTRY[id].icon,
      }))}
    />
  );
}
