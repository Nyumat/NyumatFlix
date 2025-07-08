"use client";

import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Error Boundary for catching Suspense and other React errors
 * Based on React documentation standard implementation
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static defaultProps = {
    fallback: (
      <div className="mx-4 md:mx-8 mb-8">
        <div className="text-red-500 text-sm">
          Something went wrong. Please try refreshing the page.
        </div>
      </div>
    ),
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error to console or error reporting service
    console.error("ErrorBoundary caught an error:", error, errorInfo);

    // Call onError prop if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI or default
      return this.props.fallback;
    }

    return this.props.children;
  }
}
