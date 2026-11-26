import { AlertTriangle, ArrowLeft, Layers, RotateCw } from 'lucide-react';
import { Component, ErrorInfo, ReactNode } from 'react';
import { RoutePath } from '../types/navigation';

interface ErrorBoundaryProps {
  children: ReactNode;
  scopeName?: string;
  resetKey?: string;
  onNavigate?: (path: RoutePath) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: null,
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected rendering error occurred.',
    };
  }

  public componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      `[AI Utility Hub] ErrorBoundary caught error in ${
        this.props.scopeName ?? 'application'
      }:`,
      error,
      info.componentStack
    );
  }

  public componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (
      this.state.hasError &&
      this.props.resetKey !== undefined &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, errorMessage: null });
  };

  public render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isChunkLoadError =
      this.state.errorMessage?.toLowerCase().includes('failed to fetch') ||
      this.state.errorMessage?.toLowerCase().includes('loading chunk') ||
      this.state.errorMessage?.toLowerCase().includes('dynamically imported module');

    return (
      <div
        role="alert"
        className="mx-auto my-8 max-w-2xl rounded-[18px] border border-[#DCDDD3] bg-white p-6 text-center shadow-[0_2px_10px_-3px_rgba(23,63,53,0.06)] sm:p-10 dark:border-[#35463E] dark:bg-[#24332C] dark:shadow-[0_2px_10px_-3px_rgba(0,0,0,0.24)]"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#E3EAE4] text-[#173F35] dark:bg-[#30483C] dark:text-[#D9B978]">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>

        <p className="mt-4 font-mono text-xs font-semibold tracking-wider text-[#7D5C23] uppercase dark:text-[#D9B978]">
          Workspace Recovery
        </p>

        <h2 className="mt-1.5 font-display text-xl font-bold text-[#252B28] sm:text-2xl dark:text-[#F2F0E9]">
          Unable to load {this.props.scopeName ?? 'this workspace'}
        </h2>

        <p className="mx-auto mt-2.5 max-w-lg text-sm leading-relaxed text-[#56615B] dark:text-[#B9C5BD]">
          {isChunkLoadError
            ? 'A required browser module could not be fetched. Check your connection and click Retry Loading below.'
            : 'Something unexpected interrupted this view. Your local browser storage was not cleared, and you can retry or switch to another utility.'}
        </p>

        {this.state.errorMessage && (
          <p className="mx-auto mt-3 max-w-lg rounded-lg border border-[#DCDDD3] bg-[#EDE9DF]/50 px-3 py-2 font-mono text-xs break-words text-[#56615B] dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#B9C5BD]">
            {this.state.errorMessage}
          </p>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#173F35] px-5 py-2.5 text-sm font-semibold text-[#F2F0E9] transition-colors hover:bg-[#173F35]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#C49A58] dark:bg-[#315D4D] dark:hover:bg-[#315D4D]/90"
          >
            <RotateCw className="h-4 w-4" aria-hidden="true" />
            <span>Retry Loading</span>
          </button>

          <a
            href="/tools"
            onClick={(e) => {
              if (this.props.onNavigate) {
                e.preventDefault();
                this.setState({ hasError: false, errorMessage: null });
                this.props.onNavigate('/tools');
              }
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCDDD3] bg-white px-5 py-2.5 text-sm font-semibold text-[#252B28] transition-colors hover:border-[#C49A58] dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#F2F0E9] dark:hover:border-[#D9B978]"
          >
            <Layers className="h-4 w-4" aria-hidden="true" />
            <span>Browse All Tools</span>
          </a>

          <a
            href="/"
            onClick={(e) => {
              if (this.props.onNavigate) {
                e.preventDefault();
                this.setState({ hasError: false, errorMessage: null });
                this.props.onNavigate('/');
              }
            }}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#DCDDD3] bg-white px-4 py-2.5 text-sm font-medium text-[#56615B] transition-colors hover:border-[#C49A58] hover:text-[#252B28] dark:border-[#35463E] dark:bg-[#17231F] dark:text-[#B9C5BD] dark:hover:text-[#F2F0E9]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Home</span>
          </a>
        </div>
      </div>
    );
  }
}
