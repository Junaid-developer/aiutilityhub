import JSZip from 'jszip';
import mammoth from 'mammoth';
import {
  PDFDocument,
  PDFFont,
  PDFImage,
  PDFPage,
  PageSizes,
  rgb,
  StandardFonts,
} from 'pdf-lib';

export type PaperSize = 'a4' | 'letter' | 'legal';
export type Orientation = 'portrait' | 'landscape';

export const MAX_DOCX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

export interface WordToPdfOptions {
  paperSize: PaperSize;
  orientation: Orientation;
  standardizeTypography: boolean;
}

export interface WordToPdfResult {
  pdfBytes: Uint8Array;
  pageCount: number;
  filename: string;
  warnings: string[];
  extractedStats: {
    headings: number;
    paragraphs: number;
    lists: number;
    tables: number;
    images: number;
  };
}

export function formatDocxFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function validateDocxFileMeta(file: {
  name: string;
  type: string;
  size: number;
}): { ok: true } | { ok: false; error: string } {
  const lowerName = file.name.toLowerCase().trim();
  const mime = file.type.toLowerCase().trim();

  if (lowerName.endsWith('.doc') && !lowerName.endsWith('.docx')) {
    return {
      ok: false,
      error:
        'Legacy .doc files are not supported. Please save the document as .docx in Microsoft Word and try again.',
    };
  }

  const isDocxMime =
    mime ===
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  const hasDocxExt = lowerName.endsWith('.docx');

  if (
    !hasDocxExt &&
    !isDocxMime
  ) {
    return {
      ok: false,
      error: `Unsupported file "${file.name}". Please upload a valid Microsoft Word (.docx) document.`,
    };
  }

  if (!hasDocxExt && isDocxMime === false) {
    return {
      ok: false,
      error: 'Please upload a .docx file.',
    };
  }

  if (file.size <= 0) {
    return {
      ok: false,
      error: `The file "${file.name}" is empty.`,
    };
  }

  if (file.size > MAX_DOCX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: `"${file.name}" exceeds the ${formatDocxFileSize(
        MAX_DOCX_FILE_SIZE_BYTES
      )} file size limit.`,
    };
  }

  return { ok: true };
}

export function buildPdfFilenameFromDocx(originalName: string): string {
  const trimmed = originalName.trim();
  if (!trimmed) return 'converted-document.pdf';
  if (/\.docx$/i.test(trimmed)) {
    return trimmed.replace(/\.docx$/i, '.pdf');
  }
  const stripped = trimmed.replace(/\.[^.]+$/, '');
  return `${stripped || 'converted-document'}.pdf`;
}

// --- Lightweight pure-TS HTML AST parser (works identically in Browser & Node) ---

interface HtmlNode {
  type: 'element' | 'text';
  tag?: string;
  attrs?: Record<string, string>;
  children?: HtmlNode[];
  text?: string;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    });
}

function parseAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const attrRegex = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrString)) !== null) {
    const key = match[1].toLowerCase();
    const val = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[key] = decodeHtmlEntities(val);
  }
  return attrs;
}

const VOID_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link']);

function parseHtmlToAst(html: string): HtmlNode[] {
  const root: HtmlNode = { type: 'element', tag: 'root', children: [] };
  const stack: HtmlNode[] = [root];

  const tokenRegex = /(<\/?[a-zA-Z0-9]+(?:\s+[^<>]*)?\s*\/?>)|([^<]+)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(html)) !== null) {
    const tagToken = match[1];
    const textToken = match[2];

    if (textToken) {
      const decoded = decodeHtmlEntities(textToken);
      const current = stack[stack.length - 1];
      current.children?.push({ type: 'text', text: decoded });
      continue;
    }

    if (!tagToken) continue;

    if (tagToken.startsWith('</')) {
      const closeTag = tagToken.slice(2, -1).trim().toLowerCase();
      for (let i = stack.length - 1; i >= 1; i -= 1) {
        if (stack[i].tag === closeTag) {
          stack.length = i;
          break;
        }
      }
      continue;
    }

    const selfClosing = tagToken.endsWith('/>');
    const inner = tagToken.slice(1, selfClosing ? -2 : -1).trim();
    const spaceIdx = inner.search(/\s/);
    const tagName = (spaceIdx === -1 ? inner : inner.slice(0, spaceIdx)).toLowerCase();
    const attrRaw = spaceIdx === -1 ? '' : inner.slice(spaceIdx + 1);

    const node: HtmlNode = {
      type: 'element',
      tag: tagName,
      attrs: attrRaw ? parseAttributes(attrRaw) : {},
      children: [],
    };

    stack[stack.length - 1].children?.push(node);

    if (!selfClosing && !VOID_TAGS.has(tagName)) {
      stack.push(node);
    }
  }

  return root.children ?? [];
}

// --- Inline Runs & Block Extraction ---

interface TextRun {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  code: boolean;
  isLink: boolean;
  isBreak?: boolean;
}

interface InlineStyleState {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  code: boolean;
  isLink: boolean;
}

interface ExtractedImage {
  contentType: string;
  bytes: Uint8Array;
}

function collectInlineRuns(
  nodes: HtmlNode[],
  style: InlineStyleState,
  out: TextRun[]
) {
  for (const node of nodes) {
    if (node.type === 'text') {
      const value = node.text ?? '';
      if (value) {
        out.push({
          text: value,
          bold: style.bold,
          italic: style.italic,
          underline: style.underline,
          code: style.code,
          isLink: style.isLink,
        });
      }
      continue;
    }

    const tag = node.tag ?? '';
    if (tag === 'br') {
      out.push({
        text: '',
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
        code: style.code,
        isLink: style.isLink,
        isBreak: true,
      });
      continue;
    }

    const nextStyle: InlineStyleState = {
      bold: style.bold || tag === 'strong' || tag === 'b',
      italic: style.italic || tag === 'em' || tag === 'i',
      underline: style.underline || tag === 'u',
      code: style.code || tag === 'code' || tag === 'pre',
      isLink: style.isLink || tag === 'a',
    };

    if (node.children && node.children.length > 0) {
      collectInlineRuns(node.children, nextStyle, out);
    }
  }
}

function sanitizeWinAnsiText(raw: string, onUnsupportedChar?: () => void): string {
  const normalized = raw
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/[\u2018\u2019\u201A]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2013/g, '-')
    .replace(/\u2014/g, '--')
    .replace(/\u2026/g, '...')
    .replace(/\u2192/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/[\u2713\u2714]/g, '[x]')
    .replace(/\t/g, '    ')
    .replace(/[\r\n]+/g, ' ');

  let result = '';
  for (const ch of normalized) {
    const cp = ch.codePointAt(0) ?? 32;
    // Printable ASCII, Latin-1 supplement, euro sign, and bullet (U+2022) supported by WinAnsi
    if (
      (cp >= 0x20 && cp <= 0x7e) ||
      (cp >= 0xa0 && cp <= 0xff) ||
      cp === 0x2022 ||
      cp === 0x20ac
    ) {
      result += ch;
    } else {
      result += '?';
      onUnsupportedChar?.();
    }
  }
  return result;
}

interface PositionedLineWord {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  code: boolean;
  isLink: boolean;
  width: number;
}

interface WrappedLine {
  words: PositionedLineWord[];
  totalWidth: number;
}

interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
  italic: PDFFont;
  boldItalic: PDFFont;
  mono: PDFFont;
}

function pickFont(fonts: FontSet, word: { bold: boolean; italic: boolean; code: boolean }): PDFFont {
  if (word.code) return fonts.mono;
  if (word.bold && word.italic) return fonts.boldItalic;
  if (word.bold) return fonts.bold;
  if (word.italic) return fonts.italic;
  return fonts.regular;
}

function measureTextSafe(font: PDFFont, text: string, fontSize: number): number {
  if (!text) return 0;
  try {
    return font.widthOfTextAtSize(text, fontSize);
  } catch {
    return text.length * fontSize * 0.5;
  }
}

function wrapRunsToLines(
  runs: TextRun[],
  maxWidth: number,
  fontSize: number,
  fonts: FontSet,
  onUnsupportedChar?: () => void
): WrappedLine[] {
  const lines: WrappedLine[] = [];
  let currentWords: PositionedLineWord[] = [];
  let currentWidth = 0;

  const pushCurrentLine = () => {
    // Trim trailing whitespace on last word
    while (
      currentWords.length > 0 &&
      currentWords[currentWords.length - 1].text.trim() === ''
    ) {
      const removed = currentWords.pop()!;
      currentWidth -= removed.width;
    }
    lines.push({ words: currentWords, totalWidth: Math.max(0, currentWidth) });
    currentWords = [];
    currentWidth = 0;
  };

  for (const run of runs) {
    if (run.isBreak) {
      pushCurrentLine();
      continue;
    }

    const safe = sanitizeWinAnsiText(run.text, onUnsupportedChar);
    if (!safe) continue;

    // Split into word and whitespace tokens so spacing is preserved accurately
    const tokens = safe.split(/(\s+)/).filter((t) => t.length > 0);
    const font = pickFont(fonts, run);

    for (const token of tokens) {
      const isSpace = /^\s+$/.test(token);
      if (isSpace && currentWords.length === 0) {
        continue;
      }

      const tokenWidth = measureTextSafe(font, token, fontSize);

      if (!isSpace && tokenWidth > maxWidth) {
        // Hard-wrap an extra-long single token (e.g., long URL)
        let chunk = '';
        for (const ch of token) {
          const test = chunk + ch;
          const testW = measureTextSafe(font, test, fontSize);
          if (currentWidth + testW > maxWidth && (currentWords.length > 0 || chunk.length > 0)) {
            if (chunk) {
              const chunkW = measureTextSafe(font, chunk, fontSize);
              currentWords.push({
                text: chunk,
                bold: run.bold,
                italic: run.italic,
                underline: run.underline,
                code: run.code,
                isLink: run.isLink,
                width: chunkW,
              });
              currentWidth += chunkW;
            }
            pushCurrentLine();
            chunk = ch;
          } else {
            chunk = test;
          }
        }
        if (chunk) {
          const chunkW = measureTextSafe(font, chunk, fontSize);
          currentWords.push({
            text: chunk,
            bold: run.bold,
            italic: run.italic,
            underline: run.underline,
            code: run.code,
            isLink: run.isLink,
            width: chunkW,
          });
          currentWidth += chunkW;
        }
        continue;
      }

      if (!isSpace && currentWidth + tokenWidth > maxWidth && currentWords.length > 0) {
        pushCurrentLine();
      }

      currentWords.push({
        text: token,
        bold: run.bold,
        italic: run.italic,
        underline: run.underline,
        code: run.code,
        isLink: run.isLink,
        width: tokenWidth,
      });
      currentWidth += tokenWidth;
    }
  }

  if (currentWords.length > 0 || lines.length === 0) {
    pushCurrentLine();
  }

  return lines;
}

function getPageDimensions(paperSize: PaperSize, orientation: Orientation): [number, number] {
  const base =
    paperSize === 'letter'
      ? PageSizes.Letter
      : paperSize === 'legal'
        ? PageSizes.Legal
        : PageSizes.A4;
  return orientation === 'landscape' ? [base[1], base[0]] : [base[0], base[1]];
}

async function convertImageBytesToPngInBrowser(
  bytes: Uint8Array,
  contentType: string
): Promise<Uint8Array | null> {
  if (typeof document === 'undefined' || typeof Image === 'undefined') {
    return null;
  }
  const blob = new Blob([bytes.slice().buffer], { type: contentType });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode error'));
      el.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, img.naturalWidth);
    canvas.height = Math.max(1, img.naturalHeight);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/png')
    );
    if (!pngBlob) return null;
    return new Uint8Array(await pngBlob.arrayBuffer());
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function embedExtractedImage(
  pdfDoc: PDFDocument,
  image: ExtractedImage
): Promise<PDFImage | null> {
  const mime = image.contentType.toLowerCase();
  try {
    if (mime.includes('png')) {
      return await pdfDoc.embedPng(image.bytes);
    }
    if (mime.includes('jpeg') || mime.includes('jpg')) {
      return await pdfDoc.embedJpg(image.bytes);
    }
    const converted = await convertImageBytesToPngInBrowser(image.bytes, image.contentType);
    if (converted) {
      return await pdfDoc.embedPng(converted);
    }
    return null;
  } catch {
    return null;
  }
}

export async function convertDocxToPdf(
  arrayBuffer: ArrayBuffer,
  originalFilename: string,
  options: WordToPdfOptions
): Promise<WordToPdfResult> {
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    throw new Error('The uploaded .docx file appears to be empty.');
  }

  // Validate ZIP / DOCX structure first
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    if (!zip.file('word/document.xml')) {
      throw new Error('Missing word/document.xml');
    }
  } catch {
    throw new Error(
      'The selected file is not a valid Word (.docx) document or may be corrupted.'
    );
  }

  const extractedImages = new Map<string, ExtractedImage>();
  let imgCounter = 0;

  const mammothOptions = {
    styleMap: [
      "br[type='page'] => hr.docx-page-break",
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Subtitle'] => p.docx-subtitle:fresh",
    ],
    convertImage: mammoth.images.imgElement(async (image) => {
      const key = `img-${imgCounter++}`;
      const imgBuf = await image.readAsArrayBuffer();
      extractedImages.set(key, {
        contentType: image.contentType || 'image/png',
        bytes: new Uint8Array(imgBuf),
      });
      return { src: key };
    }),
  };

  // Support browser arrayBuffer (Vite) and Node Buffer (tsx test environment)
  const useNodeBuffer =
    typeof window === 'undefined' && typeof Buffer !== 'undefined';
  const mammothInput = useNodeBuffer
    ? ({ buffer: Buffer.from(arrayBuffer) } as unknown as { arrayBuffer: ArrayBuffer })
    : { arrayBuffer };

  const htmlResult = await mammoth.convertToHtml(mammothInput, mammothOptions);
  const ast = parseHtmlToAst(htmlResult.value);

  const pdfDoc = await PDFDocument.create();
  const [pageWidth, pageHeight] = getPageDimensions(
    options.paperSize,
    options.orientation
  );

  const margin = options.standardizeTypography ? 54 : 44;
  const contentWidth = pageWidth - margin * 2;
  const topY = pageHeight - margin;
  const bottomY = margin;

  const fonts: FontSet = {
    regular: await pdfDoc.embedFont(StandardFonts.Helvetica),
    bold: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    italic: await pdfDoc.embedFont(StandardFonts.HelveticaOblique),
    boldItalic: await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique),
    mono: await pdfDoc.embedFont(StandardFonts.Courier),
  };

  const warnings: string[] = [];
  let hasUnsupportedChars = false;
  const markUnsupportedChar = () => {
    hasUnsupportedChars = true;
  };
  const stats = {
    headings: 0,
    paragraphs: 0,
    lists: 0,
    tables: 0,
    images: 0,
  };

  let page: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = topY;
  let pageHasContent = false;

  const startNewPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    cursorY = topY;
    pageHasContent = false;
  };

  const ensureVerticalSpace = (needed: number) => {
    if (cursorY - needed < bottomY && pageHasContent) {
      startNewPage();
    }
  };

  const drawWrappedLines = (
    lines: WrappedLine[],
    startX: number,
    fontSize: number,
    lineHeight: number,
    forceColor?: ReturnType<typeof rgb>
  ) => {
    for (const line of lines) {
      ensureVerticalSpace(lineHeight);
      const baselineY = cursorY - fontSize;
      let drawX = startX;

      for (const word of line.words) {
        const font = pickFont(fonts, word);
        const color =
          forceColor ??
          (word.isLink ? rgb(0.09, 0.25, 0.21) : rgb(0.145, 0.168, 0.157));
        page.drawText(word.text, {
          x: drawX,
          y: baselineY,
          size: fontSize,
          font,
          color,
        });

        if ((word.underline || word.isLink) && word.text.trim().length > 0) {
          page.drawLine({
            start: { x: drawX, y: baselineY - 1.5 },
            end: { x: drawX + word.width, y: baselineY - 1.5 },
            thickness: 0.6,
            color,
          });
        }
        drawX += word.width;
      }

      cursorY -= lineHeight;
      pageHasContent = true;
    }
  };

  const renderEmbeddedImg = async (imgKey: string, maxAvailableWidth: number) => {
    const imgData = extractedImages.get(imgKey);
    if (!imgData) return;

    const embedded = await embedExtractedImage(pdfDoc, imgData);
    if (!embedded) {
      warnings.push(
        `Skipped an image (${imgData.contentType}) that could not be decoded.`
      );
      return;
    }

    const maxImgH = pageHeight - margin * 2 - 20;
    const scale = Math.min(
      1,
      maxAvailableWidth / Math.max(embedded.width, 1),
      maxImgH / Math.max(embedded.height, 1)
    );
    const drawW = embedded.width * scale;
    const drawH = embedded.height * scale;

    ensureVerticalSpace(drawH + 6);
    page.drawImage(embedded, {
      x: margin,
      y: cursorY - drawH,
      width: drawW,
      height: drawH,
    });
    cursorY -= drawH + 10;
    pageHasContent = true;
    stats.images += 1;
  };

  const containsImgDescendant = (nodes: HtmlNode[]): string[] => {
    const keys: string[] = [];
    for (const n of nodes) {
      if (n.type === 'element') {
        if (n.tag === 'img' && n.attrs?.src) {
          keys.push(n.attrs.src);
        }
        if (n.children) {
          keys.push(...containsImgDescendant(n.children));
        }
      }
    }
    return keys;
  };

  const renderTable = async (tableNode: HtmlNode) => {
    stats.tables += 1;
    const rows: Array<{ cells: Array<{ runs: TextRun[]; isHeader: boolean }> }> =
      [];

    const collectRows = (nodes: HtmlNode[], inThead: boolean) => {
      for (const n of nodes) {
        if (n.type !== 'element') continue;
        if (n.tag === 'thead') {
          collectRows(n.children ?? [], true);
        } else if (n.tag === 'tbody' || n.tag === 'tfoot') {
          collectRows(n.children ?? [], false);
        } else if (n.tag === 'tr') {
          const cells: Array<{ runs: TextRun[]; isHeader: boolean }> = [];
          for (const cellNode of n.children ?? []) {
            if (
              cellNode.type === 'element' &&
              (cellNode.tag === 'td' || cellNode.tag === 'th')
            ) {
              const isHeader = inThead || cellNode.tag === 'th';
              const runs: TextRun[] = [];
              collectInlineRuns(
                cellNode.children ?? [],
                {
                  bold: isHeader,
                  italic: false,
                  underline: false,
                  code: false,
                  isLink: false,
                },
                runs
              );
              cells.push({ runs, isHeader });
            }
          }
          if (cells.length > 0) rows.push({ cells });
        }
      }
    };

    collectRows(tableNode.children ?? [], false);
    if (rows.length === 0) return;

    const colCount = Math.max(...rows.map((r) => r.cells.length));
    if (colCount <= 0) return;

    // Estimate column weights from longest text in each column
    const colWeights = new Array<number>(colCount).fill(10);
    for (const row of rows) {
      row.cells.forEach((cell, colIdx) => {
        const totalLen = cell.runs.reduce((s, r) => s + r.text.length, 0);
        colWeights[colIdx] = Math.max(colWeights[colIdx], Math.min(80, totalLen));
      });
    }
    const weightSum = colWeights.reduce((a, b) => a + b, 0);
    const colWidths = colWeights.map((w) => (w / weightSum) * contentWidth);

    const cellFontSize = 9.5;
    const cellLineHeight = 13;
    const cellPadX = 6;
    const cellPadY = 5;

    const renderRow = (row: (typeof rows)[number]) => {
      const wrappedCells = row.cells.map((cell, idx) => {
        const w = Math.max(20, (colWidths[idx] ?? 40) - cellPadX * 2);
        return wrapRunsToLines(cell.runs, w, cellFontSize, fonts, markUnsupportedChar);
      });

      const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
      const rowHeight = maxLines * cellLineHeight + cellPadY * 2;
      ensureVerticalSpace(rowHeight + 2);

      const rowTopY = cursorY;
      let cellX = margin;

      for (let c = 0; c < colCount; c += 1) {
        const w = colWidths[c];
        const cellMeta = row.cells[c];
        const isHeaderCell = cellMeta?.isHeader ?? false;

        page.drawRectangle({
          x: cellX,
          y: rowTopY - rowHeight,
          width: w,
          height: rowHeight,
          color: isHeaderCell ? rgb(0.92, 0.94, 0.92) : rgb(1, 1, 1),
          borderColor: rgb(0.78, 0.8, 0.77),
          borderWidth: 0.6,
        });

        const lines = wrappedCells[c] ?? [];
        let textY = rowTopY - cellPadY;
        for (const line of lines) {
          const baselineY = textY - cellFontSize;
          let drawX = cellX + cellPadX;
          for (const word of line.words) {
            const font = pickFont(fonts, word);
            page.drawText(word.text, {
              x: drawX,
              y: baselineY,
              size: cellFontSize,
              font,
              color: rgb(0.145, 0.168, 0.157),
            });
            drawX += word.width;
          }
          textY -= cellLineHeight;
        }

        cellX += w;
      }

      cursorY -= rowHeight;
      pageHasContent = true;
    };

    const headerRow = rows[0]?.cells.every((c) => c.isHeader) ? rows[0] : null;
    for (let r = 0; r < rows.length; r += 1) {
      const prevCursor = cursorY;
      const estimatedMin = cellLineHeight + cellPadY * 2;
      if (prevCursor - estimatedMin < bottomY && pageHasContent) {
        startNewPage();
        if (headerRow && r > 0) {
          renderRow(headerRow);
        }
      }
      renderRow(rows[r]);
    }

    cursorY -= 8;
  };

  const renderNodes = async (nodes: HtmlNode[], listDepth = 0) => {
    for (const node of nodes) {
      if (node.type === 'text') {
        const txt = node.text?.trim();
        if (txt) {
          const lines = wrapRunsToLines(
            [
              {
                text: txt,
                bold: false,
                italic: false,
                underline: false,
                code: false,
                isLink: false,
              },
            ],
            contentWidth,
            10.5,
            fonts,
            markUnsupportedChar
          );
          drawWrappedLines(lines, margin, 10.5, 15);
          cursorY -= 6;
          stats.paragraphs += 1;
        }
        continue;
      }

      const tag = node.tag ?? '';

      if (tag === 'hr') {
        if (node.attrs?.class?.includes('docx-page-break')) {
          if (pageHasContent) startNewPage();
        } else {
          ensureVerticalSpace(16);
          page.drawLine({
            start: { x: margin, y: cursorY - 6 },
            end: { x: pageWidth - margin, y: cursorY - 6 },
            thickness: 0.75,
            color: rgb(0.84, 0.85, 0.81),
          });
          cursorY -= 16;
          pageHasContent = true;
        }
        continue;
      }

      if (tag === 'img' && node.attrs?.src) {
        await renderEmbeddedImg(node.attrs.src, contentWidth);
        continue;
      }

      if (/^h[1-6]$/.test(tag)) {
        const level = Number(tag.slice(1));
        const sizeMap: Record<number, number> = {
          1: 19,
          2: 15.5,
          3: 13,
          4: 11.5,
          5: 10.5,
          6: 10,
        };
        const fontSize = sizeMap[level] ?? 11;
        const lineHeight = fontSize * 1.35;
        const runs: TextRun[] = [];
        collectInlineRuns(
          node.children ?? [],
          {
            bold: true,
            italic: false,
            underline: false,
            code: false,
            isLink: false,
          },
          runs
        );

        const lines = wrapRunsToLines(
          runs,
          contentWidth,
          fontSize,
          fonts,
          markUnsupportedChar
        );
        if (lines.length > 0) {
          if (pageHasContent) cursorY -= level === 1 ? 8 : 5;
          // Widow guard: ensure heading + space for at least 1 line below stays together
          ensureVerticalSpace(lines.length * lineHeight + 18);
          drawWrappedLines(
            lines,
            margin,
            fontSize,
            lineHeight,
            level === 1 ? rgb(0.09, 0.247, 0.208) : rgb(0.145, 0.168, 0.157)
          );
          if (level === 1) {
            page.drawLine({
              start: { x: margin, y: cursorY + 2 },
              end: { x: pageWidth - margin, y: cursorY + 2 },
              thickness: 0.8,
              color: rgb(0.86, 0.87, 0.83),
            });
            cursorY -= 6;
          } else {
            cursorY -= 4;
          }
          stats.headings += 1;
        }
        continue;
      }

      if (tag === 'p' || tag === 'div') {
        const isSubtitle = node.attrs?.class?.includes('docx-subtitle');
        const fontSize = isSubtitle ? 12 : 10.5;
        const lineHeight = fontSize * 1.45;
        let segmentRuns: TextRun[] = [];
        let drewSegmentText = false;

        const flushSegment = () => {
          const hasText = segmentRuns.some((r) => r.text.trim().length > 0);
          if (hasText) {
            const lines = wrapRunsToLines(
              segmentRuns,
              contentWidth,
              fontSize,
              fonts,
              markUnsupportedChar
            );
            drawWrappedLines(
              lines,
              margin,
              fontSize,
              lineHeight,
              isSubtitle ? rgb(0.41, 0.45, 0.43) : undefined
            );
            drewSegmentText = true;
            stats.paragraphs += 1;
          }
          segmentRuns = [];
        };

        const walkParagraphChildren = async (children: HtmlNode[]) => {
          for (const child of children) {
            if (child.type === 'element' && child.tag === 'hr') {
              flushSegment();
              if (child.attrs?.class?.includes('docx-page-break')) {
                if (pageHasContent) startNewPage();
              } else {
                ensureVerticalSpace(16);
                page.drawLine({
                  start: { x: margin, y: cursorY - 6 },
                  end: { x: pageWidth - margin, y: cursorY - 6 },
                  thickness: 0.75,
                  color: rgb(0.84, 0.85, 0.81),
                });
                cursorY -= 16;
                pageHasContent = true;
              }
              continue;
            }

            if (
              child.type === 'element' &&
              child.tag === 'img' &&
              child.attrs?.src
            ) {
              flushSegment();
              await renderEmbeddedImg(child.attrs.src, contentWidth);
              continue;
            }

            if (child.type === 'element') {
              const nestedBreakOrImg =
                child.children &&
                child.children.some(
                  (grand) =>
                    grand.type === 'element' &&
                    (grand.tag === 'hr' || grand.tag === 'img')
                );
              if (nestedBreakOrImg && child.children) {
                await walkParagraphChildren(child.children);
                continue;
              }
            }

            collectInlineRuns(
              [child],
              {
                bold: false,
                italic: false,
                underline: false,
                code: false,
                isLink: false,
              },
              segmentRuns
            );
          }
        };

        await walkParagraphChildren(node.children ?? []);
        flushSegment();
        if (drewSegmentText) {
          cursorY -= 6;
        }
        continue;
      }

      if (tag === 'blockquote') {
        const runs: TextRun[] = [];
        collectInlineRuns(
          node.children ?? [],
          {
            bold: false,
            italic: true,
            underline: false,
            code: false,
            isLink: false,
          },
          runs
        );
        const lines = wrapRunsToLines(
          runs,
          contentWidth - 18,
          10.5,
          fonts,
          markUnsupportedChar
        );
        if (lines.length > 0) {
          const blockHeight = lines.length * 15;
          ensureVerticalSpace(blockHeight);
          const barTop = cursorY;
          drawWrappedLines(
            lines,
            margin + 14,
            10.5,
            15,
            rgb(0.35, 0.4, 0.37)
          );
          page.drawLine({
            start: { x: margin + 4, y: barTop - 2 },
            end: { x: margin + 4, y: cursorY + 3 },
            thickness: 2,
            color: rgb(0.769, 0.604, 0.345),
          });
          cursorY -= 6;
          stats.paragraphs += 1;
        }
        continue;
      }

      if (tag === 'ul' || tag === 'ol') {
        stats.lists += 1;
        const isOrdered = tag === 'ol';
        let itemIndex = 1;

        for (const child of node.children ?? []) {
          if (child.type !== 'element' || child.tag !== 'li') continue;
          const indent = margin + listDepth * 16;
          const bulletGap = 16;
          const itemWidth = Math.max(80, pageWidth - margin - indent - bulletGap);

          // Separate direct inline runs from nested lists inside <li>
          const inlineNodes: HtmlNode[] = [];
          const nestedListNodes: HtmlNode[] = [];
          for (const liChild of child.children ?? []) {
            if (
              liChild.type === 'element' &&
              (liChild.tag === 'ul' || liChild.tag === 'ol')
            ) {
              nestedListNodes.push(liChild);
            } else {
              inlineNodes.push(liChild);
            }
          }

          const runs: TextRun[] = [];
          collectInlineRuns(
            inlineNodes,
            {
              bold: false,
              italic: false,
              underline: false,
              code: false,
              isLink: false,
            },
            runs
          );

          const lines = wrapRunsToLines(
            runs,
            itemWidth,
            10.5,
            fonts,
            markUnsupportedChar
          );
          const marker = isOrdered
            ? `${itemIndex}.`
            : listDepth === 0
              ? '•'
              : '-';
          itemIndex += 1;

          if (lines.length > 0) {
            ensureVerticalSpace(15);
            page.drawText(marker, {
              x: indent,
              y: cursorY - 10.5,
              size: 10.5,
              font: fonts.bold,
              color: rgb(0.09, 0.247, 0.208),
            });
            drawWrappedLines(lines, indent + bulletGap, 10.5, 15);
            cursorY -= 2.5;
          }

          const imgKeys = containsImgDescendant(inlineNodes);
          for (const key of imgKeys) {
            await renderEmbeddedImg(key, itemWidth);
          }

          if (nestedListNodes.length > 0) {
            await renderNodes(nestedListNodes, listDepth + 1);
          }
        }
        if (listDepth === 0) cursorY -= 5;
        continue;
      }

      if (tag === 'table') {
        await renderTable(node);
        continue;
      }

      if (node.children && node.children.length > 0) {
        await renderNodes(node.children, listDepth);
      }
    }
  };

  await renderNodes(ast);

  const totalExtracted =
    stats.headings +
    stats.paragraphs +
    stats.lists +
    stats.tables +
    stats.images;
  if (totalExtracted === 0 && !pageHasContent) {
    throw new Error(
      'No readable text, tables, or images were found inside this Word document.'
    );
  }

  for (const msg of htmlResult.messages) {
    if (msg.type === 'error') {
      warnings.push(msg.message);
    }
  }
  if (hasUnsupportedChars) {
    warnings.push(
      'Some non-Latin or unsupported Unicode symbols were replaced with "?" because standard PDF fonts use Latin-1 encoding.'
    );
  }

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBytes,
    pageCount: pdfDoc.getPageCount(),
    filename: buildPdfFilenameFromDocx(originalFilename),
    warnings,
    extractedStats: stats,
  };
}
