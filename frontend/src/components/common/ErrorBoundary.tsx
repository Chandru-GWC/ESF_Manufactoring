import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** Optional label shown in the fallback (e.g. the area that failed). */
  scope?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Catches render-time exceptions anywhere below it so a single failing view can
 * never leave the user with a blank white page.
 * Uses only inline styles so it still renders if the stylesheet failed to load.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[EHS] Unhandled UI error', error, info.componentStack);
  }

  private handleRetry = () => this.setState({ error: null });

  private handleReload = () => window.location.reload();

  private handleHome = () => {
    window.location.assign('/');
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const isChunkError = /dynamically imported module|Failed to fetch|Outdated Optimize Dep|Loading chunk/i.test(
      error.message || ''
    );

    return (
      <div
        role="alert"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: '#F7F8FA',
          color: '#111827',
          fontFamily: 'Manrope, system-ui, -apple-system, "Segoe UI", sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            background: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: 16,
            padding: 28,
            boxShadow: '0 4px 12px -2px rgba(15,23,42,0.06)',
          }}
        >
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>
            {this.props.scope ? `${this.props.scope} couldn't load` : 'Something went wrong'}
          </h1>
          <p style={{ margin: '10px 0 0', fontSize: 13, lineHeight: 1.6, color: '#475569' }}>
            {isChunkError
              ? 'A part of the application failed to load, usually after an update or a dropped connection. Reloading normally fixes it.'
              : 'The screen hit an unexpected error. Your data is safe — nothing was changed. Try again, or reload the page.'}
          </p>
          <pre
            style={{
              margin: '14px 0 0',
              padding: 10,
              fontSize: 11,
              lineHeight: 1.5,
              background: '#F1F5F9',
              borderRadius: 8,
              color: '#991B1B',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 120,
              overflow: 'auto',
            }}
          >
            {error.message || String(error)}
          </pre>
          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button type="button" onClick={this.handleRetry} style={btn(true)}>
              Try again
            </button>
            <button type="button" onClick={this.handleReload} style={btn(false)}>
              Reload page
            </button>
            <button type="button" onClick={this.handleHome} style={btn(false)}>
              Go to start
            </button>
          </div>
          <p style={{ margin: '16px 0 0', fontSize: 11, color: '#64748B' }}>
            If this keeps happening in development, stop the dev server, delete{' '}
            <code>node_modules/.vite</code>, and restart with <code>npx vite --force</code>.
          </p>
        </div>
      </div>
    );
  }
}

function btn(primary: boolean): React.CSSProperties {
  return {
    height: 36,
    padding: '0 16px',
    borderRadius: 8,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: primary ? '1px solid #1D4ED8' : '1px solid #CBD5E1',
    background: primary ? '#1D4ED8' : '#FFFFFF',
    color: primary ? '#FFFFFF' : '#111827',
  };
}
