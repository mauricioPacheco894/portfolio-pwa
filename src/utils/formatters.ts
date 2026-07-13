/**
 * Formatting Utilities
 * 
 * Shared functions for formatting currency and numbers.
 */

export const currencyFormatter = (
  value: number
) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD', // Use USD style for the $ symbol generically
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
};

export const currencyFormatterWithSign = (
  value: number
) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'always',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};
