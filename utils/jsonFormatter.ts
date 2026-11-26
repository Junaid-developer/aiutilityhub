export interface JsonErrorInfo {
  message: string;
  line?: number;
  column?: number;
}

export type JsonFormatResult =
  | { ok: true; output: string }
  | { ok: false; error: JsonErrorInfo };

export type JsonValidateResult =
  | { ok: true; summary: string }
  | { ok: false; error: JsonErrorInfo };

function computeLineAndColumn(
  input: string,
  position: number
): { line: number; column: number } {
  const clamped = Math.max(0, Math.min(position, input.length));
  const upToPos = input.slice(0, clamped);
  const lines = upToPos.split('\n');
  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1,
  };
}

export function extractJsonError(input: string, err: unknown): JsonErrorInfo {
  const rawMessage =
    err instanceof Error ? err.message : 'Invalid JSON syntax.';

  // Check for explicit "line X column Y" (modern V8, Firefox)
  const lineColMatch = rawMessage.match(/line\s+(\d+)\s+column\s+(\d+)/i);
  if (lineColMatch) {
    const line = Number(lineColMatch[1]);
    const column = Number(lineColMatch[2]);
    return {
      message: rawMessage,
      line,
      column,
    };
  }

  // Check for "at position N" (V8 / Safari variants)
  const posMatch = rawMessage.match(/position\s+(\d+)/i);
  if (posMatch) {
    const pos = Number(posMatch[1]);
    const { line, column } = computeLineAndColumn(input, pos);
    return {
      message: rawMessage,
      line,
      column,
    };
  }

  // Fallback for modern V8 messages like:
  // `Unexpected token '}', ..."broken": \n}" is not valid JSON`
  const snippetMatch = rawMessage.match(
    /,\s*(?:"\.\.\.|\.\.\.|")([\s\S]+)"\s+is not valid JSON$/
  );
  if (snippetMatch) {
    const snippet = snippetMatch[1];
    const matchIndex = input.indexOf(snippet);
    if (matchIndex !== -1) {
      const approxPos = Math.max(0, matchIndex + snippet.length - 1);
      const { line, column } = computeLineAndColumn(input, approxPos);
      return {
        message: rawMessage,
        line,
        column,
      };
    }
  }

  return { message: rawMessage };
}

function describeJsonRoot(value: unknown): string {
  if (Array.isArray(value)) {
    return `Valid JSON array (${value.length} ${
      value.length === 1 ? 'item' : 'items'
    }).`;
  }
  if (value !== null && typeof value === 'object') {
    const keyCount = Object.keys(value).length;
    return `Valid JSON object (${keyCount} top-level ${
      keyCount === 1 ? 'key' : 'keys'
    }).`;
  }
  return `Valid JSON ${typeof value} value.`;
}

export function formatJson(
  input: string,
  indentSpaces: 2 | 4 = 2
): JsonFormatResult {
  if (!input.trim()) {
    return {
      ok: false,
      error: { message: 'Please enter or paste JSON before formatting.' },
    };
  }
  try {
    const parsed = JSON.parse(input);
    return {
      ok: true,
      output: JSON.stringify(parsed, null, indentSpaces),
    };
  } catch (err) {
    return {
      ok: false,
      error: extractJsonError(input, err),
    };
  }
}

export function minifyJson(input: string): JsonFormatResult {
  if (!input.trim()) {
    return {
      ok: false,
      error: { message: 'Please enter or paste JSON before minifying.' },
    };
  }
  try {
    const parsed = JSON.parse(input);
    return {
      ok: true,
      output: JSON.stringify(parsed),
    };
  } catch (err) {
    return {
      ok: false,
      error: extractJsonError(input, err),
    };
  }
}

export function validateJson(input: string): JsonValidateResult {
  if (!input.trim()) {
    return {
      ok: false,
      error: { message: 'Please enter or paste JSON to validate.' },
    };
  }
  try {
    const parsed = JSON.parse(input);
    return {
      ok: true,
      summary: describeJsonRoot(parsed),
    };
  } catch (err) {
    return {
      ok: false,
      error: extractJsonError(input, err),
    };
  }
}
