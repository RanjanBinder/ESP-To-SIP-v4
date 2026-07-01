import { runSODValidation } from './sodValidator';
import { POTHULAPADU_ASSETS, pothulapaduToCanvasObjects } from '../../data/pothulapaduAssets';

test('Pothulapadu ESP produces exactly the documented SOD violations', () => {
  const objects = pothulapaduToCanvasObjects(POTHULAPADU_ASSETS);
  const result = runSODValidation(objects, 'existing-esp');

  // 2 critical (V2) + 4 major (V1)
  expect(result.counts.V2).toBe(2);
  expect(result.counts.V1).toBe(4);
  expect(result.counts.total).toBe(6);

  // 12 SOD-annotated assets; 14 rule evaluations, 8 passed
  expect(result.assetsChecked).toBe(12);
  expect(result.checksRun).toBe(14);
  expect(result.checksPassed).toBe(8);

  const codes = result.violations.map(v => `${v.ruleCode}:${v.assetId}`).sort();
  expect(codes).toEqual([
    'SOD-I-01:TRK-03',
    'SOD-I-07:STR-01',
    'SOD-II-02:GRD-01',
    'SOD-II-03:PLT-01',
    'SOD-II-04:PLT-02',
    'SOD-II-10:STR-02',
  ]);
});
