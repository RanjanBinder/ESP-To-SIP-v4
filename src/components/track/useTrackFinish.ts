/**
 * useTrackFinish.ts — committing the drawn track as one asset.
 *
 * Shared by the overlay (Enter key) and the canvas (double-click) so both paths
 * produce exactly the same result: one `addObject` call — hence one undo step
 * and one version-history entry (§6, §7) — followed by an advisory validation
 * pass routed to the Issue Navigation panel.
 */

import { useCallback } from 'react';
import { useEditor } from '../../store/editorStore';
import { useSODStore } from '../../store/sodStore';
import { useTrackDraw, clearTrackDraft } from '../../store/trackDrawStore';
import { validateTrack } from '../../lib/track/validate';
import type { SODViolation } from '../../lib/validation/sodValidator';

/** Number of rule evaluations `validateTrack` runs per asset — used to keep the
 *  panel's "checks passed" figure honest. */
const CHECKS_PER_TRACK = 4;

export function useTrackFinish(): () => boolean {
  const { addObject, selectObject, activeLayerId, objects } = useEditor();
  const { checkResult, setCheckResult, setPanelOpen } = useSODStore();
  const track = useTrackDraw();

  return useCallback((): boolean => {
    const asset = track.buildAsset(activeLayerId);
    if (!asset) return false;

    // A single addObject is a single history snapshot, so Ctrl+Z after finishing
    // removes the entire track in one step.
    addObject(asset);
    selectObject(asset.id);

    const issues = validateTrack(asset, objects);
    if (issues.length) mergeIssues(issues);

    clearTrackDraft();
    track.reset();
    track.showToast(
      issues.length
        ? `${asset.track.trackName} created · ${issues.length} issue${issues.length === 1 ? '' : 's'} to review`
        : `${asset.track.trackName} created`,
    );
    return true;

    function mergeIssues(newIssues: SODViolation[]) {
      const base = checkResult;
      const violations = [...(base?.violations ?? []), ...newIssues];
      setCheckResult({
        id: base?.id ?? `track-check-${Date.now()}`,
        source: base?.source ?? 'track-tool',
        sourceKind: base?.sourceKind ?? 'canvas',
        sourceFileName: base?.sourceFileName,
        sourceUrl: base?.sourceUrl,
        sourcePage: base?.sourcePage,
        ranAt: new Date().toISOString(),
        assetsChecked: (base?.assetsChecked ?? 0) + 1,
        checksRun: (base?.checksRun ?? 0) + CHECKS_PER_TRACK,
        violations,
        counts: {
          V1: violations.filter(v => v.severity === 'V1').length,
          V2: violations.filter(v => v.severity === 'V2').length,
          total: violations.length,
        },
        checksPassed: Math.max(0, (base?.checksPassed ?? 0) + CHECKS_PER_TRACK - newIssues.length),
        passed: violations.length === 0,
      });
      // Advisory: the panel opens so the issues are findable, but nothing blocks.
      setPanelOpen(true);
    }
  }, [track, activeLayerId, addObject, selectObject, objects, checkResult, setCheckResult, setPanelOpen]);
}
