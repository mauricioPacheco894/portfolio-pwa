'use client'

import dynamic from 'next/dynamic'
import { memo } from 'react'

// Lazy load heavy components
const AddTransactionFormLazy = dynamic(
    () => import('@/app/components/AddTransactionForm'),
    {
        loading: () => (
            <div className="flex items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600 dark:border-zinc-600 dark:border-t-blue-500"></div>
            </div>
        ),
    }
)

const AllocationChartLazy = dynamic(
    () => import('@/app/components/AllocationChart'),
    {
        loading: () => (
            <div className="flex h-64 items-center justify-center rounded-xl border bg-white dark:border-zinc-700 dark:bg-zinc-800">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600 dark:border-zinc-600 dark:border-t-blue-500"></div>
            </div>
        ),
    }
)

const TargetAllocationEditorLazy = dynamic(
    () => import('@/app/components/TargetAllocationEditor'),
    {
        loading: () => (
            <div className="flex items-center justify-center p-8">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-blue-600 dark:border-zinc-600 dark:border-t-blue-500"></div>
            </div>
        ),
    }
)

// Memoized Header component
export const HeaderMemo = memo(function HeaderMemo() {
    const Header = require('@/app/components/Header').Header
    return <Header />
})

export {
    AddTransactionFormLazy,
    AllocationChartLazy,
    TargetAllocationEditorLazy,
}
