import type { CanvasObject } from '../../types/scene';
import type { SODCheckResult } from './sodValidator';

export type ValidationStatus = 'passed' | 'failed' | 'warning' | 'needs_review' | 'not_applicable' | 'not_run';
export type ValidationSeverity = 'critical' | 'major' | 'minor' | 'info';
export interface ValidationResult {
  id: string; ruleId: string; ruleName: string; validationType: string; status: ValidationStatus;
  severity?: ValidationSeverity; message?: string; suggestedAction?: string;
  trackId?: string; trackName?: string; assetIds?: string[]; assetType?: string;
  chainage?: number; startChainage?: number; endChainage?: number;
  expectedValue?: unknown; actualValue?: unknown; source?: string; metadata?: Record<string, unknown>;
}
export const validationStatuses: Record<ValidationStatus, { label: string; color: string; icon: string }> = {
  passed: { label: 'Passed', color: '#15803d', icon: '✓' },
  failed: { label: 'Failed', color: '#b91c1c', icon: '✕' },
  warning: { label: 'Warning', color: '#b45309', icon: '⚠' },
  needs_review: { label: 'Needs Review', color: '#6366f1', icon: '?' },
  not_applicable: { label: 'N/A', color: '#6b7280', icon: '−' },
  not_run: { label: 'Not Run', color: '#6b7280', icon: '○' },
};
export const validationCategories = [
  { id: 'sod', label: 'SOD', name: 'SOD Rules', icon: '◇' },
  { id: 'sip_checklist', label: 'SIP Checklist', name: 'SIP Checklist', icon: '☑' },
  { id: 'gradient_continuity', label: 'Gradient', name: 'Gradient Continuity', icon: '↗' },
  { id: 'track_geometry', label: 'Track Geometry', name: 'Track Geometry', icon: '⌁' },
  { id: 'asset_completeness', label: 'Asset Completeness', name: 'Asset Completeness', icon: '□' },
];

/** Legacy PDF/canvas SOD checks share this single adapter. Aggregate passes are
 * explicitly marked, since older saved results do not identify passing assets. */
export function adaptSOD(result: SODCheckResult | null, objects: CanvasObject[]): ValidationResult[] {
  if (!result) return [];
  const assets = new Map(objects.map(o => [o.id, o]));
  const issues: ValidationResult[] = result.violations.map(v => {
    const asset = v.assetId ? assets.get(v.assetId) : undefined;
    return {
      id: v.id, ruleId: v.ruleCode ?? v.ruleId, ruleName: v.title, validationType: v.ruleId === 'track-missing-property' ? 'asset_completeness' : v.ruleCode?.startsWith('TRK-') ? 'track_geometry' : 'sod',
      status: v.severity === 'V1' ? 'failed' : 'warning', severity: v.severity === 'V1' ? 'critical' : 'minor',
      message: v.detail, assetIds: v.assetId ? [v.assetId] : [], assetType: asset?.sod?.assetKind ?? asset?.type,
      trackId: asset?.type === 'track' ? asset.id : asset?.sod?.trackId, trackName: asset?.type === 'track' ? asset.track.displayName || asset.name : asset?.sod?.trackName, chainage: asset?.sod?.chainage,
      expectedValue: v.required, actualValue: v.measured, source: result.sourceFileName ?? result.source,
      suggestedAction: 'Verify the source measurements, correct the asset properties and rerun validation.',
      metadata: { assetName: v.assetName, canvasX: v.canvasX, canvasY: v.canvasY, canvasW: v.canvasW, canvasH: v.canvasH, unit: v.unit },
    };
  });
  if (result.evaluations) issues.push(...result.evaluations.filter(e => e.status === 'passed'));
  else if (result.checksPassed > 0) issues.push({ id: 'sod-legacy-passes', ruleId: 'SOD', ruleName: `${result.checksPassed} passed checks (legacy summary)`, validationType: 'sod', status: 'passed', metadata: { count: result.checksPassed } });
  return issues;
}

export const resultCount = (r: ValidationResult) => typeof r.metadata?.count === 'number' ? r.metadata.count : 1;
export const displayValue = (v: unknown): string => v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
