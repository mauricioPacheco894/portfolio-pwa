'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

// Function to get initial theme (only runs on client)
const getInitialTheme = (): Theme => {
    if (typeof window === 'undefined') return 'light'

    const savedTheme = localStorage.getItem('theme') as Theme | null
    if (savedTheme) {
        return savedTheme
    }

    // Check system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return prefersDark ? 'dark' : 'light'
}

export function useDarkMode() {
    // Initialize with the actual theme from localStorage or system preference
    const [theme, setTheme] = useState<Theme>(getInitialTheme)
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
        // Apply theme immediately on mount
        applyTheme(theme)
    }, [])

    const applyTheme = (newTheme: Theme) => {
        const root = document.documentElement
        if (newTheme === 'dark') {
            root.classList.add('dark')
        } else {
            root.classList.remove('dark')
        }
    }

    const toggleTheme = () => {
        const newTheme = theme === 'light' ? 'dark' : 'light'
        setTheme(newTheme)
        localStorage.setItem('theme', newTheme)
        applyTheme(newTheme)
    }

    return { theme, toggleTheme, mounted }
}
