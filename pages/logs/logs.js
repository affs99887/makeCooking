// logs.js
const util = require('../../utils/util.js')
const { getAppearance, subscribeAppearance, applyNativeAppearance } = require('../../utils/theme')

Page({
  data: {
    theme: getAppearance().theme,
    logs: []
  },
  onLoad() {
    this.unsubscribeAppearance = subscribeAppearance(appearance => this.setData({ theme: appearance.theme }))
    this.setData({
      logs: (wx.getStorageSync('logs') || []).map(log => {
        return {
          date: util.formatTime(new Date(log)),
          timeStamp: log
        }
      })
    })
  },
  onShow() { applyNativeAppearance() },
  onUnload() { if (this.unsubscribeAppearance) this.unsubscribeAppearance() }
})
