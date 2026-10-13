import type { CanvasObject, GradientValue, SodAssetMeta } from '../../types/scene';
import { runGradientValidation } from './gradientValidator';
import { adaptSOD, resultCount } from './validationModel';
import { runSODValidation } from './sodValidator';
import { POTHULAPADU_ASSETS, pothulapaduToCanvasObjects } from '../../data/pothulapaduAssets';

const rising = (denominator: number): GradientValue => ({ direction: 'rising', denominator });
const falling = (denominator: number): GradientValue => ({ direction: 'falling', denominator });
function point(id: string, chainage: number, patch: Partial<SodAssetMeta> = {}): CanvasObject {
  return { id, name: id, type: 'symbol', symbolId: 'gradient-post', label: id, x: chainage, y: 0, width: 10, height: 10, rotation: 0, scale: 100, visible: true, locked: false, layerId: 'gradients',
    sod: { assetKind: 'Gradient', trackId: 'up', chainage, leftGradient: rising(150), rightGradient: rising(150), ...patch } };
}

test('sorts by chainage within a track, compares engineering values and keeps endpoint N/A', () => {
  const results = runGradientValidation([point('C', 30), point('B', 20, { leftGradient: rising(320) }), point('A', 10), point('other', 15, { trackId: 'down' })]);
  expect(results.find(r => r.assetIds?.join(',') === 'A,B')).toMatchObject({ status: 'failed', severity: 'major', expectedValue: 'rising 1 in 150', actualValue: 'rising 1 in 320' });
  expect(results.find(r => r.assetIds?.join(',') === 'B,C')?.status).toBe('passed');
  expect(results.filter(r => r.status === 'not_applicable')).toHaveLength(2);
  expect(results.some(r => r.assetIds?.includes('other') && r.assetIds.length > 1)).toBe(false);
});

test('equal denominators with opposite directions fail; level matches level', () => {
  expect(runGradientValidation([point('A', 0), point('B', 1, { leftGradient: falling(150) })])[0].status).toBe('failed');
  expect(runGradientValidation([point('A', 0, { rightGradient: { direction: 'level' } }), point('B', 1, { leftGradient: { direction: 'level' } })])[0].status).toBe('passed');
});

test.each([undefined, rising(0), rising(-10), rising(NaN), rising(Infinity)])('missing or invalid incoming gradient needs review: %p', incoming => {
  expect(runGradientValidation([point('A', 0), point('B', 1, { leftGradient: incoming })])[0].status).toBe('needs_review');
});

test('duplicates and branches never produce a guessed pass', () => {
  const duplicate = runGradientValidation([point('A', 0), point('B', 0), point('C', 10)]);
  expect(duplicate.filter(r => r.assetIds?.includes('A') || r.assetIds?.includes('B')).every(r => r.status === 'needs_review')).toBe(true);
  expect(runGradientValidation([point('A', 0, { nextGradientPointIds: ['B', 'C'] }), point('B', 1)])[0].status).toBe('needs_review');
  expect(runGradientValidation([point('A', 0, { nextGradientPointIds: ['other-track'] }), point('B', 1)])[0].status).toBe('needs_review');
});

test('missing identity and nonfinite chainage are review issues; empty layout stays empty', () => {
  expect(runGradientValidation([point('A', 0, { trackId: undefined }), point('B', Infinity)]).every(r => r.status === 'needs_review')).toBe(true);
  expect(runGradientValidation([])).toEqual([]);
});

test('legacy gradient segments require review rather than fabricated left/right values', () => {
  const legacy = point('legacy', 0, { chainage: undefined, trackId: undefined, leftGradient: undefined, rightGradient: undefined, gradientDenominator: 400 });
  expect(runGradientValidation([legacy])[0]).toMatchObject({ status: 'needs_review', assetIds: ['legacy'] });
});

test('SOD adapter preserves every existing violation and individually identified passes', () => {
  const objects = pothulapaduToCanvasObjects(POTHULAPADU_ASSETS);
  const sod = runSODValidation(objects);
  const results = adaptSOD(sod, objects);
  expect(results).toHaveLength(14);
  expect(results.filter(r => r.status === 'passed')).toHaveLength(8);
  expect(results.filter(r => r.status === 'failed')).toHaveLength(4);
  expect(results.filter(r => r.status === 'warning')).toHaveLength(2);
  expect(results.filter(r => r.status !== 'passed').map(r => r.id)).toEqual(sod.violations.map(v => v.id));
  const legacy = adaptSOD({ ...sod, evaluations: undefined }, objects);
  expect(legacy.reduce((n, r) => n + resultCount(r), 0)).toBe(14);
});

test('correcting SOD data preserves rule identity when failed becomes passed', () => {
  const before = point('gradient', 10, { gradientDenominator: 150 });
  const after = { ...before, sod: { ...before.sod!, gradientDenominator: 500 } };
  const failure = adaptSOD(runSODValidation([before]), [before]).find(r => r.ruleId === 'SOD-II-02')!;
  const pass = adaptSOD(runSODValidation([after]), [after]).find(r => r.ruleId === 'SOD-II-02')!;
  expect(pass.status).toBe('passed'); expect(pass.id).toBe(failure.id);
});

test('new gradient-post symbols without engineering metadata surface a review issue', () => {
  const obj = point('new-post', 0);
  delete obj.sod;
  expect(runGradientValidation([obj])[0]).toMatchObject({ status: 'needs_review', assetIds: ['new-post'] });
});
