import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,

  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-red-900/50 border border-red-500 text-red-300 p-6 rounded-lg shadow-lg text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Something went wrong.</h1>
            <p className="mb-4">
                A critical error occurred in the application. Please try refreshing the page.
            </p>
            {this.state.error && (
                <pre className="bg-gray-800 text-left p-4 rounded-md text-xs whitespace-pre-wrap overflow-auto">
                    {this.state.error.toString()}
                </pre>
            )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;