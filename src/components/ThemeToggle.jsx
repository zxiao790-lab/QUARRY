import { useState } from 'react'
import { toggleTheme, isLight } from '../lib/theme.js'

export default function ThemeToggle({ asText = false, className = '' }) {
  const [light, setLight] = useState(isLight)
  if (asText) {
    return (
      <button
        onClick={() => setLight(toggleTheme())}
        className="text-xs text-ink/45 hover:text-ink/80 transition-colors"
      >
        当前{light ? '日间' : '夜间'} · 切换
      </button>
    )
  }
  return (
    <button
      onClick={() => setLight(toggleTheme())}
      title={light ? '切换到夜间' : '切换到日间'}
      className={`text-ink/40 hover:text-ink/80 transition-colors ${className}`}
    >
      {light ? (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.8 6.8 0 0 0 9.8 9.8Z" />
        </svg>
      ) : (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.5 1.5M17.2 17.2l1.5 1.5M18.7 5.3l-1.5 1.5M6.8 17.2l-1.5 1.5" />
        </svg>
      )}
    </button>
  )
}
