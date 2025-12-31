'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    children: React.ReactNode;
    maxWidth?: 'sm' | 'md' | 'lg' | 'xl';
}

const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
};

export default function Modal({
    isOpen,
    onClose,
    title,
    children,
    maxWidth = 'md',
}: ModalProps) {
    const modalRef = useRef<HTMLDivElement>(null);

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <div
                ref={modalRef}
                className={`w-full ${maxWidthClasses[maxWidth]} rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:bg-zinc-900 dark:ring-white/10 animate-in zoom-in-95 duration-200`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="mb-6 flex items-center justify-between">
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                        {title}
                    </h3>
                    <button
                        onClick={onClose}
                        className="rounded-full p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                {children}
            </div>
        </div>
    );
}
