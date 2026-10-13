import type { CanvasObject, GradientValue } from '../../types/scene';
import type { ValidationResult } from './validationModel';

export function formatGradient(g?: GradientValue): string {
  if (!g) return 'Missing';
  return g.direction === 'level' ? 'Level' : `${g.direction} 1 in ${g.denominator ?? '?'}`;
}
function slope(g?: GradientValue): number | null {
  if (!g || !['level', 'rising', 'falling'].includes(g.direction)) return null;
  if (g.direction === 'level') return 0;
  if (!g.denominator || !Number.isFinite(g.denominator) || g.denominator <= 0) return null;
  return (g.direction === 'rising' ? 1 : -1) / g.denominator;
}

/** Chainage is metres; left/right are defined along increasing chainage.
 * Never infer track membership or gradient direction from drawing positions. */
export function runGradientValidation(objects: CanvasObject[]): ValidationResult[] {
  const points = objects.filter(o => o.sod?.assetKind === 'Gradient' || (o.type === 'symbol' && o.symbolId === 'gradient-post')).map(o => o.sod ? o : { ...o, sod: { assetKind: 'Gradient' as const } });
  const results: ValidationResult[] = [];
  const tracks = new Map<string, CanvasObject[]>();
  const make = (from: CanvasObject, to?: CanvasObject): ValidationResult => ({
    id: `gc:${from.id}:${to?.id ?? 'endpoint'}`, ruleId: 'GC-001', ruleName: 'Gradient Continuity Across Track',
    validationType: 'gradient_continuity', status: 'not_applicable', severity: 'info',
    trackId: from.sod?.trackId, trackName: from.sod?.trackName ?? from.sod?.trackId,
    assetIds: to ? [from.id, to.id] : [from.id], assetType: 'Gradient',
    startChainage: from.sod?.chainage, endChainage: to?.sod?.chainage,
    expectedValue: formatGradient(from.sod?.rightGradient), actualValue: formatGradient(to?.sod?.leftGradient),
    suggestedAction: 'Verify the gradient values in the ESP and ensure continuity between consecutive gradient points.',
    metadata: { fromGradientPointId: from.id, toGradientPointId: to?.id,
      fromChainage: from.sod?.chainage, toChainage: to?.sod?.chainage,
      outgoingGradient: from.sod?.rightGradient, incomingGradient: to?.sod?.leftGradient },
  });
  for (const point of points) {
    const m = point.sod!;
    if (!m.trackId || m.chainage == null || !Number.isFinite(m.chainage)) {
      results.push({ ...make(point), status: 'needs_review', severity: 'major', message: 'Track identity or chainage is missing or invalid.' });
    } else {
      const group = tracks.get(m.trackId) ?? []; group.push(point); tracks.set(m.trackId, group);
    }
  }
  for (const group of tracks.values()) {
    group.sort((a, b) => a.sod!.chainage! - b.sod!.chainage! || a.id.localeCompare(b.id));
    const duplicates = new Set(group.filter((p, i) => (i > 0 && group[i - 1].sod!.chainage === p.sod!.chainage) || (i + 1 < group.length && group[i + 1].sod!.chainage === p.sod!.chainage)).map(p => p.sod!.chainage));
    group.forEach((from, i) => {
      const to = group[i + 1];
      const r = make(from, to);
      if (duplicates.has(from.sod!.chainage) || (to && duplicates.has(to.sod!.chainage)) || (from.sod!.nextGradientPointIds?.length ?? 0) > 1) {
        r.status = 'needs_review'; r.severity = 'major'; r.message = 'Duplicate chainage or branching track makes the next gradient point ambiguous.';
      } else if (!to) {
        r.message = 'No next gradient point on this track; no continuity comparison applies.';
      } else if (from.sod!.nextGradientPointIds?.length && from.sod!.nextGradientPointIds[0] !== to.id) {
        r.status = 'needs_review'; r.severity = 'major'; r.message = 'Track topology disagrees with chainage order; verify the next point.';
      } else {
        const outgoing = slope(from.sod!.rightGradient), incoming = slope(to.sod!.leftGradient);
        r.status = outgoing == null || incoming == null ? 'needs_review' : outgoing === incoming ? 'passed' : 'failed';
        r.severity = r.status === 'passed' ? 'info' : 'major';
        r.message = r.status === 'needs_review' ? 'Missing gradient value or invalid denominator; verify both sides.' :
          r.status === 'passed' ? 'Consecutive gradients match.' : `The gradient on the right side of ${from.name} does not match the gradient on the left side of ${to.name}.`;
        r.metadata!.difference = outgoing == null || incoming == null ? undefined : outgoing - incoming;
      }
      results.push(r);
    });
  }
  return results;
}
