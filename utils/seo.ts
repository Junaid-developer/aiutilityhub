import { TOOLS_DATA } from '../data/toolsData';
import { RoutePath } from '../types/navigation';
import { ParsedRoute } from './routing';

export const SITE_NAME = 'AI Utility Hub';
export const DEFAULT_OG_IMAGE_PATH = '/og-cover.jpg';

export const ALL_INDEXABLE_PATHS: RoutePath[] = [
  '/',
  '/tools',
  '/about',
  '/contact',
  '/privacy',
  '/terms',
  ...TOOLS_DATA.map((tool) => `/tools/${tool.id}` as RoutePath),
];

export interface SeoMetadata {
  title: string;
  description: string;
  robots: 'index, follow' | 'noindex, nofollow';
  canonicalPath: RoutePath | null;
  canonicalUrl: string | null;
  ogType: 'website';
  ogImageUrl: string;
  ogImageAlt: string;
  jsonLd: Record<string, unknown> | null;
}

export function normalizeSiteOrigin(
  rawOrigin?: string | null,
  options: { allowLocalhost?: boolean } = {}
): string {
  if (!rawOrigin) {
    return '';
  }
  const trimmed = rawOrigin.trim().replace(/\/+$/, '');
  if (!trimmed || trimmed === 'MY_APP_URL') {
    return '';
  }
  if (!/^https?:\/\/[^/\s<>"'&]+$/i.test(trimmed)) {
    return '';
  }
  if (!options.allowLocalhost) {
    try {
      const { hostname } = new URL(trimmed);
      const lower = hostname.toLowerCase();
      if (
        lower === 'localhost' ||
        lower === '127.0.0.1' ||
        lower === '0.0.0.0' ||
        lower === '[::1]' ||
        lower.endsWith('.local')
      ) {
        return '';
      }
    } catch {
      return '';
    }
  }
  return trimmed;
}

function resolveSiteUrl(path: string, cleanOrigin: string): string {
  return cleanOrigin ? `${cleanOrigin}${path}` : path;
}

export function getSeoMetadataForRoute(
  route: ParsedRoute,
  origin?: string,
  options: { allowLocalhost?: boolean } = {}
): SeoMetadata {
  const cleanOrigin = normalizeSiteOrigin(origin, options);
  const ogImageUrl = resolveSiteUrl(DEFAULT_OG_IMAGE_PATH, cleanOrigin);
  const ogImageAlt = `${SITE_NAME} — Browser-based image, PDF, developer, and writing tools`;

  if (route.kind === 'not-found') {
    return {
      title: `Page Not Found (404) — ${SITE_NAME}`,
      description:
        'The requested page or utility tool could not be found on AI Utility Hub. Return home or browse our full directory of free browser-based tools.',
      robots: 'noindex, nofollow',
      canonicalPath: null,
      canonicalUrl: null,
      ogType: 'website',
      ogImageUrl,
      ogImageAlt,
      jsonLd: null,
    };
  }

  const currentPath = route.path;
  const canonicalUrl = cleanOrigin ? `${cleanOrigin}${currentPath}` : null;
  const homeUrl = resolveSiteUrl('/', cleanOrigin);
  const toolsUrl = resolveSiteUrl('/tools', cleanOrigin);

  if (currentPath === '/') {
    return {
      title: `${SITE_NAME} — Free Browser-Based Online Tools`,
      description:
        'Free, privacy-first online tools for PDF editing, Word and PDF conversion, AI background removal, image compression, resizing, QR codes, and JSON.',
      robots: 'index, follow',
      canonicalPath: '/',
      canonicalUrl,
      ogType: 'website',
      ogImageUrl,
      ogImageAlt,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebSite',
            name: SITE_NAME,
            alternateName: 'Useful Tools. Simpler Work.',
            url: homeUrl,
            description:
              'Free browser-based utilities for image optimization, AI background editing, PDF workflows, Word and PDF conversion, JSON formatting, QR generation, and writing.',
          },
          {
            '@type': 'ItemList',
            name: 'Online Utility Tools',
            url: toolsUrl,
            numberOfItems: TOOLS_DATA.length,
            itemListElement: TOOLS_DATA.map((tool, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: tool.name,
              url: resolveSiteUrl(`/tools/${tool.id}`, cleanOrigin),
            })),
          },
        ],
      },
    };
  }

  if (currentPath === '/tools') {
    return {
      title: `All Online Tools — Image, PDF & Text | ${SITE_NAME}`,
      description:
        'Browse all ten browser-based utilities at AI Utility Hub—compress and resize images, edit PDFs, convert DOCX files, format JSON, and count words.',
      robots: 'index, follow',
      canonicalPath: '/tools',
      canonicalUrl,
      ogType: 'website',
      ogImageUrl,
      ogImageAlt,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'CollectionPage',
            name: `All Online Tools — ${SITE_NAME}`,
            url: toolsUrl,
            description:
              'Full catalog of free, local browser-based utilities for images, documents, structured data, and writing.',
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: homeUrl,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'All Tools',
                item: toolsUrl,
              },
            ],
          },
          {
            '@type': 'ItemList',
            name: 'AI Utility Hub Tool Directory',
            numberOfItems: TOOLS_DATA.length,
            itemListElement: TOOLS_DATA.map((tool, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name: tool.name,
              url: resolveSiteUrl(`/tools/${tool.id}`, cleanOrigin),
            })),
          },
        ],
      },
    };
  }

  if (currentPath === '/about') {
    return {
      title: `About ${SITE_NAME} — Calm, Private Online Tools`,
      description:
        'Learn how AI Utility Hub brings ten fast, clutter-free online utilities for images, documents, JSON, and writing into one privacy-focused workspace.',
      robots: 'index, follow',
      canonicalPath: '/about',
      canonicalUrl,
      ogType: 'website',
      ogImageUrl,
      ogImageAlt,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'AboutPage',
            name: `About ${SITE_NAME}`,
            url: resolveSiteUrl('/about', cleanOrigin),
            description:
              'About AI Utility Hub and our focus on clarity, consistent craft, and local browser-based utility workflows.',
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: homeUrl,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'About Us',
                item: resolveSiteUrl('/about', cleanOrigin),
              },
            ],
          },
        ],
      },
    };
  }

  if (currentPath === '/contact') {
    return {
      title: `Contact Us — ${SITE_NAME} Support & Feedback`,
      description:
        'Reach out to AI Utility Hub for tool questions, feature suggestions, or support regarding our browser-based image, PDF, developer, and text tools.',
      robots: 'index, follow',
      canonicalPath: '/contact',
      canonicalUrl,
      ogType: 'website',
      ogImageUrl,
      ogImageAlt,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'ContactPage',
            name: `Contact ${SITE_NAME}`,
            url: resolveSiteUrl('/contact', cleanOrigin),
            description:
              'Contact AI Utility Hub with questions, feedback, or tool suggestions.',
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: homeUrl,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Contact Us',
                item: resolveSiteUrl('/contact', cleanOrigin),
              },
            ],
          },
        ],
      },
    };
  }

  if (currentPath === '/privacy') {
    return {
      title: `Privacy Policy — ${SITE_NAME} Local Processing`,
      description:
        'Read the AI Utility Hub Privacy Policy covering browser storage preferences, local document and image processing, and cached AI model assets.',
      robots: 'index, follow',
      canonicalPath: '/privacy',
      canonicalUrl,
      ogType: 'website',
      ogImageUrl,
      ogImageAlt,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            name: `Privacy Policy — ${SITE_NAME}`,
            url: resolveSiteUrl('/privacy', cleanOrigin),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: homeUrl,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Privacy Policy',
                item: resolveSiteUrl('/privacy', cleanOrigin),
              },
            ],
          },
        ],
      },
    };
  }

  if (currentPath === '/terms') {
    return {
      title: `Terms & Conditions — ${SITE_NAME}`,
      description:
        'Review the Terms and Conditions governing access to and use of the AI Utility Hub website and all ten browser-based digital utility tools.',
      robots: 'index, follow',
      canonicalPath: '/terms',
      canonicalUrl,
      ogType: 'website',
      ogImageUrl,
      ogImageAlt,
      jsonLd: {
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            name: `Terms & Conditions — ${SITE_NAME}`,
            url: resolveSiteUrl('/terms', cleanOrigin),
          },
          {
            '@type': 'BreadcrumbList',
            itemListElement: [
              {
                '@type': 'ListItem',
                position: 1,
                name: 'Home',
                item: homeUrl,
              },
              {
                '@type': 'ListItem',
                position: 2,
                name: 'Terms & Conditions',
                item: resolveSiteUrl('/terms', cleanOrigin),
              },
            ],
          },
        ],
      },
    };
  }

  const slug = currentPath.slice('/tools/'.length);
  const tool = TOOLS_DATA.find((item) => item.id === slug);
  if (!tool) {
    return getSeoMetadataForRoute({ kind: 'not-found', rawPath: currentPath }, origin);
  }

  const toolUrl = resolveSiteUrl(currentPath, cleanOrigin);
  return {
    title: tool.metaTitle,
    description: tool.metaDescription,
    robots: 'index, follow',
    canonicalPath: currentPath,
    canonicalUrl,
    ogType: 'website',
    ogImageUrl,
    ogImageAlt: `${tool.name} — ${SITE_NAME}`,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebApplication',
          name: tool.name,
          url: toolUrl,
          description: tool.metaDescription,
          applicationCategory: 'UtilitiesApplication',
          operatingSystem: 'Any',
          browserRequirements: 'Requires JavaScript and a modern web browser',
          offers: {
            '@type': 'Offer',
            price: '0',
            priceCurrency: 'USD',
          },
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            {
              '@type': 'ListItem',
              position: 1,
              name: 'Home',
              item: homeUrl,
            },
            {
              '@type': 'ListItem',
              position: 2,
              name: 'All Tools',
              item: toolsUrl,
            },
            {
              '@type': 'ListItem',
              position: 3,
              name: tool.name,
              item: toolUrl,
            },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: tool.faqs.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer,
            },
          })),
        },
      ],
    },
  };
}

function upsertMetaTag(
  attrName: 'name' | 'property',
  attrValue: string,
  content: string
): void {
  let meta = document.head.querySelector<HTMLMetaElement>(
    `meta[${attrName}="${attrValue}"]`
  );
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attrName, attrValue);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function removeMetaTag(attrName: 'name' | 'property', attrValue: string): void {
  document.head
    .querySelector<HTMLMetaElement>(`meta[${attrName}="${attrValue}"]`)
    ?.remove();
}

function upsertCanonicalLink(href: string | null): void {
  const existing = document.head.querySelector<HTMLLinkElement>(
    'link[rel="canonical"]'
  );
  if (!href) {
    existing?.remove();
    return;
  }
  if (existing) {
    existing.setAttribute('href', href);
    return;
  }
  const link = document.createElement('link');
  link.setAttribute('rel', 'canonical');
  link.setAttribute('href', href);
  document.head.appendChild(link);
}

function upsertJsonLdScript(data: Record<string, unknown> | null): void {
  const existing = document.head.querySelector<HTMLScriptElement>(
    'script#seo-json-ld[type="application/ld+json"]'
  );
  if (!data) {
    existing?.remove();
    return;
  }
  const serialized = JSON.stringify(data);
  if (existing) {
    existing.textContent = serialized;
    return;
  }
  const script = document.createElement('script');
  script.id = 'seo-json-ld';
  script.type = 'application/ld+json';
  script.textContent = serialized;
  document.head.appendChild(script);
}

export function applySeoMetadataToDocument(route: ParsedRoute): void {
  if (typeof document === 'undefined') {
    return;
  }
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const seo = getSeoMetadataForRoute(route, origin, { allowLocalhost: true });

  document.title = seo.title;
  upsertMetaTag('name', 'description', seo.description);
  upsertMetaTag('name', 'robots', seo.robots);

  upsertMetaTag('property', 'og:type', seo.ogType);
  upsertMetaTag('property', 'og:site_name', SITE_NAME);
  upsertMetaTag('property', 'og:title', seo.title);
  upsertMetaTag('property', 'og:description', seo.description);
  upsertMetaTag('property', 'og:image', seo.ogImageUrl);
  upsertMetaTag('property', 'og:image:alt', seo.ogImageAlt);

  if (seo.canonicalUrl) {
    upsertMetaTag('property', 'og:url', seo.canonicalUrl);
  } else {
    removeMetaTag('property', 'og:url');
  }

  upsertMetaTag('name', 'twitter:card', 'summary_large_image');
  upsertMetaTag('name', 'twitter:title', seo.title);
  upsertMetaTag('name', 'twitter:description', seo.description);
  upsertMetaTag('name', 'twitter:image', seo.ogImageUrl);

  upsertCanonicalLink(seo.canonicalUrl);
  upsertJsonLdScript(seo.jsonLd);
}
