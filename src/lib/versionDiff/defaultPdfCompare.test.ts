import {
  DEFAULT_PDF_COMPARE_BASE_ID,
  DEFAULT_PDF_COMPARE_HEAD_ID,
  DEFAULT_PDF_COMPARE_VERSIONS,
} from '../../data/pothulapaduCompareVersions';
import { computeVersionDiff } from './computeDiff';

test('default Pothulapadu PDF compare examples produce visible changes', () => {
  const base = DEFAULT_PDF_COMPARE_VERSIONS.find(v => v.id === DEFAULT_PDF_COMPARE_BASE_ID)!;
  const head = DEFAULT_PDF_COMPARE_VERSIONS.find(v => v.id === DEFAULT_PDF_COMPARE_HEAD_ID)!;

  const diff = computeVersionDiff(base.objects, head.objects, base.label, head.label);

  expect(diff.added).toBe(1);
  expect(diff.removed).toBe(1);
  expect(diff.moved).toBe(1);
  expect(diff.modified).toBe(2);
  expect(diff.changes.filter(c => c.changeType !== 'unchanged')).toHaveLength(5);
});
