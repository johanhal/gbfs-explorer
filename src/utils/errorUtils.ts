/**
 * Utility functions for handling and formatting errors in a user-friendly way
 */

export interface FriendlyError {
  title: string;
  message: string;
  type: 'network' | 'server' | 'timeout' | 'data' | 'unknown';
}

/**
 * Convert technical error messages into user-friendly ones
 */
export function createFriendlyError(error: string | Error | null | undefined): FriendlyError {
  if (!error) {
    return {
      title: 'Service Unavailable',
      message: 'Unable to connect to this mobility service right now.',
      type: 'unknown'
    };
  }

  const errorText = typeof error === 'string' ? error : error.message || error.toString();
  const lowerError = errorText.toLowerCase();

  // Network/DNS errors
  if (lowerError.includes('name or service not known') || 
      lowerError.includes('nameresolutionerror') ||
      lowerError.includes('failed to resolve')) {
    return {
      title: 'Service Offline',
      message: 'This mobility service appears to be temporarily offline or has moved.',
      type: 'network'
    };
  }

  // Connection timeouts
  if (lowerError.includes('timeout') || 
      lowerError.includes('timed out') ||
      lowerError.includes('request timeout')) {
    return {
      title: 'Connection Timeout',
      message: 'The service is taking too long to respond. It may be experiencing high load.',
      type: 'timeout'
    };
  }

  // Connection refused/unreachable
  if (lowerError.includes('connection refused') ||
      lowerError.includes('connection reset') ||
      lowerError.includes('max retries exceeded')) {
    return {
      title: 'Connection Failed',
      message: 'Unable to reach this mobility service. It may be temporarily unavailable.',
      type: 'network'
    };
  }

  // HTTP errors
  if (lowerError.includes('404') || lowerError.includes('not found')) {
    return {
      title: 'Service Not Found',
      message: 'This mobility service endpoint no longer exists or has been moved.',
      type: 'server'
    };
  }

  if (lowerError.includes('500') || lowerError.includes('internal server error')) {
    return {
      title: 'Service Error',
      message: 'The mobility service is experiencing internal issues.',
      type: 'server'
    };
  }

  if (lowerError.includes('403') || lowerError.includes('forbidden')) {
    return {
      title: 'Access Denied',
      message: 'This mobility service has restricted access to its data.',
      type: 'server'
    };
  }

  // JSON/data parsing errors
  if (lowerError.includes('json') || 
      lowerError.includes('parse') ||
      lowerError.includes('unexpected token')) {
    return {
      title: 'Invalid Data',
      message: 'The service returned data in an unexpected format.',
      type: 'data'
    };
  }

  // GBFS specific errors
  if (lowerError.includes('no valid feeds found')) {
    return {
      title: 'No Data Available',
      message: 'This mobility service has no active feeds or available data.',
      type: 'data'
    };
  }

  // SSL/TLS errors
  if (lowerError.includes('ssl') || lowerError.includes('certificate')) {
    return {
      title: 'Security Error',
      message: 'There is a security certificate issue with this service.',
      type: 'network'
    };
  }

  // Fallback for any other error
  return {
    title: 'Service Unavailable',
    message: 'This mobility service is currently unavailable. Please try again later.',
    type: 'unknown'
  };
}

/**
 * Get an appropriate icon color class based on error type
 */
export function getErrorColor(errorType: FriendlyError['type']): string {
  switch (errorType) {
    case 'network':
    case 'timeout':
      return 'text-orange-600';
    case 'server':
      return 'text-red-600';
    case 'data':
      return 'text-yellow-600';
    case 'unknown':
    default:
      return 'text-gray-600';
  }
}

/**
 * Get a suggestion message based on error type
 */
export function getErrorSuggestion(errorType: FriendlyError['type']): string | null {
  switch (errorType) {
    case 'network':
    case 'timeout':
      return 'This is usually temporary. Try refreshing in a few minutes.';
    case 'server':
      return 'The service provider needs to fix this issue.';
    case 'data':
      return 'The service may have updated their data format.';
    default:
      return null;
  }
}
