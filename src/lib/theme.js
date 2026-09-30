const KEY = 'quarry-theme'

export function isLight() {
  return document.documentElement.classList.contains('light')
}

export function toggleTheme() {
  const light = !isLight()
  document.documentElement.classList.toggle('light', light)
  try { localStorage.setItem(KEY, light ? 'light' : 'dark') } catch (e) {}
  return light
}
