// pages/home/home.js
Page({
  data: {
    showSplash: true,      // 新增：控制 splash 显示
    showContent: false,    // 新增：控制内容动画
    currentDate: '',
    greeting: '',
    subtitle: '',
    activeTab: 'today',
    showDrawer: false      // 新增：控制抽屉显示
  },

  onLoad() {
    // 不立即加载，等待 splash 完成
    console.log('[Home] Page loaded, waiting for splash')
  },

  onShow() {
    // 仅在 splash 已完成时更新
    if (!this.data.showSplash) {
      this.updateGreeting()
    }
  },

  /**
   * Splash 完成回调
   */
  onSplashComplete(e) {
    console.log('[Home] Splash complete at:', e.detail.timestamp)

    this.setData({
      showSplash: false
    })

    // 延迟 100ms 后显示内容并开始动画
    setTimeout(() => {
      this.setData({
        showContent: true
      })
      this.updateGreeting()
    }, 100)
  },

  /**
   * 更新问候语和日期
   */
  updateGreeting() {
    const now = new Date()
    const hour = now.getHours()

    // 格式化日期
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const currentDate = `${year}.${month}.${day}`

    // 根据时间设置问候语
    let greeting = ''
    let subtitle = ''

    if (hour >= 5 && hour < 12) {
      greeting = '早安'
      subtitle = '美好的一天开始了'
    } else if (hour >= 12 && hour < 18) {
      greeting = '午安'
      subtitle = '享受当下的时光'
    } else if (hour >= 18 && hour < 23) {
      greeting = '晚安'
      subtitle = '温柔的夜晚时分'
    } else {
      greeting = '夜深了'
      subtitle = '静谧的深夜时刻'
    }

    this.setData({
      currentDate,
      greeting,
      subtitle
    })
  },

  /**
   * 添加记录
   */
  onAddRecord() {
    console.log('[Home] Opening record drawer')
    this.setData({
      showDrawer: true
    })
  },

  /**
   * 关闭记录抽屉
   */
  onDrawerClose() {
    console.log('[Home] Closing record drawer')
    this.setData({
      showDrawer: false
    })
  },

  /**
   * 保存记录
   */
  onRecordSave(e) {
    const recordData = e.detail
    console.log('[Home] Record saved:', recordData)

    // TODO: 保存到本地存储或云端
    // 示例：保存到本地存储
    try {
      let records = wx.getStorageSync('cooking_records') || []
      records.unshift(recordData) // 添加到数组开头
      wx.setStorageSync('cooking_records', records)
      console.log('[Home] Record saved to storage, total:', records.length)
    } catch (error) {
      console.error('[Home] Failed to save record:', error)
    }
  },

  /**
   * Tab 切换
   */
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab

    // 触觉反馈
    wx.vibrateShort({ type: 'light' })

    // 切换 tab
    this.setData({
      activeTab: tab
    })

    // 提示（可选）
    const tabName = tab === 'today' ? 'Today' : '统计'
    console.log('切换到:', tabName)

    // 可以在这里添加页面切换逻辑
    // 例如显示/隐藏不同的内容区域
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: 'makeCooking',
      path: '/pages/home/home'
    }
  }
})
