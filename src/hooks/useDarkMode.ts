'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export function useDarkMode() {
    const [theme, setTheme] = useState<Theme>('light')

    useEffect(() => {
        // Check localStorage first
        const savedTheme = localStorage.getItem('theme') as Theme | null

        if (savedTheme) {
            setTheme(savedTheme)
            applyTheme(savedTheme)
        } else {
            // Check system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            const initialTheme = prefersDark ? 'dark' : 'light'
            setTheme(initialTheme)
            applyTheme(initialTheme)
        }
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

    return { theme, toggleTheme }
}
