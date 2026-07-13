'use client';

/**
 * Ticker Autocomplete Component
 * 
 * Reusable input with dropdown suggestions for ticker symbols.
 * Supports keyboard navigation and filtering.
 */

import { useEffect, useMemo,useRef, useState } from 'react';

interface TickerAutocompleteProps {
    value: string;
    onChange: (value: string) => void;
    suggestions?: string[];
    placeholder?: string;
    className?: string;
    autoFocus?: boolean;
    onEnter?: () => void;
}

export default function TickerAutocomplete({
    value,
    onChange,
    suggestions = [],
    placeholder = 'Ticker (ej: AAPL)',
    className = '',
    autoFocus = false,
    onEnter,
}: TickerAutocompleteProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Deduplicate suggestions to avoid React key warnings
    const uniqueSuggestions = useMemo(() => {
        return Array.from(new Set(suggestions));
    }, [suggestions]);

    // Filter suggestions based on input
    const filteredSuggestions = uniqueSuggestions
        .filter((ticker) => {
            const search = value.toUpperCase();
            return search && ticker.toUpperCase().includes(search);
        })
        .slice(0, 10); // Limit to 10 suggestions

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                !inputRef.current?.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Reset selected index when suggestions change
    useEffect(() => {
        setSelectedIndex(-1);
    }, [filteredSuggestions.length]);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!isOpen || filteredSuggestions.length === 0) {
            if (e.key === 'Enter' && onEnter) {
                onEnter();
            }
            return;
        }

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex((prev) =>
                    prev < filteredSuggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0) {
                    onChange(filteredSuggestions[selectedIndex]);
                    setIsOpen(false);
                } else if (onEnter) {
                    onEnter();
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                break;
        }
    };

    const handleSelect = (ticker: string) => {
        onChange(ticker);
        setIsOpen(false);
        inputRef.current?.focus();
    };

    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    setIsOpen(true);
                }}
                onFocus={() => setIsOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={className}
                autoFocus={autoFocus}
                suppressHydrationWarning
            />

            {isOpen && filteredSuggestions.length > 0 && (
                <div
                    ref={dropdownRef}
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-card shadow-lg ring-1 ring-border"
                >
                    {filteredSuggestions.map((ticker, index) => (
                        <button
                            key={ticker}
                            type="button"
                            onClick={() => handleSelect(ticker)}
                            className={`w-full px-3 py-2 text-left text-sm font-medium transition-colors ${index === selectedIndex
                                ? 'bg-primary/10 text-primary'
                                : 'text-foreground hover:bg-muted'
                                }`}
                        >
                            {ticker}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
