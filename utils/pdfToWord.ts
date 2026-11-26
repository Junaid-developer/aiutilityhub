import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { formatPdfFileSize, inspectPdfBytes, validatePdfFileMeta } from './pdfTools';

export type PdfToWordLayoutMode = 'preserve' | 'flowing';

export interface PdfToWordOptions {
  layoutMode: PdfToWordLayoutMode;
  detectHeadings: boolean;
  reconstructTables: boolean;
  includePageBreaks: boolean;
}

export interface PdfToWordResult {
  docxBytes: Uint8Array;
  filename: string;
  pageCount: number;
  textPageCount: number;
  scannedPageNumbers: number[];
  warnings: string[];
  previewText: string;
  stats: {
    headings: number;
    paragraphs: number;
    lists: number;
    tables: number;
    words: number;
  };
}

export class ScannedPdfError extends Error {
  public readonly pageCount: number;

  constructor(pageCount: number) {
    super(
      `This ${pageCount}-page PDF appears to contain scanned images without selectable text. Optical Character Recognition (OCR) is required to extract editable text from scanned documents.`
    );
    this.name = 'ScannedPdfError';
    this.pageCount = pageCount;
  }
}

export function buildDocxFilenameFromPdf(originalName: string): string {
  const trimmed = originalName.trim();
  if (!trimmed) return 'converted-document.docx';
  if (/\.pdf$/i.test(trimmed)) {
    return trimmed.replace(/\.pdf$/i, '.docx');
  }
  const stripped = trimmed.replace(/\.[^.]+$/, '');
  return `${stripped || 'converted-document'}.docx`;
}

export async function validateAndInspectPdfForWord(file: {
  name: string;
  type: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}): Promise<
  | { ok: true; bytes: Uint8Array; pageCount: number; sizeLabel: string }
  | { ok: false; error: string }
> {
  const metaCheck = validatePdfFileMeta(file);
  if (!metaCheck.ok) {
    return metaCheck;
  }

  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const inspection = await inspectPdfBytes(bytes);
  if (!inspection.ok) {
    return inspection;
  }

  return {
    ok: true,
    bytes,
    pageCount: inspection.pageCount,
    sizeLabel: formatPdfFileSize(file.size),
  };
}

// --- PDF.js Page Geometry & Text Extraction Types ---

interface RawTextItem {
  str: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
  bold: boolean;
  italic: boolean;
}

interface VisualLine {
  y: number;
  avgFontSize: number;
  items: RawTextItem[];
  cells: Array<{ xStart: number; xEnd: number; items: RawTextItem[]; text: string }>;
  fullText: string;
  isBold: boolean;
  isItalic: boolean;
}

export interface PdfPageLike {
  getTextContent: () => Promise<{
    items: Array<Record<string, unknown>>;
    styles?: Record<string, { fontFamily?: string }>;
  }>;
  cleanup?: () => void;
}

export interface PdfDocumentLike {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageLike>;
}

export type PdfDocumentLoader = (bytes: Uint8Array) => Promise<{
  doc: PdfDocumentLike;
  cleanup: () => Promise<void> | void;
}>;

async function defaultNodeOrDynamicPdfLoader(bytes: Uint8Array) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const loadingTask = pdfjs.getDocument({
    data: bytes.slice(),
    verbosity: 0,
  });
  const doc = (await loadingTask.promise) as unknown as PdfDocumentLike;
  return {
    doc,
    cleanup: () => loadingTask.destroy(),
  };
}

function inferFontFlags(
  fontName: string,
  styles: Record<string, { fontFamily?: string }> | undefined
): { bold: boolean; italic: boolean } {
  const styleFamily = (styles?.[fontName]?.fontFamily ?? '').toLowerCase();
  const combined = `${fontName.toLowerCase()} ${styleFamily}`;
  const bold =
    /bold|black|heavy|semibold|demibold|\b700\b|\b800\b|\b900\b/.test(
      combined
    );
  const italic = /italic|oblique|slant/.test(combined);
  return { bold, italic };
}

function normalizeExtractedText(str: string): string {
  return str
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\uFFFE\uFFFF]/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ');
}

function groupItemsIntoLines(items: RawTextItem[]): VisualLine[] {
  if (items.length === 0) return [];

  const sorted = [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > Math.max(2.5, Math.min(a.fontSize, b.fontSize) * 0.35)) {
      return yDiff;
    }
    return a.x - b.x;
  });

  const lineGroups: RawTextItem[][] = [];
  for (const item of sorted) {
    const lastGroup = lineGroups[lineGroups.length - 1];
    if (!lastGroup) {
      lineGroups.push([item]);
      continue;
    }
    const refY = lastGroup[0].y;
    const tol = Math.max(2.5, lastGroup[0].fontSize * 0.38);
    if (Math.abs(item.y - refY) <= tol) {
      lastGroup.push(item);
    } else {
      lineGroups.push([item]);
    }
  }

  return lineGroups.map((group) => {
    group.sort((a, b) => a.x - b.x);
    const avgFontSize =
      group.reduce((s, it) => s + it.fontSize, 0) / Math.max(1, group.length);

    // Split a single visual line into cell clusters separated by large horizontal gaps
    const colGapThreshold = Math.max(24, avgFontSize * 2.2);
    const cellClusters: RawTextItem[][] = [];

    for (const it of group) {
      const currCluster = cellClusters[cellClusters.length - 1];
      if (!currCluster) {
        cellClusters.push([it]);
        continue;
      }
      const prev = currCluster[currCluster.length - 1];
      const prevEnd = prev.x + prev.width;
      const gap = it.x - prevEnd;
      if (gap > colGapThreshold) {
        cellClusters.push([it]);
      } else {
        currCluster.push(it);
      }
    }

    const joinItems = (arr: RawTextItem[]): string => {
      let out = '';
      for (let i = 0; i < arr.length; i += 1) {
        const cur = arr[i];
        if (i > 0) {
          const prev = arr[i - 1];
          const prevEnd = prev.x + prev.width;
          const gap = cur.x - prevEnd;
          if (
            gap > Math.max(1.2, cur.fontSize * 0.14) &&
            !out.endsWith(' ') &&
            !cur.str.startsWith(' ')
          ) {
            out += ' ';
          }
        }
        out += cur.str;
      }
      return normalizeExtractedText(out).trim();
    };

    const cells = cellClusters
      .map((cluster) => ({
        xStart: cluster[0].x,
        xEnd:
          cluster[cluster.length - 1].x + cluster[cluster.length - 1].width,
        items: cluster,
        text: joinItems(cluster),
      }))
      .filter((c) => c.text.length > 0);

    const fullText = cells.map((c) => c.text).join('   ').trim();
    const totalChars = group.reduce((s, it) => s + it.str.trim().length, 0);
    const boldChars = group.reduce(
      (s, it) => s + (it.bold ? it.str.trim().length : 0),
      0
    );
    const italicChars = group.reduce(
      (s, it) => s + (it.italic ? it.str.trim().length : 0),
      0
    );

    return {
      y: group[0].y,
      avgFontSize,
      items: group,
      cells,
      fullText,
      isBold: totalChars > 0 && boldChars / totalChars >= 0.7,
      isItalic: totalChars > 0 && italicChars / totalChars >= 0.7,
    };
  });
}

function buildTableBlock(
  tableLines: VisualLine[],
  bodyFontSize: number
): Table | null {
  if (tableLines.length < 2) return null;

  // Determine canonical column x-anchors across all rows in this table block
  const anchors: number[] = [];
  for (const line of tableLines) {
    for (const cell of line.cells) {
      const matched = anchors.some((a) => Math.abs(a - cell.xStart) <= 28);
      if (!matched) {
        anchors.push(cell.xStart);
      }
    }
  }
  anchors.sort((a, b) => a - b);

  if (anchors.length < 2 || anchors.length > 10) {
    return null;
  }

  const rows: TableRow[] = tableLines.map((line, rowIdx) => {
    const colTexts = new Array<string>(anchors.length).fill('');

    for (const cell of line.cells) {
      let bestCol = 0;
      let bestDist = Infinity;
      for (let c = 0; c < anchors.length; c += 1) {
        const dist = Math.abs(anchors[c] - cell.xStart);
        if (dist < bestDist) {
          bestDist = dist;
          bestCol = c;
        }
      }
      colTexts[bestCol] = colTexts[bestCol]
        ? `${colTexts[bestCol]} ${cell.text}`
        : cell.text;
    }

    const isHeaderRow = rowIdx === 0 && (line.isBold || tableLines.length >= 2);
    return new TableRow({
      tableHeader: rowIdx === 0,
      children: colTexts.map(
        (txt) =>
          new TableCell({
            shading: isHeaderRow ? { fill: 'E3EAE4' } : undefined,
            margins: {
              top: 90,
              bottom: 90,
              left: 120,
              right: 120,
            },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: 'DCDDD3' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DCDDD3' },
              left: { style: BorderStyle.SINGLE, size: 4, color: 'DCDDD3' },
              right: { style: BorderStyle.SINGLE, size: 4, color: 'DCDDD3' },
            },
            children: [
              new Paragraph({
                spacing: { before: 0, after: 0, line: 260 },
                children: [
                  new TextRun({
                    text: txt || ' ',
                    bold: isHeaderRow,
                    size: Math.max(18, Math.round(bodyFontSize * 1.9)),
                    font: 'Calibri',
                    color: '252B28',
                  }),
                ],
              }),
            ],
          })
      ),
    });
  });

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
  });
}

function classifyHeadingLevel(
  line: VisualLine,
  medianFontSize: number,
  detectHeadings: boolean
): (typeof HeadingLevel)[keyof typeof HeadingLevel] | null {
  if (!detectHeadings) return null;
  const text = line.fullText.trim();
  if (!text || text.length > 120) return null;
  if (/^[•\-*]\s+/.test(text) || /^\d+[.)]\s+/.test(text)) return null;

  const ratio = line.avgFontSize / Math.max(medianFontSize, 1);
  if (ratio >= 1.42) return HeadingLevel.HEADING_1;
  if (ratio >= 1.18) return HeadingLevel.HEADING_2;
  if (line.isBold && text.length <= 75 && !/[.,;]$/.test(text)) {
    return HeadingLevel.HEADING_3;
  }
  return null;
}

function lineToTextRuns(line: VisualLine, targetHalfPoints: number, forceBold = false): TextRun[] {
  if (line.items.length === 0) return [];
  const runs: TextRun[] = [];
  let bufText = '';
  let bufBold = forceBold || line.items[0].bold;
  let bufItalic = line.items[0].italic;

  const flush = () => {
    const clean = normalizeExtractedText(bufText);
    if (clean) {
      runs.push(
        new TextRun({
          text: clean,
          bold: bufBold,
          italics: bufItalic,
          size: targetHalfPoints,
          font: 'Calibri',
          color: '252B28',
        })
      );
    }
    bufText = '';
  };

  for (let i = 0; i < line.items.length; i += 1) {
    const it = line.items[i];
    const itemBold = forceBold || it.bold;
    const itemItalic = it.italic;

    let prefix = '';
    if (i > 0) {
      const prev = line.items[i - 1];
      const gap = it.x - (prev.x + prev.width);
      if (
        gap > Math.max(1.2, it.fontSize * 0.14) &&
        !bufText.endsWith(' ') &&
        !it.str.startsWith(' ')
      ) {
        prefix = ' ';
      }
    }

    if (itemBold !== bufBold || itemItalic !== bufItalic) {
      if (prefix) bufText += prefix;
      flush();
      bufBold = itemBold;
      bufItalic = itemItalic;
      bufText = it.str;
    } else {
      bufText += prefix + it.str;
    }
  }
  flush();
  return runs;
}

export async function convertPdfToDocx(
  pdfBytes: Uint8Array,
  originalFilename: string,
  options: PdfToWordOptions,
  loader: PdfDocumentLoader = defaultNodeOrDynamicPdfLoader
): Promise<PdfToWordResult> {
  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error('The uploaded PDF file is empty.');
  }

  const inspection = await inspectPdfBytes(pdfBytes);
  if (!inspection.ok) {
    throw new Error(inspection.error);
  }

  const { doc: pdfDoc, cleanup } = await loader(pdfBytes);

  try {
    const pageCount = pdfDoc.numPages;
    const perPageLines: VisualLine[][] = [];
    const allBodySizes: number[] = [];
    const scannedPageNumbers: number[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum += 1) {
      const page = await pdfDoc.getPage(pageNum);
      const tc = await page.getTextContent();
      const styles = tc.styles;

      const rawItems: RawTextItem[] = [];
      for (const raw of tc.items) {
        const str = typeof raw.str === 'string' ? raw.str : '';
        if (!str || !str.trim()) continue;
        const transform = Array.isArray(raw.transform)
          ? (raw.transform as number[])
          : [12, 0, 0, 12, 0, 0];
        const fontSize =
          Math.hypot(transform[0] ?? 12, transform[1] ?? 0) ||
          (typeof raw.height === 'number' ? raw.height : 12) ||
          12;
        const x = Number(transform[4] ?? 0);
        const y = Number(transform[5] ?? 0);
        const width =
          typeof raw.width === 'number'
            ? raw.width
            : str.length * fontSize * 0.5;
        const fontName = typeof raw.fontName === 'string' ? raw.fontName : '';
        const { bold, italic } = inferFontFlags(fontName, styles);

        rawItems.push({
          str,
          x,
          y,
          width,
          fontSize,
          bold,
          italic,
        });
        allBodySizes.push(fontSize);
      }

      const lines = groupItemsIntoLines(rawItems);
      perPageLines.push(lines);

      const pageCharCount = lines.reduce(
        (sum, line) => sum + line.fullText.replace(/\s+/g, '').length,
        0
      );
      if (pageCharCount === 0) {
        scannedPageNumbers.push(pageNum);
      }

      page.cleanup?.();
    }

    // If every single page has no extractable text, abort cleanly with ScannedPdfError
    if (scannedPageNumbers.length === pageCount) {
      throw new ScannedPdfError(pageCount);
    }

    const sortedSizes = [...allBodySizes].sort((a, b) => a - b);
    const medianFontSize =
      sortedSizes.length > 0
        ? sortedSizes[Math.floor(sortedSizes.length / 2)]
        : 11;

    const docChildren: Array<Paragraph | Table> = [];
    const previewBlocks: string[] = [];
    const stats = {
      headings: 0,
      paragraphs: 0,
      lists: 0,
      tables: 0,
      words: 0,
    };

    const bodyHalfPoints = 22; // 11pt readable Word body font

    for (let pIdx = 0; pIdx < perPageLines.length; pIdx += 1) {
      const pageNum = pIdx + 1;
      const lines = perPageLines[pIdx];

      if (pIdx > 0 && options.includePageBreaks && options.layoutMode === 'preserve') {
        docChildren.push(
          new Paragraph({
            children: [new PageBreak()],
          })
        );
      }

      if (lines.length === 0) {
        docChildren.push(
          new Paragraph({
            spacing: { before: 120, after: 120 },
            children: [
              new TextRun({
                text: `[Page ${pageNum}: Scanned or image-only page — no selectable text detected; OCR required to extract text.]`,
                italics: true,
                size: 20,
                color: '68736D',
                font: 'Calibri',
              }),
            ],
          })
        );
        previewBlocks.push(`[Page ${pageNum}: Image-only / OCR needed]`);
        continue;
      }

      let i = 0;
      while (i < lines.length) {
        const line = lines[i];

        // 1. Check multi-column table block
        if (options.reconstructTables && line.cells.length >= 2) {
          let j = i + 1;
          while (
            j < lines.length &&
            lines[j].cells.length >= 2 &&
            Math.abs(lines[j - 1].y - lines[j].y) <=
              Math.max(lines[j - 1].avgFontSize, lines[j].avgFontSize) * 3.5
          ) {
            j += 1;
          }
          if (j - i >= 2) {
            const tableLines = lines.slice(i, j);
            const tableEl = buildTableBlock(tableLines, medianFontSize);
            if (tableEl) {
              docChildren.push(tableEl);
              docChildren.push(
                new Paragraph({ spacing: { before: 0, after: 100 }, children: [] })
              );
              stats.tables += 1;
              for (const tl of tableLines) {
                const rowText = tl.cells.map((c) => c.text).join(' | ');
                previewBlocks.push(rowText);
                stats.words += rowText.split(/\s+/).filter(Boolean).length;
              }
              i = j;
              continue;
            }
          }
        }

        // 2. Check heading
        const headingLevel = classifyHeadingLevel(
          line,
          medianFontSize,
          options.detectHeadings
        );
        if (headingLevel) {
          const headingHalfPoints =
            headingLevel === HeadingLevel.HEADING_1
              ? 34
              : headingLevel === HeadingLevel.HEADING_2
                ? 28
                : 24;
          docChildren.push(
            new Paragraph({
              heading: headingLevel,
              spacing: { before: 220, after: 100 },
              children: lineToTextRuns(line, headingHalfPoints, true),
            })
          );
          stats.headings += 1;
          stats.words += line.fullText.split(/\s+/).filter(Boolean).length;
          previewBlocks.push(line.fullText);
          i += 1;
          continue;
        }

        // 3. Check bullet or numbered list item
        const bulletMatch = line.fullText.match(/^(?:[•\-*▪◦])\s+(.+)$/);
        if (bulletMatch) {
          const cleanedText = bulletMatch[1];
          docChildren.push(
            new Paragraph({
              bullet: { level: 0 },
              spacing: { before: 40, after: 60, line: 276 },
              children: [
                new TextRun({
                  text: cleanedText,
                  bold: line.isBold,
                  italics: line.isItalic,
                  size: bodyHalfPoints,
                  font: 'Calibri',
                  color: '252B28',
                }),
              ],
            })
          );
          stats.lists += 1;
          stats.words += cleanedText.split(/\s+/).filter(Boolean).length;
          previewBlocks.push(`• ${cleanedText}`);
          i += 1;
          continue;
        }

        const numberedMatch = line.fullText.match(/^(\d+[.)])\s+(.+)$/);
        if (numberedMatch) {
          const [, prefix, itemText] = numberedMatch;
          docChildren.push(
            new Paragraph({
              indent: { left: 360, hanging: 240 },
              spacing: { before: 40, after: 60, line: 276 },
              children: [
                new TextRun({
                  text: `${prefix} `,
                  bold: true,
                  size: bodyHalfPoints,
                  font: 'Calibri',
                  color: '173F35',
                }),
                new TextRun({
                  text: itemText,
                  bold: line.isBold,
                  italics: line.isItalic,
                  size: bodyHalfPoints,
                  font: 'Calibri',
                  color: '252B28',
                }),
              ],
            })
          );
          stats.lists += 1;
          stats.words += itemText.split(/\s+/).filter(Boolean).length;
          previewBlocks.push(`${prefix} ${itemText}`);
          i += 1;
          continue;
        }

        // 4. Body paragraph — merge tightly spaced consecutive lines
        const paraLines: VisualLine[] = [line];
        let k = i + 1;
        while (k < lines.length) {
          const prevLine = lines[k - 1];
          const nextLine = lines[k];
          const dy = prevLine.y - nextLine.y;
          const nextIsTable =
            options.reconstructTables && nextLine.cells.length >= 2;
          const nextIsHeading =
            classifyHeadingLevel(nextLine, medianFontSize, options.detectHeadings) !==
            null;
          const nextIsBullet = /^(?:[•\-*▪◦])\s+/.test(nextLine.fullText);
          const nextIsNumbered = /^\d+[.)]\s+/.test(nextLine.fullText);
          const currentEndsParagraph =
            options.layoutMode === 'preserve' &&
            /[.!?:"”]$/.test(prevLine.fullText.trim()) &&
            dy > prevLine.avgFontSize * 1.45;

          const largeVerticalGap = dy > prevLine.avgFontSize * 1.85;

          if (
            nextIsTable ||
            nextIsHeading ||
            nextIsBullet ||
            nextIsNumbered ||
            largeVerticalGap ||
            currentEndsParagraph
          ) {
            break;
          }
          paraLines.push(nextLine);
          k += 1;
        }

        const mergedRuns: TextRun[] = [];
        const paraTexts: string[] = [];
        paraLines.forEach((pl, idx) => {
          if (idx > 0) {
            mergedRuns.push(
              new TextRun({
                text: ' ',
                size: bodyHalfPoints,
                font: 'Calibri',
              })
            );
          }
          mergedRuns.push(...lineToTextRuns(pl, bodyHalfPoints));
          paraTexts.push(pl.fullText);
        });

        const joinedPara = paraTexts.join(' ').trim();
        if (joinedPara) {
          docChildren.push(
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 40, after: 140, line: 280 },
              children: mergedRuns,
            })
          );
          stats.paragraphs += 1;
          stats.words += joinedPara.split(/\s+/).filter(Boolean).length;
          previewBlocks.push(joinedPara);
        }

        i = k;
      }
    }

    const wordDoc = new Document({
      creator: 'AI Utility Hub',
      title: buildDocxFilenameFromPdf(originalFilename),
      sections: [
        {
          properties: {
            page: {
              margin: {
                top: 1080, // 0.75 in
                right: 1080,
                bottom: 1080,
                left: 1080,
              },
            },
          },
          children: docChildren,
        },
      ],
    });

    const docxArrayBuffer = await Packer.toArrayBuffer(wordDoc);
    const docxBytes = new Uint8Array(docxArrayBuffer);
    const warnings: string[] = [];
    if (scannedPageNumbers.length > 0) {
      warnings.push(
        `Page${scannedPageNumbers.length === 1 ? '' : 's'} ${scannedPageNumbers.join(
          ', '
        )} had no extractable text and appear${
          scannedPageNumbers.length === 1 ? 's' : ''
        } to contain scanned images (OCR required).`
      );
    }

    return {
      docxBytes,
      filename: buildDocxFilenameFromPdf(originalFilename),
      pageCount,
      textPageCount: pageCount - scannedPageNumbers.length,
      scannedPageNumbers,
      warnings,
      previewText: previewBlocks.join('\n\n'),
      stats,
    };
  } finally {
    await cleanup();
  }
}

export function createDocxObjectUrl(bytes: Uint8Array): {
  objectUrl: string;
  size: number;
} {
  const blob = new Blob([bytes.slice().buffer], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  return {
    objectUrl: URL.createObjectURL(blob),
    size: blob.size,
  };
}
