'use client';

import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

/**
 * EditorErrorBoundary — catches render errors in the editor and shows a
 * recovery UI instead of a blank screen.
 */
export class EditorErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMessage: message };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('[EditorErrorBoundary] Render error:', error, info.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleDismiss = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-zinc-950 p-8 text-zinc-100">
        <div className="max-w-md text-center">
          <div className="mb-4 text-4xl">⚠️</div>
          <h2 className="mb-2 text-xl font-semibold">Something went wrong</h2>
          <p className="mb-4 text-sm text-zinc-400">
            The editor encountered an unexpected error. Your project data is safe.
          </p>
          {this.state.errorMessage && (
            <pre className="mb-4 max-h-32 overflow-auto rounded bg-zinc-900 p-3 text-left text-xs text-red-300">
              {this.state.errorMessage}
            </pre>
          )}
          <div className="flex justify-center gap-3">
            <button
              onClick={this.handleDismiss}
              className="rounded-md border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-800"
            >
              Try to continue
            </button>
            <button
              onClick={this.handleReload}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm hover:bg-purple-700"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
