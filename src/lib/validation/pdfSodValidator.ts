import type { CanvasObject } from '../../types/scene';
import { runSODValidation, type SODCheckResult } from './sodValidator';

export interface PdfSodSource {
  fileName: string;
  sourceUrl: string;
  page?: number;
}

export function getPdfSodAnchors(objects: CanvasObject[], fileName: string): CanvasObject[] {
  return objects.filter(obj =>
    obj.sod?.sourceKind === 'pdf' &&
    obj.sod.sourceDrawingRef === fileName,
  );
}

export function runPdfSODValidation(
  objects: CanvasObject[],
  source: PdfSodSource,
): SODCheckResult {
  const page = source.page ?? 1;
  const anchors = getPdfSodAnchors(objects, source.fileName);

  return runSODValidation(anchors, 'pdf-underlay', {
    sourceKind: 'pdf',
    sourceFileName: source.fileName,
    sourceUrl: source.sourceUrl,
    sourcePage: page,
  });
}
