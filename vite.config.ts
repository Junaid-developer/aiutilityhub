import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import {
  ALL_INDEXABLE_PATHS,
  getSeoMetadataForRoute,
  normalizeSiteOrigin,
} from './src/utils/seo';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

function renderRouteHtml(
  templateHtml: string,
  routePath: (typeof ALL_INDEXABLE_PATHS)[number],
  siteOrigin: string
): string {
  const seo = getSeoMetadataForRoute(
    {kind: 'route', path: routePath},
    siteOrigin
  );
  let html = templateHtml;

  html = html.replace(
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(seo.title)}</title>`
  );
  html = html.replace(
    /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/i,
    `<meta name="description" content="${escapeHtml(seo.description)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:title"\s+content="[\s\S]*?"\s*\/>/i,
    `<meta property="og:title" content="${escapeHtml(seo.title)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/>/i,
    `<meta property="og:description" content="${escapeHtml(seo.description)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image"\s+content="[\s\S]*?"\s*\/>/i,
    `<meta property="og:image" content="${escapeHtml(seo.ogImageUrl)}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image:alt"\s+content="[\s\S]*?"\s*\/>/i,
    `<meta property="og:image:alt" content="${escapeHtml(seo.ogImageAlt)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:title"\s+content="[\s\S]*?"\s*\/>/i,
    `<meta name="twitter:title" content="${escapeHtml(seo.title)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"\s+content="[\s\S]*?"\s*\/>/i,
    `<meta name="twitter:description" content="${escapeHtml(seo.description)}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:image"\s+content="[\s\S]*?"\s*\/>/i,
    `<meta name="twitter:image" content="${escapeHtml(seo.ogImageUrl)}" />`
  );

  if (seo.jsonLd) {
    html = html.replace(
      /<script id="seo-json-ld" type="application\/ld\+json">[\s\S]*?<\/script>/i,
      `<script id="seo-json-ld" type="application/ld+json">${escapeJsonLd(seo.jsonLd)}</script>`
    );
  }

  if (seo.canonicalUrl) {
    html = html.replace(
      '</head>',
      `    <link rel="canonical" href="${escapeHtml(seo.canonicalUrl)}" />\n    <meta property="og:url" content="${escapeHtml(seo.canonicalUrl)}" />\n  </head>`
    );
  }

  return html;
}

export default defineConfig(({mode}) => {
  const loadedEnv = loadEnv(mode, __dirname, '');
  const resolvedSiteOrigin = normalizeSiteOrigin(
    process.env.SITE_URL || loadedEnv.SITE_URL
  );
  return {
    worker: {
      format: 'es' as const,
    },
    plugins: [
      react(),
      tailwindcss(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
      // Emits route-specific static HTML shells (title, meta description, OG/Twitter, JSON-LD)
      // and optionally injects finalized SITE_URL into dist/sitemap.xml & dist/robots.txt.
      {
        name: 'seo-static-routes-and-sitemap',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const baseIndexPath = path.join(distDir, 'index.html');
          if (!fs.existsSync(baseIndexPath)) {
            return;
          }

          const siteOrigin = resolvedSiteOrigin;
          const baseHtml = fs.readFileSync(baseIndexPath, 'utf-8');

          for (const routePath of ALL_INDEXABLE_PATHS) {
            const renderedHtml = renderRouteHtml(baseHtml, routePath, siteOrigin);
            if (routePath === '/') {
              fs.writeFileSync(baseIndexPath, renderedHtml, 'utf-8');
            } else {
              const targetDir = path.join(distDir, routePath.slice(1));
              fs.mkdirSync(targetDir, {recursive: true});
              fs.writeFileSync(
                path.join(targetDir, 'index.html'),
                renderedHtml,
                'utf-8'
              );
            }
          }

          if (siteOrigin) {
            const sitemapPath = path.join(distDir, 'sitemap.xml');
            if (fs.existsSync(sitemapPath)) {
              const sitemap = fs.readFileSync(sitemapPath, 'utf-8');
              fs.writeFileSync(
                sitemapPath,
                sitemap.replace(/<loc>(\/[^<]*)<\/loc>/g, `<loc>${siteOrigin}$1</loc>`),
                'utf-8'
              );
            }

            const robotsPath = path.join(distDir, 'robots.txt');
            if (fs.existsSync(robotsPath)) {
              fs.writeFileSync(
                robotsPath,
                `User-agent: *\nAllow: /\n\nSitemap: ${siteOrigin}/sitemap.xml\n`,
                'utf-8'
              );
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
