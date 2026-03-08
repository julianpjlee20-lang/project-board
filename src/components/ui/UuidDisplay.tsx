'use client'

import { useState, useCallback } from 'react'

interface UuidDisplayProps {
  uuid: string
  label?: string
}

export function UuidDisplay({ uuid, label }: UuidDisplayProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(uuid)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: select text
      const textarea = document.createElement('textarea')
      textarea.value = uuid
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [uuid])

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-slate-400 dark:text-slate-500">
      {label && <span className="shrink-0">{label}:</span>}
      <span className="break-all select-all">{uuid}</span>
      <button
        type="button"
        onClick={handleCopy}
        className="shrink-0 p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        aria-label={`複製 ${label || 'UUID'}`}
      >
        {copied ? (
          <span className="text-emerald-500 text-[10px] font-sans">已複製</span>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        )}
      </button>
    </div>
  )
}
