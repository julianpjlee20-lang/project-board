'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

interface AssigneeComboboxProps {
  users: { id: string; name: string; avatar_url: string | null }[]
  value: string // 目前選中的 user id
  onChange: (userId: string) => void
}

/** 取得使用者名稱的首字母（支援中文） */
function getInitial(name: string): string {
  if (!name) return '?'
  // 中文字直接取第一個字
  const first = name.charAt(0)
  return first.toUpperCase()
}

/** 根據名稱產生一致的背景色 */
function getAvatarColor(name: string): string {
  const colors = [
    'bg-blue-500',
    'bg-green-500',
    'bg-purple-500',
    'bg-orange-500',
    'bg-pink-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-rose-500',
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

export function AssigneeCombobox({ users, value, onChange }: AssigneeComboboxProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const selectedUser = users.find(u => u.id === value)

  // 模糊搜尋：不區分大小寫
  const filtered = query
    ? users.filter(u =>
        (u.name || u.id).toLowerCase().includes(query.toLowerCase())
      )
    : users

  // 當過濾結果變化時，重置高亮索引
  useEffect(() => {
    setHighlightIndex(0)
  }, [filtered.length])

  // 點擊外部關閉下拉選單
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // 確保高亮項目在可視範圍內
  useEffect(() => {
    if (!isOpen || !listRef.current) return
    const items = listRef.current.children
    const item = items[highlightIndex] as HTMLElement | undefined
    if (item) {
      item.scrollIntoView({ block: 'nearest' })
    }
  }, [highlightIndex, isOpen])

  const selectUser = useCallback((userId: string) => {
    onChange(userId)
    setQuery('')
    setIsOpen(false)
    inputRef.current?.blur()
  }, [onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault()
        setIsOpen(true)
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setHighlightIndex(prev =>
          prev < filtered.length - 1 ? prev + 1 : 0
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setHighlightIndex(prev =>
          prev > 0 ? prev - 1 : filtered.length - 1
        )
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[highlightIndex]) {
          selectUser(filtered[highlightIndex].id)
        }
        break
      case 'Escape':
        e.preventDefault()
        setIsOpen(false)
        setQuery('')
        break
    }
  }, [isOpen, filtered, highlightIndex, selectUser])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    if (!isOpen) setIsOpen(true)
  }

  const handleFocus = () => {
    setIsOpen(true)
    // 聚焦時如果已有選中用戶，清空 input 以便搜尋
    if (selectedUser) {
      setQuery('')
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setIsOpen(false)
  }

  // input 顯示的值：搜尋中顯示 query，否則顯示選中用戶名稱
  const displayValue = isOpen ? query : (selectedUser ? (selectedUser.name || selectedUser.id) : '')

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input 區域 */}
      <div className="relative flex items-center">
        {/* 已選用戶的頭像（顯示在 input 左側） */}
        {selectedUser && !isOpen && (
          <div className="absolute left-2 z-10 pointer-events-none">
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium ${getAvatarColor(selectedUser.name || selectedUser.id)}`}
            >
              {getInitial(selectedUser.name || selectedUser.id)}
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={selectedUser ? '' : '搜尋使用者...'}
          className={`w-full border rounded px-3 py-2.5 sm:py-2 text-base sm:text-sm outline-none transition-colors min-h-[44px] sm:min-h-0
            focus:border-blue-500 focus:ring-1 focus:ring-blue-500
            ${selectedUser && !isOpen ? 'pl-10' : ''}`}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
        />

        {/* 清除按鈕 */}
        {value && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="清除選擇"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* 下拉選單 */}
      {isOpen && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white border rounded-md shadow-lg max-h-48 sm:max-h-48 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-3 sm:py-2 text-base sm:text-sm text-gray-500">找不到使用者</li>
          ) : (
            <>
              {/* 未指派選項 */}
              {!query && (
                <li
                  role="option"
                  aria-selected={value === ''}
                  className={`flex items-center gap-2 px-3 py-3 sm:py-2 text-base sm:text-sm cursor-pointer transition-colors min-h-[44px]
                    ${value === '' ? 'bg-blue-50 text-blue-700' : ''}
                    ${highlightIndex === -1 ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  onClick={() => selectUser('')}
                >
                  <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-gray-400 text-xs">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </div>
                  <span className="text-gray-500">未指派</span>
                </li>
              )}

              {filtered.map((user, index) => (
                <li
                  key={user.id}
                  role="option"
                  aria-selected={user.id === value}
                  className={`flex items-center gap-2 px-3 py-3 sm:py-2 text-base sm:text-sm cursor-pointer transition-colors min-h-[44px]
                    ${user.id === value ? 'bg-blue-50 text-blue-700' : ''}
                    ${index === highlightIndex ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
                  onClick={() => selectUser(user.id)}
                  onMouseEnter={() => setHighlightIndex(index)}
                >
                  {/* 首字母頭像 */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-medium shrink-0 ${getAvatarColor(user.name || user.id)}`}
                  >
                    {getInitial(user.name || user.id)}
                  </div>
                  <span className="truncate">{user.name || user.id}</span>
                </li>
              ))}
            </>
          )}
        </ul>
      )}
    </div>
  )
}
