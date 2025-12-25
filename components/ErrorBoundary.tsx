
import React from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component to catch rendering errors in the component tree.
 */
/* Fix: Explicitly extend React.Component to ensure base class members like setState and props are correctly recognized by the TypeScript compiler */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  /**
   * Static method to update state when an error occurs during rendering.
   */
  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  /**
   * Lifecycle method to log error details.
   */
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  /**
   * Resets the error state to allow the application to attempt re-rendering.
   */
  public handleReload = () => {
    /* Fix: setState is a valid member inherited from React.Component */
    this.setState({ hasError: false, error: null });
  }

  public render() {
    /* Fix: Access state through this context as inherited from React.Component */
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 p-4">
          <div className="bg-white dark:bg-slate-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-slate-200 dark:border-slate-700">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
              <AlertTriangle size={32} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Something went wrong</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
              The application encountered an unexpected error.
            </p>
            
            {this.state.error && (
                <div className="bg-slate-100 dark:bg-slate-950 p-3 rounded-lg text-left text-xs font-mono text-red-600 dark:text-red-400 overflow-auto max-h-32 mb-6">
                    {this.state.error.toString()}
                </div>
            )}

            <button 
              onClick={this.handleReload}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white font-semibold rounded-xl transition-all w-full"
            >
              <RefreshCw size={18} />
              Try Again
            </button>
          </div>
        </div>
      );
    }

    /* Fix: Access children prop via this.props inherited from React.Component */
    return this.props.children;
  }
}
