import { ArrowLeft, Compass } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Footer } from './components/Footer';
import { Navbar } from './components/Navbar';
import { useTheme } from './hooks/useTheme';
import { AboutPage } from './pages/AboutPage';
import { AllToolsPage } from './pages/AllToolsPage';
import { ContactPage } from './pages/ContactPage';
import { HomePage } from './pages/HomePage';
import { LegalPage } from './pages/LegalPage';
import { ToolDetailPage } from './pages/ToolDetailPage';
import { RoutePath, ToolSlug } from './types/navigation';
import { ParsedRoute, parseLocationToRoute } from './utils/routing';
import { applySeoMetadataToDocument } from './utils/seo';

function getCurrentRoute(): ParsedRoute {
  if (typeof window === 'undefined') {
    return { kind: 'route', path: '/' };
  }
  return parseLocationToRoute(window.location.hash, window.location.pathname);
}

export default function App() {
  const { theme, toggleTheme } = useTheme();
  const [route, setRoute] = useState<ParsedRoute>(getCurrentRoute);
  const [toolsSearchQuery, setToolsSearchQuery] = useState('');

  const navigate = useCallback(
    (path: RoutePath, initialSearch?: string) => {
      if (typeof initialSearch === 'string') {
        setToolsSearchQuery(initialSearch);
      } else if (path !== '/tools') {
        setToolsSearchQuery('');
      }
      setRoute({ kind: 'route', path });
      if (typeof window !== 'undefined') {
        if (window.location.pathname !== path || window.location.hash !== '') {
          window.history.pushState(null, '', path);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    []
  );

  useEffect(() => {
    // Seamlessly upgrade legacy #/... URLs to clean crawlable paths
    if (
      typeof window !== 'undefined' &&
      window.location.hash.startsWith('#/') &&
      route.kind === 'route'
    ) {
      window.history.replaceState(null, '', route.path);
    }
  }, [route]);

  useEffect(() => {
    const onLocationChange = () => {
      setRoute(getCurrentRoute());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onLocationChange);
    window.addEventListener('popstate', onLocationChange);
    return () => {
      window.removeEventListener('hashchange', onLocationChange);
      window.removeEventListener('popstate', onLocationChange);
    };
  }, []);

  useEffect(() => {
    applySeoMetadataToDocument(route);
  }, [route]);

  const renderPage = () => {
    if (route.kind === 'not-found') {
      return (
        <section className="py-16 sm:py-24">
          <div className="mx-auto max-w-xl px-4 text-center sm:px-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E3EAE4] text-[#173F35] dark:bg-[#30483C] dark:text-[#D9B978]">
              <Compass className="h-7 w-7" aria-hidden="true" />
            </div>
            <p className="mt-6 font-mono text-xs font-semibold tracking-wider text-[#7D5C23] uppercase dark:text-[#D9B978]">
              404 · Page Not Found
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-[#252B28] sm:text-4xl dark:text-[#F2F0E9]">
              We couldn&apos;t find that page
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#56615B] sm:text-base dark:text-[#B9C5BD]">
              No utility or page matches{' '}
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-xs text-[#252B28] dark:bg-[#24332C] dark:text-[#F2F0E9]">
                {route.rawPath}
              </code>
              . Use the links below to return to the workspace.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/');
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 dark:bg-[#315D4D]"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span>Back to Home</span>
              </a>
              <a
                href="/tools"
                onClick={(e) => {
                  e.preventDefault();
                  navigate('/tools');
                }}
                className="inline-flex min-h-11 items-center rounded-lg border border-[#DCDDD3] bg-white px-5 py-2.5 text-sm font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9]"
              >
                Explore All Tools
              </a>
            </div>
          </div>
        </section>
      );
    }

    const currentPath = route.path;
    if (currentPath === '/') {
      return <HomePage onNavigate={navigate} />;
    }
    if (currentPath === '/tools') {
      return (
        <AllToolsPage
          onNavigate={(path) => navigate(path)}
          initialSearch={toolsSearchQuery}
        />
      );
    }
    if (currentPath === '/about') {
      return <AboutPage onNavigate={(path) => navigate(path)} />;
    }
    if (currentPath === '/contact') {
      return <ContactPage />;
    }
    if (currentPath === '/privacy') {
      return <LegalPage type="privacy" onNavigate={(path) => navigate(path)} />;
    }
    if (currentPath === '/terms') {
      return <LegalPage type="terms" onNavigate={(path) => navigate(path)} />;
    }
    if (currentPath.startsWith('/tools/')) {
      const slug = currentPath.slice('/tools/'.length) as ToolSlug;
      return (
        <ToolDetailPage
          key={slug}
          toolId={slug}
          onNavigate={(path) => navigate(path)}
        />
      );
    }
    return <HomePage onNavigate={navigate} />;
  };

  const routeResetKey =
    route.kind === 'route' ? route.path : `404:${route.rawPath}`;

  return (
    <div className="flex min-h-screen flex-col bg-[#EDE9DF] text-[#252B28] dark:bg-[#17231F] dark:text-[#F2F0E9]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-[#173F35] focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-[#F2F0E9] focus:shadow-lg focus:outline-2 focus:outline-offset-2 focus:outline-[#C49A58] dark:focus:bg-[#315D4D]"
      >
        Skip to main content
      </a>
      <Navbar
        currentPath={route.kind === 'route' ? route.path : null}
        onNavigate={(path) => navigate(path)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        <ErrorBoundary
          scopeName="this page"
          resetKey={routeResetKey}
          onNavigate={(path) => navigate(path)}
        >
          {renderPage()}
        </ErrorBoundary>
      </main>
      <Footer onNavigate={(path) => navigate(path)} />
    </div>
  );
}
