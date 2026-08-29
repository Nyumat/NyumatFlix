"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

type PlaybackErrorBoundaryProps = {
  children: ReactNode;
  onClose?: () => void;
  onRetry?: () => void;
};

type PlaybackErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export class PlaybackErrorBoundary extends Component<
  PlaybackErrorBoundaryProps,
  PlaybackErrorBoundaryState
> {
  state: PlaybackErrorBoundaryState = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): PlaybackErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || "Playback failed unexpectedly",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[PlaybackErrorBoundary]", error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, message: "" });
    this.props.onRetry?.();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/95 px-6">
        <div className="max-w-md space-y-4 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-destructive/70" />
          <p className="text-lg font-medium text-white">Playback error</p>
          <p className="text-sm text-white/60">{this.state.message}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button type="button" onClick={this.handleRetry}>
              Try again
            </Button>
            {this.props.onClose ? (
              <Button
                type="button"
                variant="secondary"
                onClick={this.props.onClose}
              >
                Close player
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
}
