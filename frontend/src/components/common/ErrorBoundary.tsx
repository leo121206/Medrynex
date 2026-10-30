import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in React component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F2E7D5] flex items-center justify-center p-6 font-sans">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-[#DDE5DA] max-w-lg w-full text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#C85C5C]/15 text-[#C85C5C] flex items-center justify-center mx-auto font-bold text-xl">
              ⚠️
            </div>
            <h2 className="text-xl font-bold text-[#26352A]">Something went wrong</h2>
            <p className="text-xs text-[#66736A]">
              {this.state.error?.message || 'An unexpected rendering error occurred in this view.'}
            </p>
            <div className="flex gap-3 justify-center pt-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-[#47634C] text-white rounded-xl text-xs font-bold hover:bg-[#384f3c] transition-colors"
              >
                Reload Page
              </button>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.href = '/patient/dashboard';
                }}
                className="px-4 py-2 bg-[#E7F0E4] text-[#26352A] rounded-xl text-xs font-bold hover:bg-[#d6e5d2] transition-colors"
              >
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
