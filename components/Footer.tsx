import { TOOLS_DATA } from '../data/toolsData';
import { RoutePath } from '../types/navigation';
import { BrandLogo } from './BrandLogo';

interface FooterProps {
  onNavigate: (path: RoutePath) => void;
}

export function Footer({ onNavigate }: FooterProps) {
  const handleLink = (e: React.MouseEvent, path: RoutePath) => {
    e.preventDefault();
    onNavigate(path);
  };

  return (
    <footer className="border-t border-[#DCDDD3] bg-[#EDE9DF] dark:border-[#35463E] dark:bg-[#17231F]">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-12">
          {/* Brand Column */}
          <div className="sm:col-span-2 lg:col-span-4">
            <a
              href="/"
              onClick={(e) => handleLink(e, '/')}
              className="inline-flex items-center gap-2.5 rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#C49A58]"
            >
              <BrandLogo className="h-8 w-8 shrink-0" />
              <span className="font-display text-lg font-bold tracking-tight text-[#173F35] dark:text-[#F2F0E9]">
                AI Utility Hub
              </span>
            </a>
            <p className="mt-3 text-sm font-medium text-[#173F35] dark:text-[#D9B978]">
              Useful Tools. Simpler Work.
            </p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
              Practical everyday utilities for images, documents, structured
              data, and writing—organized inside one calm workspace.
            </p>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2">
            <h2 className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
              Quick Links
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a
                  href="/"
                  onClick={(e) => handleLink(e, '/')}
                  className="text-[#56615B] transition-colors hover:text-[#173F35] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]"
                >
                  Home
                </a>
              </li>
              <li>
                <a
                  href="/tools"
                  onClick={(e) => handleLink(e, '/tools')}
                  className="text-[#56615B] transition-colors hover:text-[#173F35] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]"
                >
                  All Tools
                </a>
              </li>
              <li>
                <a
                  href="/about"
                  onClick={(e) => handleLink(e, '/about')}
                  className="text-[#56615B] transition-colors hover:text-[#173F35] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]"
                >
                  About Us
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => handleLink(e, '/contact')}
                  className="text-[#56615B] transition-colors hover:text-[#173F35] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]"
                >
                  Contact Us
                </a>
              </li>
            </ul>
          </div>

          {/* All Tools */}
          <div className="sm:col-span-2 lg:col-span-4">
            <h2 className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
              All Tools
            </h2>
            <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2">
              {TOOLS_DATA.map((tool) => (
                <li key={tool.id}>
                  <a
                    href={`/tools/${tool.id}`}
                    onClick={(e) => handleLink(e, `/tools/${tool.id}`)}
                    className="text-[#56615B] transition-colors hover:text-[#173F35] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]"
                  >
                    {tool.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="lg:col-span-2">
            <h2 className="font-display text-sm font-semibold text-[#252B28] dark:text-[#F2F0E9]">
              Legal
            </h2>
            <ul className="mt-4 space-y-2.5 text-sm">
              <li>
                <a
                  href="/privacy"
                  onClick={(e) => handleLink(e, '/privacy')}
                  className="text-[#56615B] transition-colors hover:text-[#173F35] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  onClick={(e) => handleLink(e, '/terms')}
                  className="text-[#56615B] transition-colors hover:text-[#173F35] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]"
                >
                  Terms &amp; Conditions
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-[#DCDDD3] pt-6 text-xs text-[#56615B] sm:flex-row sm:items-center dark:border-[#35463E] dark:text-[#B9C5BD]">
          <p>&copy; 2026 AI Utility Hub. All rights reserved.</p>
          <p>Useful Tools. Simpler Work.</p>
        </div>
      </div>
    </footer>
  );
}
