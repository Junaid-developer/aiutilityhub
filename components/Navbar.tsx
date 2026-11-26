import { Menu, Moon, Sun, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ThemeMode } from '../hooks/useTheme';
import { RoutePath } from '../types/navigation';
import { BrandLogo } from './BrandLogo';

interface NavbarProps {
  currentPath: RoutePath | null;
  onNavigate: (path: RoutePath) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

const NAV_LINKS: { label: string; path: RoutePath }[] = [
  { label: 'Home', path: '/' },
  { label: 'All Tools', path: '/tools' },
  { label: 'About Us', path: '/about' },
  { label: 'Contact Us', path: '/contact' },
];

export function Navbar({
  currentPath,
  onNavigate,
  theme,
  onToggleTheme,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isLinkActive = (path: RoutePath) => {
    if (!currentPath) return false;
    if (path === '/tools') {
      return currentPath === '/tools' || currentPath.startsWith('/tools/');
    }
    return currentPath === path;
  };

  const handleNavClick = (path: RoutePath) => {
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#DCDDD3] bg-[#EDE9DF]/95 backdrop-blur-sm dark:border-[#35463E] dark:bg-[#17231F]/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6 md:grid md:grid-cols-[1fr_auto_1fr] lg:px-8">
        {/* Left: Brand Logo & Name */}
        <div className="flex items-center justify-start">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              handleNavClick('/');
            }}
            className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C49A58]"
          >
            <BrandLogo className="h-8 w-8 shrink-0" />
            <span className="font-display text-lg font-bold tracking-tight text-[#173F35] dark:text-[#F2F0E9]">
              AI Utility Hub
            </span>
          </a>
        </div>

        {/* Center: Desktop Navigation Links */}
        <nav
          aria-label="Main navigation"
          className="hidden items-center justify-center gap-8 md:flex"
        >
          {NAV_LINKS.map((link) => {
            const active = isLinkActive(link.path);
            return (
              <a
                key={link.path}
                href={link.path}
                onClick={(e) => {
                  e.preventDefault();
                  handleNavClick(link.path);
                }}
                aria-current={active ? 'page' : undefined}
                className={`group relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C49A58] ${
                  active
                    ? 'text-[#173F35] dark:text-[#F2F0E9]'
                    : 'text-[#56615B] hover:text-[#252B28] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]'
                }`}
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-[#C49A58] transition-opacity duration-150 dark:bg-[#D9B978] ${
                    active ? 'opacity-100' : 'opacity-0 group-hover:opacity-45'
                  }`}
                />
              </a>
            );
          })}
        </nav>

        {/* Right: Theme Toggle & Mobile Menu Button */}
        <div className="flex shrink-0 items-center justify-end gap-2">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            title={
              theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#DCDDD3] bg-white text-[#252B28] transition-colors duration-150 hover:border-[#C49A58] hover:text-[#173F35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9] dark:hover:border-[#D9B978] dark:hover:text-[#D9B978]"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[#DCDDD3] bg-white text-[#252B28] transition-colors duration-150 hover:border-[#C49A58] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] md:hidden dark:border-[#35463E] dark:bg-[#24332C] dark:text-[#F2F0E9]"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <nav
          id="mobile-navigation"
          aria-label="Mobile navigation"
          className="border-t border-[#DCDDD3] bg-[#EDE9DF] px-4 py-3 md:hidden dark:border-[#35463E] dark:bg-[#17231F]"
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {NAV_LINKS.map((link) => {
              const active = isLinkActive(link.path);
              return (
                <a
                  key={link.path}
                  href={link.path}
                  onClick={(e) => {
                    e.preventDefault();
                    handleNavClick(link.path);
                  }}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 items-center rounded-lg px-3.5 text-sm font-medium transition-colors duration-150 ${
                    active
                      ? 'bg-[#173F35] text-[#F2F0E9] dark:bg-[#315D4D] dark:text-[#F2F0E9]'
                      : 'text-[#252B28] hover:bg-white/75 dark:text-[#F2F0E9] dark:hover:bg-[#24332C]'
                  }`}
                >
                  {link.label}
                </a>
              );
            })}
          </div>
        </nav>
      )}
    </header>
  );
}
