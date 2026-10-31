import { Component } from 'react';
import { AppError, toAppError } from '../core/errors.js';
import ErrorNotice from './ErrorNotice.jsx';

/** Catches render errors so one broken tool never takes the whole app down. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    const e = toAppError(error);
    return { error: new AppError('UNKNOWN', { message: 'This screen hit an unexpected problem.', detail: e.detail }) };
  }

  componentDidCatch(error, info) {
    console.error(`[${this.props.label ?? 'app'}]`, error, info.componentStack);
  }

  reset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="page">
        <ErrorNotice error={this.state.error} onRetry={this.reset} retryLabel={this.props.retryLabel ?? 'Reload'} />
      </div>
    );
  }
}
