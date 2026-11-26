import { TOOLS_DATA } from '../data/toolsData';
import { RoutePath, ToolSlug } from '../types/navigation';

const VALID_TOOL_SLUGS = new Set<string>(TOOLS_DATA.map((t) => t.id));

export type ParsedRoute =
  | { kind: 'route'; path: RoutePath }
  | { kind: 'not-found'; rawPath: string };

export function parseLocationToRoute(
  hash: string,
  pathname = '/'
): ParsedRoute {
  const hashRaw = hash.replace(/^#/, '').trim();
  const hashRoute = hashRaw.startsWith('/') ? hashRaw : '';
  const pathRaw = pathname.trim();
  const rawCandidate = hashRoute || pathRaw || '/';
  const normalized =
    rawCandidate.length > 1 ? rawCandidate.replace(/\/+$/, '') : rawCandidate;

  if (!normalized || normalized === '/') {
    return { kind: 'route', path: '/' };
  }
  if (
    normalized === '/tools' ||
    normalized === '/about' ||
    normalized === '/contact' ||
    normalized === '/privacy' ||
    normalized === '/terms'
  ) {
    return { kind: 'route', path: normalized };
  }
  if (normalized.startsWith('/tools/')) {
    const slug = normalized.slice('/tools/'.length);
    if (VALID_TOOL_SLUGS.has(slug)) {
      return { kind: 'route', path: `/tools/${slug as ToolSlug}` };
    }
  }
  return { kind: 'not-found', rawPath: normalized };
}
