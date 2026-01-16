// app.js
App({
  onLaunch() {
    if (wx.cloud) {
      wx.cloud.init({
        env: 'cloudbase-8grsywca3449ec3f',
        traceUser: true
      })
      this.loadSerifFont()
    } else {
      console.warn('[App] wx.cloud is not available')
    }

    // 展示本地存储能力
    const logs = wx.getStorageSync('logs') || []
    logs.unshift(Date.now())
    wx.setStorageSync('logs', logs)

    // 登录
    wx.login({
      success: res => {
        // 发送 res.code 到后台换取 openId, sessionKey, unionId
      }
    })
  },
  loadSerifFont() {
    if (!wx.cloud || !wx.cloud.getTempFileURL || !wx.loadFontFace) {
      console.warn('[App] Serif font loader is not available')
      return
    }

    const serifFileId = 'cloud://cloudbase-8grsywca3449ec3f.636c-cloudbase-8grsywca3449ec3f-1394744241/fonts/SourceHanSerifCN-Regular-1.otf'
    const serifFamily = 'SourceHanSerifCN'

    wx.cloud.getTempFileURL({
      fileList: [serifFileId],
      success: res => {
        const fileInfo = (res.fileList || []).find(item => item.fileID === serifFileId) || (res.fileList && res.fileList[0])
        if (!fileInfo || !fileInfo.tempFileURL || fileInfo.status !== 0) {
          console.warn('[App] Serif font temp url missing', fileInfo || res)
          return
        }
        wx.loadFontFace({
          family: serifFamily,
          source: `url("${fileInfo.tempFileURL}")`,
          global: true,
          success: () => {},
          fail: err => {
            console.warn('[App] Failed to load serif font', err)
          }
        })
      },
      fail: err => {
        console.warn('[App] Failed to fetch serif font url', err)
      }
    })
  },
  globalData: {
    userInfo: null
  }
})
