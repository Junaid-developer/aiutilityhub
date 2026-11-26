import { degrees, PDFDocument } from 'pdf-lib';

export type PdfOperationId = 'merge' | 'split' | 'rotate' | 'extract' | 'delete';
export type RotationAngle = 90 | 180 | 270;

export const MAX_PDF_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
export const MAX_PDF_MERGE_TOTAL_BYTES = 120 * 1024 * 1024; // 120 MB combined queue cap
export const MAX_PDF_MERGE_FILES = 25;
export const MAX_THUMBNAIL_PREVIEW_PAGES = 24;

export interface ParsedPageRange {
  start: number;
  end: number;
  label: string;
}

export interface PdfOutputResult {
  bytes: Uint8Array;
  pageCount: number;
  filename: string;
}

export interface SplitPdfOutputItem extends PdfOutputResult {
  rangeLabel: string;
}

export function formatPdfFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export type PdfFileValidation =
  | { ok: true }
  | { ok: false; error: string };

export function validatePdfFileMeta(file: {
  name: string;
  type: string;
  size: number;
}): PdfFileValidation {
  const mime = file.type.toLowerCase().trim();
  const isPdfMime = mime === 'application/pdf' || mime === 'application/x-pdf';
  const hasPdfExt = file.name.toLowerCase().trim().endsWith('.pdf');

  if (!isPdfMime && !(hasPdfExt && (!mime || mime === 'application/octet-stream'))) {
    return {
      ok: false,
      error: `Unsupported file "${file.name}". Please upload valid PDF (.pdf) files only.`,
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      error: `The file "${file.name}" appears to be empty.`,
    };
  }

  if (file.size > MAX_PDF_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `"${file.name}" exceeds the ${formatPdfFileSize(
        MAX_PDF_FILE_SIZE_BYTES
      )} per-file limit.`,
    };
  }

  return { ok: true };
}

export async function inspectPdfBytes(
  bytes: Uint8Array
): Promise<{ ok: true; pageCount: number } | { ok: false; error: string }> {
  if (!bytes || bytes.length === 0) {
    return { ok: false, error: 'The uploaded PDF file is empty.' };
  }

  try {
    const doc = await PDFDocument.load(bytes, { ignoreEncryption: false });
    const pageCount = doc.getPageCount();
    if (pageCount <= 0) {
      return { ok: false, error: 'The uploaded PDF contains zero pages.' };
    }
    return { ok: true, pageCount };
  } catch (err) {
    const msg = err instanceof Error ? err.message.toLowerCase() : '';
    if (msg.includes('encrypt')) {
      return {
        ok: false,
        error:
          'This PDF is password-protected or encrypted. Please remove password protection before uploading.',
      };
    }
    return {
      ok: false,
      error:
        'Unable to read this file. Please ensure it is a valid, uncorrupted PDF document.',
    };
  }
}

export function parsePageRangesInput(
  raw: string,
  totalPages: number
):
  | { ok: true; ranges: ParsedPageRange[] }
  | { ok: false; error: string } {
  const cleaned = raw.trim();
  if (!cleaned) {
    return {
      ok: false,
      error: 'Please enter at least one page or range (for example, 1-3, 5-7).',
    };
  }

  const tokens = cleaned
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (tokens.length === 0) {
    return {
      ok: false,
      error: 'Please enter valid page ranges (for example, 1-3, 5-7).',
    };
  }

  const ranges: ParsedPageRange[] = [];

  for (const token of tokens) {
    if (/^\d+$/.test(token)) {
      const page = Number(token);
      if (page < 1 || page > totalPages) {
        return {
          ok: false,
          error: `Page ${page} is out of bounds. This PDF has ${totalPages} page${
            totalPages === 1 ? '' : 's'
          }.`,
        };
      }
      ranges.push({ start: page, end: page, label: String(page) });
      continue;
    }

    const match = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) {
      return {
        ok: false,
        error: `Invalid range "${token}". Use formats like "1-3" or "5".`,
      };
    }

    const start = Number(match[1]);
    const end = Number(match[2]);

    if (start < 1 || end < 1 || start > totalPages || end > totalPages) {
      return {
        ok: false,
        error: `Range "${token}" is out of bounds for a ${totalPages}-page PDF.`,
      };
    }

    if (start > end) {
      return {
        ok: false,
        error: `Range "${token}" is invalid because the start page is greater than the end page.`,
      };
    }

    ranges.push({
      start,
      end,
      label: start === end ? String(start) : `${start}-${end}`,
    });
  }

  return { ok: true, ranges };
}

export function parsePageSelectionInput(
  raw: string,
  totalPages: number
): { ok: true; pages: number[] } | { ok: false; error: string } {
  const rangeResult = parsePageRangesInput(raw, totalPages);
  if (!rangeResult.ok) return rangeResult;

  const pageSet = new Set<number>();
  for (const range of rangeResult.ranges) {
    for (let p = range.start; p <= range.end; p += 1) {
      pageSet.add(p);
    }
  }

  const pages = Array.from(pageSet).sort((a, b) => a - b);
  return { ok: true, pages };
}

export function formatPagesSummary(pages: number[]): string {
  if (pages.length === 0) return 'None';
  const sorted = [...pages].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i += 1) {
    const curr = sorted[i];
    if (curr === prev + 1) {
      prev = curr;
    } else {
      parts.push(start === prev ? String(start) : `${start}-${prev}`);
      start = curr;
      prev = curr;
    }
  }
  parts.push(start === prev ? String(start) : `${start}-${prev}`);
  return parts.join(', ');
}

export async function mergePdfDocuments(
  docs: Array<{ name: string; bytes: Uint8Array }>
): Promise<PdfOutputResult> {
  if (docs.length < 2) {
    throw new Error('Please upload at least two PDF files to merge.');
  }

  if (docs.length > MAX_PDF_MERGE_FILES) {
    throw new Error(
      `You can merge up to ${MAX_PDF_MERGE_FILES} PDF files at once to stay within safe browser memory limits.`
    );
  }

  const totalBytes = docs.reduce((sum, item) => sum + item.bytes.byteLength, 0);
  if (totalBytes > MAX_PDF_MERGE_TOTAL_BYTES) {
    throw new Error(
      `Combined PDF size (${formatPdfFileSize(
        totalBytes
      )}) exceeds the ${formatPdfFileSize(
        MAX_PDF_MERGE_TOTAL_BYTES
      )} browser merge limit. Remove some files or merge in smaller batches.`
    );
  }

  const merged = await PDFDocument.create();

  for (const item of docs) {
    const src = await PDFDocument.load(item.bytes, { ignoreEncryption: false });
    const indices = src.getPageIndices();
    const copiedPages = await merged.copyPages(src, indices);
    for (const page of copiedPages) {
      merged.addPage(page);
    }
  }

  const outBytes = await merged.save();
  return {
    bytes: outBytes,
    pageCount: merged.getPageCount(),
    filename: 'merged-document.pdf',
  };
}

export async function splitPdfByRanges(
  sourceBytes: Uint8Array,
  rangesInput: string
): Promise<SplitPdfOutputItem[]> {
  const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  const totalPages = src.getPageCount();
  const parsed = parsePageRangesInput(rangesInput, totalPages);

  if (!parsed.ok) {
    throw new Error(parsed.error);
  }

  const outputs: SplitPdfOutputItem[] = [];

  for (const range of parsed.ranges) {
    const partDoc = await PDFDocument.create();
    const indices: number[] = [];
    for (let p = range.start; p <= range.end; p += 1) {
      indices.push(p - 1);
    }
    const copied = await partDoc.copyPages(src, indices);
    for (const page of copied) {
      partDoc.addPage(page);
    }
    const partBytes = await partDoc.save();
    outputs.push({
      bytes: partBytes,
      pageCount: partDoc.getPageCount(),
      rangeLabel: range.label,
      filename: `split-pages-${range.label}.pdf`,
    });
  }

  return outputs;
}

export async function rotatePdfPages(
  sourceBytes: Uint8Array,
  targetPages: number[] | 'all',
  angleDelta: RotationAngle
): Promise<PdfOutputResult & { rotatedCount: number }> {
  const doc = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  const totalPages = doc.getPageCount();

  const pageNumbers =
    targetPages === 'all'
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : Array.from(new Set(targetPages)).filter(
          (p) => p >= 1 && p <= totalPages
        );

  if (pageNumbers.length === 0) {
    throw new Error('Please select at least one page to rotate.');
  }

  for (const pageNum of pageNumbers) {
    const page = doc.getPage(pageNum - 1);
    const current = page.getRotation().angle;
    const nextAngle = (((current + angleDelta) % 360) + 360) % 360;
    page.setRotation(degrees(nextAngle));
  }

  const outBytes = await doc.save();
  return {
    bytes: outBytes,
    pageCount: doc.getPageCount(),
    rotatedCount: pageNumbers.length,
    filename: 'rotated-document.pdf',
  };
}

export async function extractPdfPages(
  sourceBytes: Uint8Array,
  selectedPages: number[]
): Promise<PdfOutputResult> {
  const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  const totalPages = src.getPageCount();

  const cleanPages = Array.from(new Set(selectedPages))
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  if (cleanPages.length === 0) {
    throw new Error('Please select at least one valid page to extract.');
  }

  const extracted = await PDFDocument.create();
  const indices = cleanPages.map((p) => p - 1);
  const copied = await extracted.copyPages(src, indices);
  for (const page of copied) {
    extracted.addPage(page);
  }

  const outBytes = await extracted.save();
  return {
    bytes: outBytes,
    pageCount: extracted.getPageCount(),
    filename: 'extracted-pages.pdf',
  };
}

export async function deletePdfPages(
  sourceBytes: Uint8Array,
  pagesToDelete: number[]
): Promise<PdfOutputResult & { deletedCount: number }> {
  const src = await PDFDocument.load(sourceBytes, { ignoreEncryption: false });
  const totalPages = src.getPageCount();

  const deleteSet = new Set(
    pagesToDelete.filter((p) => p >= 1 && p <= totalPages)
  );

  if (deleteSet.size === 0) {
    throw new Error('Please select at least one page to delete.');
  }

  if (deleteSet.size >= totalPages) {
    throw new Error(
      'You cannot delete all pages from the document. At least one page must remain.'
    );
  }

  const keepIndices: number[] = [];
  for (let i = 0; i < totalPages; i += 1) {
    if (!deleteSet.has(i + 1)) {
      keepIndices.push(i);
    }
  }

  const edited = await PDFDocument.create();
  const copied = await edited.copyPages(src, keepIndices);
  for (const page of copied) {
    edited.addPage(page);
  }

  const outBytes = await edited.save();
  return {
    bytes: outBytes,
    pageCount: edited.getPageCount(),
    deletedCount: deleteSet.size,
    filename: 'edited-document.pdf',
  };
}

export function createPdfObjectUrl(bytes: Uint8Array): {
  objectUrl: string;
  size: number;
} {
  const blob = new Blob([bytes.slice().buffer], { type: 'application/pdf' });
  return {
    objectUrl: URL.createObjectURL(blob),
    size: blob.size,
  };
}
