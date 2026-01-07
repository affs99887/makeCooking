// pages/splash/splash.js
Page({
  data: {
    isNavigating: false
  },

  onLoad() {
    // 启动动画后延迟跳转
    this.startSplashSequence()
  },

  /**
   * 启动画面序列
   */
  startSplashSequence() {
    // 2.2秒后开始淡出动画
    setTimeout(() => {
      this.fadeOutAndNavigate()
    }, 2200)
  },

  /**
   * 淡出并跳转
   */
  fadeOutAndNavigate() {
    if (this.data.isNavigating) return

    this.setData({
      isNavigating: true
    })

    // 添加淡出class（如果需要）
    // 实际上我们可以用 CSS animation 自动完成

    // 0.5秒淡出动画后跳转
    setTimeout(() => {
      wx.reLaunch({
        url: '/pages/home/home'
      })
    }, 500)
  },

  /**
   * 用户点击屏幕可跳过启动画面
   */
  onTap() {
    // 允许用户点击跳过
    if (!this.data.isNavigating) {
      this.fadeOutAndNavigate()
    }
  }
})
