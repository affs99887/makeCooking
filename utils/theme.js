const listeners = new Set()
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
  return { theme: systemTheme }
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
  systemTheme = readSystemTheme()
  if (wx.onThemeChange) {
    wx.onThemeChange(event => {
      systemTheme = event.theme === 'dark' ? 'dark' : 'light'
      publishAppearance()
    })
  }
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
  subscribeAppearance,
  applyNativeAppearance
}
