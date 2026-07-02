import { POTHULAPADU_ASSETS, pothulapaduToCanvasObjects } from '../../data/pothulapaduAssets';
import type { CanvasObject } from '../../types/scene';
import { runPdfSODValidation } from './pdfSodValidator';

const SOURCE_FILE = 'POTHULAPADU_ESP-Model.pdf';

function makePdfAnchors(): CanvasObject[] {
  return pothulapaduToCanvasObjects(POTHULAPADU_ASSETS)
    .filter(obj => obj.sod)
    .map(obj => ({
      ...obj,
      visible: false,
      locked: true,
      sod: {
        ...obj.sod!,
        sourceKind: 'pdf',
        sourceDrawingRef: SOURCE_FILE,
        sourcePage: 1,
      },
    } as CanvasObject));
}

test('PDF SOD validation runs only PDF-linked anchors', () => {
  const unrelatedText: CanvasObject = {
    id: 'unrelated-empty-label',
    type: 'text',
    name: 'Unrelated empty label',
    layerId: 'annotation',
    locked: false,
    visible: true,
    x: 0,
    y: 0,
    width: 20,
    height: 10,
    rotation: 0,
    scale: 100,
    anchor: 'Top left',
    value: '',
    textColor: '#111827',
    fontSize: '12px',
    fontFamily: 'Inter, sans-serif',
    fontStyle: 'Regular',
    bold: false,
    italic: false,
    underline: false,
    alignment: 'left',
    baseline: 'top',
  };

  const result = runPdfSODValidation([...makePdfAnchors(), unrelatedText], {
    fileName: SOURCE_FILE,
    sourceUrl: '/assets/POTHULAPADU_ESP-Model.pdf',
    page: 1,
  });

  expect(result.sourceKind).toBe('pdf');
  expect(result.sourceFileName).toBe(SOURCE_FILE);
  expect(result.sourcePage).toBe(1);
  expect(result.assetsChecked).toBe(12);
  expect(result.counts).toEqual({ V1: 4, V2: 2, total: 6 });
  expect(result.violations.some(v => v.assetId === unrelatedText.id)).toBe(false);
});
