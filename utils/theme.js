const STORAGE_KEY = 'appearancePreference'
const PREFERENCES = ['system', 'light', 'dark']
const LABELS = { system: '自动', light: '浅色', dark: '深色' }
const listeners = new Set()
let preference = 'system'
let systemTheme = 'light'
let initialized = false

function readSystemTheme() {
  try {
    const info = wx.getAppBaseInfo ? wx.getAppBaseInfo() : wx.getSystemInfoSync()
    return info.theme === 'dark' ? 'dark' : 'light'
  } catch (error) {
    return 'light'
  }
}

function getAppearance() {
  return {
    theme: preference === 'system' ? systemTheme : preference,
    preference,
    label: LABELS[preference]
  }
}

function applyNativeAppearance() {
  const dark = getAppearance().theme === 'dark'
  const backgroundColor = dark ? '#000000' : '#faf8f5'
  if (wx.setNavigationBarColor) {
    wx.setNavigationBarColor({
      frontColor: dark ? '#ffffff' : '#000000',
      backgroundColor,
      fail() {}
    })
  }
  if (wx.setBackgroundColor) {
    wx.setBackgroundColor({ backgroundColor, backgroundColorTop: backgroundColor, backgroundColorBottom: backgroundColor })
  }
  if (wx.setBackgroundTextStyle) {
    wx.setBackgroundTextStyle({ textStyle: dark ? 'light' : 'dark' })
  }
}

function publishAppearance() {
  applyNativeAppearance()
  const appearance = getAppearance()
  listeners.forEach(listener => listener(appearance))
}

function initializeAppearance() {
  if (initialized) return
  initialized = true
  try {
    const saved = wx.getStorageSync(STORAGE_KEY)
    preference = PREFERENCES.includes(saved) ? saved : 'system'
  } catch (error) {
    preference = 'system'
  }
  systemTheme = readSystemTheme()
  if (wx.onThemeChange) {
    wx.onThemeChange(event => {
      systemTheme = event.theme === 'dark' ? 'dark' : 'light'
      publishAppearance()
    })
  }
}

function setAppearancePreference(value) {
  if (!PREFERENCES.includes(value)) return
  preference = value
  systemTheme = readSystemTheme()
  try {
    wx.setStorageSync(STORAGE_KEY, value)
  } catch (error) {
    console.warn('[Theme] Unable to persist appearance:', error)
  }
  publishAppearance()
}

function subscribeAppearance(listener) {
  initializeAppearance()
  listeners.add(listener)
  listener(getAppearance())
  return () => listeners.delete(listener)
}

module.exports = {
  initializeAppearance,
  getAppearance,
  setAppearancePreference,
  subscribeAppearance,
  applyNativeAppearance
}
