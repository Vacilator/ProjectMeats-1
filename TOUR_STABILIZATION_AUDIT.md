# TOUR_STABILIZATION_AUDIT

## Deliverables + expected results

- `frontend/src/components/Cockpit/CockpitTour.tsx` now launches from a real cockpit readiness signal, filters out selectors that will not mount, and waits briefly for anchors before dropping a step.
- `frontend/src/pages/Cockpit/CockpitDashboard.tsx` now passes stable availability metadata and a page-ready signal into the tour instead of relying on a fixed one-second start timer.
- Stable tour anchors are now exposed on the command bar, cockpit grid, and quick actions widget, and focused frontend coverage guards the regression path.

## Acceptance criteria

1. The tour does not run until the cockpit page reports ready.
2. Missing or permission-gated widget anchors are removed from the step list instead of being skipped immediately at runtime.
3. Stable selectors back the search, grid, and quick actions steps so Joyride is no longer coupled to brittle library markup.

## Dependencies

- Existing shared onboarding contract in `frontend/src/components/Onboarding/OnboardingProvider.tsx`.
- Existing Cockpit dashboard widget layout/load flow in `frontend/src/pages/Cockpit/CockpitDashboard.tsx`.

## Risk register + mitigations

- **Late widget mount still races Joyride** × **medium**: the launch path now polls for expected selectors before starting, and target-not-found pauses before advancing.
- **Manual relaunch double-counts start telemetry** × **medium**: manual launches reuse the onboarding nonce and do not call `markTourStarted` a second time.
- **Selector drift after future refactors** × **medium**: the tour now depends on explicit IDs/test IDs rather than transient class names.

## Testing strategy

- `npx vitest run src/components/Cockpit/CockpitTour.test.tsx`
- `npm run type-check`
- `npx eslint src/components/Cockpit/CockpitTour.tsx src/components/Cockpit/CockpitTour.test.tsx src/pages/Cockpit/CockpitDashboard.tsx src/components/Cockpit/CommandBar.tsx src/components/Widgets/QuickActionsWidget.tsx src/components/Widgets/WidgetCard.tsx`

## Rollback

- Revert the Cockpit tour selector/readiness batch to restore the prior static-start flow if a downstream Joyride compatibility issue appears.
