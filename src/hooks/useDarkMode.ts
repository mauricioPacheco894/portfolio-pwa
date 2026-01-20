'use client';

/**
 * Dark Mode Hook
 * 
 * Manages the application's color theme (light vs dark).
 * Synchronizes with localStorage and system preferences.
 * Includes a 'mounted' state to prevent hydration mismatches for theme-dependent UI.
 * 
 * @example
 * const { theme, toggleTheme, mounted } = useDarkMode();
 */

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

/**
 * Derives the initial theme from localStorage or system preference.
 * Only safe to call in a client environment.
 */
const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';

  const savedTheme = localStorage.getItem('theme') as Theme | null;
  if (savedTheme) {
    return savedTheme;
  }

  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

export function useDarkMode() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [mounted, setMounted] = useState(false);

  /**
   * Applies the theme class to the document root.
   */
  const applyTheme = (newTheme: Theme) => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      applyTheme(theme);
    }
  }, [theme, mounted]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('theme', newTheme);
    applyTheme(newTheme);
  };

  return { theme, toggleTheme, mounted };
}
