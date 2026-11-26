export interface WordCounterStats {
  words: number;
  charactersWithSpaces: number;
  charactersWithoutSpaces: number;
  sentences: number;
  paragraphs: number;
  readingTimeLabel: string;
}

const WORDS_PER_MINUTE = 200;

/**
 * Analyzes input text locally and returns live word, character,
 * sentence, paragraph, and reading-time statistics.
 */
export function analyzeText(text: string): WordCounterStats {
  if (!text) {
    return {
      words: 0,
      charactersWithSpaces: 0,
      charactersWithoutSpaces: 0,
      sentences: 0,
      paragraphs: 0,
      readingTimeLabel: '0 min',
    };
  }

  const charactersWithSpaces = text.length;
  const charactersWithoutSpaces = text.replace(/\s/g, '').length;

  // Words: split on whitespace and em-dashes; keep contractions (don't) and
  // hyphenated compounds (well-known) as single word tokens, while stripping
  // surrounding punctuation so standalone symbols (e.g. "---", "&") don't count.
  const trimmed = text.trim();
  const words = trimmed
    ? trimmed.split(/[\s\u2014]+/).filter((token) => {
        const cleaned = token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
        return cleaned.length > 0 && /[\p{L}\p{N}]/u.test(cleaned);
      }).length
    : 0;

  // Sentences: mask internal dots inside numbers, versions, or domains (e.g. 3.14, example.com)
  // so they aren't mistaken for sentence boundaries, then count non-empty segments
  // terminated by sentence-ending punctuation (. ! ? …).
  let sentences = 0;
  if (words > 0) {
    const maskedInternalDots = text.replace(
      /(?<=[\p{L}\p{N}])\.(?=[\p{L}\p{N}])/gu,
      '_'
    );
    const sentenceMatches = maskedInternalDots.match(/[^.!?…]+[.!?…]+/gu) ?? [];
    sentences = sentenceMatches.filter((segment) =>
      /[\p{L}\p{N}]/u.test(segment)
    ).length;
  }

  // Paragraphs: non-empty text blocks separated by one or more blank lines.
  const paragraphs = trimmed
    ? trimmed
        .split(/\r?\n\s*\r?\n/)
        .filter((block) => block.trim().length > 0).length
    : 0;

  // Reading time: estimated at 200 words per minute.
  let readingTimeLabel = '0 min';
  if (words > 0 && words < WORDS_PER_MINUTE) {
    readingTimeLabel = '< 1 min';
  } else if (words >= WORDS_PER_MINUTE) {
    const minutes = Math.round(words / WORDS_PER_MINUTE);
    readingTimeLabel = `${minutes} min`;
  }

  return {
    words,
    charactersWithSpaces,
    charactersWithoutSpaces,
    sentences,
    paragraphs,
    readingTimeLabel,
  };
}
