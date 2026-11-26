import {
  AlertCircle,
  Braces,
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileCode2,
  Minimize2,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  formatJson,
  JsonErrorInfo,
  minifyJson,
  validateJson,
} from '../../utils/jsonFormatter';

const SAMPLE_JSON = `{
  "service": "AI Utility Hub",
  "version": 2,
  "active": true,
  "tools": [
    "Word Counter",
    "JSON Formatter",
    "Image Compressor"
  ],
  "user": {
    "name": "Ali",
    "role": "Developer",
    "skills": ["HTML", "CSS", "TypeScript", "AI"]
  }
}`;

type StatusState =
  | { type: 'idle' }
  | { type: 'success'; message: string }
  | { type: 'error'; error: JsonErrorInfo };

export function JsonFormatterWorkspace() {
  const [indent, setIndent] = useState<2 | 4>(2);
  const [inputJson, setInputJson] = useState('');
  const [outputJson, setOutputJson] = useState('');
  const [outputMode, setOutputMode] = useState<'formatted' | 'minified'>(
    'formatted'
  );
  const [status, setStatus] = useState<StatusState>({ type: 'idle' });
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>(
    'idle'
  );

  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const inputGutterRef = useRef<HTMLDivElement>(null);
  const outputPreRef = useRef<HTMLPreElement>(null);
  const outputGutterRef = useRef<HTMLDivElement>(null);

  const hasInput = inputJson.trim().length > 0;
  const hasOutput = outputJson.length > 0;
  const canClear =
    inputJson.length > 0 || outputJson.length > 0 || status.type !== 'idle';

  const MAX_GUTTER_LINES = 2500;
  const rawInputLineCount = inputJson ? inputJson.split('\n').length : 1;
  const rawOutputLineCount = outputJson ? outputJson.split('\n').length : 1;
  const showInputGutter = rawInputLineCount <= MAX_GUTTER_LINES;
  const showOutputGutter = rawOutputLineCount <= MAX_GUTTER_LINES;
  const inputLineCount = Math.max(12, Math.min(rawInputLineCount, MAX_GUTTER_LINES));
  const outputLineCount = Math.max(
    12,
    outputJson ? Math.min(rawOutputLineCount, MAX_GUTTER_LINES) : 12
  );

  useEffect(() => {
    if (copyState === 'idle') return;
    const timer = window.setTimeout(() => setCopyState('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [copyState]);

  const handleFormat = (spaces: 2 | 4 = indent) => {
    const result = formatJson(inputJson, spaces);
    if (result.ok) {
      setOutputJson(result.output);
      setOutputMode('formatted');
      setStatus({
        type: 'success',
        message: `Formatted JSON with ${spaces}-space indentation.`,
      });
    } else {
      setStatus({ type: 'error', error: result.error });
    }
  };

  const handleMinify = () => {
    const result = minifyJson(inputJson);
    if (result.ok) {
      setOutputJson(result.output);
      setOutputMode('minified');
      setStatus({
        type: 'success',
        message: `Minified JSON (${result.output.length.toLocaleString()} characters).`,
      });
    } else {
      setStatus({ type: 'error', error: result.error });
    }
  };

  const handleValidate = () => {
    const result = validateJson(inputJson);
    if (result.ok) {
      setStatus({
        type: 'success',
        message: result.summary,
      });
    } else {
      setStatus({ type: 'error', error: result.error });
    }
  };

  const handleLoadSample = () => {
    setInputJson(SAMPLE_JSON);
    const formatted = formatJson(SAMPLE_JSON, indent);
    if (formatted.ok) {
      setOutputJson(formatted.output);
      setOutputMode('formatted');
      setStatus({
        type: 'success',
        message: 'Sample JSON loaded and formatted.',
      });
    } else {
      setOutputJson('');
      setStatus({ type: 'idle' });
    }
    setCopyState('idle');
  };

  const handleClear = () => {
    setInputJson('');
    setOutputJson('');
    setStatus({ type: 'idle' });
    setCopyState('idle');
    inputTextareaRef.current?.focus();
  };

  const handleCopyOutput = async () => {
    if (!hasOutput) return;
    try {
      if (
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === 'function'
      ) {
        await navigator.clipboard.writeText(outputJson);
        setCopyState('copied');
        return;
      }
      throw new Error('Clipboard API unavailable');
    } catch {
      try {
        const temp = document.createElement('textarea');
        temp.value = outputJson;
        temp.setAttribute('readonly', '');
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(temp);
        setCopyState(ok ? 'copied' : 'error');
      } catch {
        setCopyState('error');
      }
    }
  };

  const handleDownloadJson = () => {
    if (!hasOutput) return;
    try {
      const blob = new Blob([outputJson], {
        type: 'application/json;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download =
        outputMode === 'minified' ? 'data.min.json' : 'formatted.json';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setStatus({
        type: 'error',
        error: { message: 'Unable to trigger file download in this browser.' },
      });
    }
  };

  return (
    <div className="rounded-[18px] border border-[#DCDDD3] bg-white p-5 shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-8 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-[#DCDDD3] pb-5 lg:flex-row lg:items-center lg:justify-between dark:border-[#35463E]">
        {/* Left: Indentation & Primary Actions */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Indentation width"
            className="flex rounded-lg bg-[#EDE9DF] p-1 dark:bg-[#17231F]"
          >
            {([2, 4] as const).map((spaces) => (
              <button
                key={spaces}
                type="button"
                aria-pressed={indent === spaces}
                onClick={() => {
                  setIndent(spaces);
                  if (hasInput && outputMode === 'formatted' && hasOutput) {
                    handleFormat(spaces);
                  }
                }}
                className={`min-h-8 rounded-md px-3 text-xs font-semibold whitespace-nowrap transition-colors ${
                  indent === spaces
                    ? 'bg-white text-[#173F35] shadow-xs dark:bg-[#24332C] dark:text-[#F2F0E9]'
                    : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                }`}
              >
                {spaces} Spaces
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => handleFormat(indent)}
            disabled={!hasInput}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#173F35] px-4 py-2 text-xs font-semibold text-[#F2F0E9] whitespace-nowrap transition-colors hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
          >
            <Braces className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Format JSON</span>
          </button>

          <button
            type="button"
            onClick={handleMinify}
            disabled={!hasInput}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/45 px-3.5 text-xs font-semibold text-[#252B28] whitespace-nowrap transition-colors hover:border-[#C49A58] hover:bg-[#EDE9DF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
          >
            <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Minify</span>
          </button>

          <button
            type="button"
            onClick={handleValidate}
            disabled={!hasInput}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/45 px-3.5 text-xs font-semibold text-[#252B28] whitespace-nowrap transition-colors hover:border-[#C49A58] hover:bg-[#EDE9DF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Validate</span>
          </button>
        </div>

        {/* Right: Sample, Copy, Download, Clear */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleLoadSample}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3.5 text-xs font-semibold text-[#173F35] whitespace-nowrap transition-colors hover:border-[#C49A58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#D9B978] dark:hover:border-[#D9B978]"
          >
            <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Sample JSON</span>
          </button>

          <button
            type="button"
            onClick={handleCopyOutput}
            disabled={!hasOutput}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3.5 text-xs font-semibold text-[#252B28] whitespace-nowrap transition-colors hover:border-[#C49A58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
          >
            {copyState === 'copied' ? (
              <>
                <Check
                  className="h-3.5 w-3.5 text-[#173F35] dark:text-[#D9B978]"
                  aria-hidden="true"
                />
                <span className="text-[#173F35] dark:text-[#D9B978]">
                  Copied
                </span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Copy Output</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            disabled={!hasOutput}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3.5 text-xs font-semibold text-[#252B28] whitespace-nowrap transition-colors hover:border-[#C49A58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Download .json</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={!canClear}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-[#DCDDD3] bg-white px-3.5 text-xs font-semibold text-[#56615B] whitespace-nowrap transition-colors hover:border-[#C49A58] hover:text-[#252B28] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] disabled:cursor-not-allowed disabled:opacity-45 dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#B9C5BD] dark:hover:border-[#D9B978] dark:hover:text-[#F2F0E9]"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>
        </div>
      </div>

      {/* Status Notification Banner */}
      {(status.type !== 'idle' || copyState === 'error') && (
        <div className="mt-4">
          {status.type === 'success' && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl border border-[#173F35]/20 bg-[#E3EAE4] px-4 py-3 text-xs font-medium text-[#173F35] dark:border-[#D9B978]/25 dark:bg-[#30483C] dark:text-[#F2F0E9]"
            >
              <CheckCircle2
                className="mt-0.5 h-4 w-4 shrink-0 text-[#173F35] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <span>{status.message}</span>
            </div>
          )}

          {status.type === 'error' && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-red-700/25 bg-red-50 px-4 py-3 text-xs text-red-900 dark:border-red-400/30 dark:bg-red-950/50 dark:text-red-200"
            >
              <AlertCircle
                className="mt-0.5 h-4 w-4 shrink-0 text-red-700 dark:text-red-300"
                aria-hidden="true"
              />
              <div className="space-y-0.5">
                <p className="font-semibold">
                  Invalid JSON
                  {status.error.line !== undefined
                    ? ` (Line ${status.error.line}${
                        status.error.column !== undefined
                          ? `, Column ${status.error.column}`
                          : ''
                      })`
                    : ''}
                </p>
                <p className="font-mono text-[11px] leading-relaxed">
                  {status.error.message}
                </p>
              </div>
            </div>
          )}

          {copyState === 'error' && (
            <p
              role="alert"
              className="mt-2 flex items-center gap-2 rounded-xl bg-[#EDE9DF] px-4 py-2.5 text-xs font-medium text-[#252B28] dark:bg-[#17231F] dark:text-[#F2F0E9]"
            >
              <AlertCircle
                className="h-4 w-4 shrink-0 text-[#7D5C23] dark:text-[#D9B978]"
                aria-hidden="true"
              />
              <span>
                Unable to copy automatically. Select the output text and copy
                manually.
              </span>
            </p>
          )}
        </div>
      )}

      {/* Split Input & Output Panels */}
      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Input Editor Panel */}
        <div className="flex flex-col">
          <div className="mb-2 flex items-center justify-between text-xs text-[#56615B] dark:text-[#B9C5BD]">
            <label htmlFor="json-input-editor" className="font-semibold">
              Input JSON
            </label>
            <span className="font-mono tabular-nums">
              {inputJson.length.toLocaleString()} chars
            </span>
          </div>

          <div className="flex h-[340px] overflow-hidden rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/35 focus-within:border-[#173F35] dark:border-[#35463E] dark:bg-[#17231F] dark:focus-within:border-[#D9B978]">
            {showInputGutter && (
              <div
                ref={inputGutterRef}
                aria-hidden="true"
                className="w-11 shrink-0 select-none overflow-hidden border-r border-[#DCDDD3] bg-[#EDE9DF]/70 px-2 py-3.5 text-right font-mono text-xs leading-6 text-[#56615B] tabular-nums dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#B9C5BD]"
              >
                {Array.from({ length: inputLineCount }, (_, idx) => (
                  <div key={idx}>{String(idx + 1).padStart(2, '0')}</div>
                ))}
              </div>
            )}
            <textarea
              ref={inputTextareaRef}
              id="json-input-editor"
              value={inputJson}
              onChange={(e) => {
                setInputJson(e.target.value);
                if (status.type !== 'idle') {
                  setStatus({ type: 'idle' });
                }
              }}
              onScroll={(e) => {
                if (inputGutterRef.current) {
                  inputGutterRef.current.scrollTop =
                    e.currentTarget.scrollTop;
                }
              }}
              spellCheck={false}
              wrap="off"
              placeholder="Paste or write your JSON here..."
              className="h-full w-full resize-none overflow-auto bg-transparent p-3.5 font-mono text-xs leading-6 text-[#252B28] placeholder-[#56615B] focus:outline-none dark:text-[#F2F0E9] dark:placeholder-[#B9C5BD]"
            />
          </div>
        </div>

        {/* Output Panel */}
        <div className="flex flex-col">
          <div className="mb-2 flex items-center justify-between text-xs text-[#56615B] dark:text-[#B9C5BD]">
            <span className="font-semibold">
              {hasOutput
                ? outputMode === 'minified'
                  ? 'Minified Output'
                  : `Formatted Output (${indent} spaces)`
                : 'Output'}
            </span>
            <span className="font-mono tabular-nums">
              {hasOutput
                ? `${outputJson.length.toLocaleString()} chars`
                : 'Waiting for input'}
            </span>
          </div>

          {hasOutput ? (
            <div className="flex h-[340px] overflow-hidden rounded-xl border border-[#DCDDD3] bg-[#EDE9DF]/55 dark:border-[#35463E] dark:bg-[#17231F]/80">
              {showOutputGutter && (
                <div
                  ref={outputGutterRef}
                  aria-hidden="true"
                  className="w-11 shrink-0 select-none overflow-hidden border-r border-[#DCDDD3] px-2 py-3.5 text-right font-mono text-xs leading-6 text-[#56615B] tabular-nums dark:border-[#35463E] dark:text-[#B9C5BD]"
                >
                  {Array.from({ length: outputLineCount }, (_, idx) => (
                    <div key={idx}>{String(idx + 1).padStart(2, '0')}</div>
                  ))}
                </div>
              )}
              <pre
                ref={outputPreRef}
                onScroll={(e) => {
                  if (outputGutterRef.current) {
                    outputGutterRef.current.scrollTop =
                      e.currentTarget.scrollTop;
                  }
                }}
                className={`h-full w-full overflow-auto p-3.5 font-mono text-xs leading-6 text-[#173F35] dark:text-[#D9B978] ${
                  outputMode === 'minified' ? 'break-all whitespace-pre-wrap' : 'whitespace-pre'
                }`}
              >
                {outputJson}
              </pre>
            </div>
          ) : (
            <div className="flex h-[340px] flex-col items-center justify-center rounded-xl border border-dashed border-[#DCDDD3] bg-[#EDE9DF]/35 px-6 text-center dark:border-[#35463E] dark:bg-[#17231F]/50">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#E3EAE4] text-[#173F35] dark:bg-[#30483C] dark:text-[#D9B978]">
                <Braces className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-4 font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
                Formatted JSON output will appear here
              </p>
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
                Paste or write JSON in the left editor, or click Sample JSON,
                then choose Format JSON, Minify, or Validate.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
