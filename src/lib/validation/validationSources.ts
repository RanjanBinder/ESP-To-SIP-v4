import type { CanvasObject } from '../../types/scene';
import { validateTrack } from '../track/validate';
import { adaptSOD, ValidationResult } from './validationModel';
import { runGradientValidation } from './gradientValidator';

/** Reuses the editor's real track rules; no checklist data is fabricated. */
export function runTrackValidations(objects: CanvasObject[]): ValidationResult[] {
  return objects.flatMap(o => {
    if (o.type !== 'track') return [];
    const violations = validateTrack(o, objects);
    const issues = adaptSOD({ id: o.id, source: 'Track engineering rules', ranAt: '', assetsChecked: 1, checksRun: 0, checksPassed: 0, violations, counts: { V1: 0, V2: 0, total: violations.length }, passed: !violations.length }, objects);
    for (const type of ['track_geometry', 'asset_completeness']) {
      if (!issues.some(r => r.validationType === type)) issues.push({
        id: `${type}:${o.id}:passed`, ruleId: type === 'track_geometry' ? 'TRK-G' : 'TRK-P',
        ruleName: type === 'track_geometry' ? 'Track geometry checks' : 'Required track properties',
        validationType: type, status: 'passed', severity: 'info', trackId: o.id,
        trackName: o.track.displayName || o.name, assetIds: [o.id], assetType: 'Track',
        message: 'All applicable checks in this category passed.', source: 'Track engineering rules',
      });
    }
    return issues;
  });
}

export const validationRunners = [
  { id: 'gradient_continuity', run: runGradientValidation },
  { id: 'track_checks', run: runTrackValidations },
];
export const runAdditionalValidations = (objects: CanvasObject[]) => validationRunners.flatMap(runner => runner.run(objects));
