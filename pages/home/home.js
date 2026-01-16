// pages/home/home.js
const TYPE_LABELS = {
  standard: '标准',
  service: '服务',
  backin: '回味',
  lite: '清淡',
  reverse: '反转'
}

Page({
  data: {
    showSplash: true,      // 新增：控制 splash 显示
    showContent: false,    // 新增：控制内容动画
    currentDate: '',
    greeting: '',
    subtitle: '',
    activeTab: 'today',
    showDrawer: false,      // 新增：控制抽屉显示
    records: [],
    recordsLoading: false,
    recordsLoaded: false
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
    if (this.data.activeTab === 'stats') {
      this.loadRecords()
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
    this.setData({ recordsLoaded: false })

    if (!wx.cloud) {
      this.saveRecordToStorage(recordData)
      return
    }

    const db = wx.cloud.database()
    const payload = Object.assign({}, recordData, {
      createdAt: db.serverDate()
    })

    db.collection('cooking_records')
      .add({ data: payload })
      .then(res => {
        console.log('[Home] Record saved to cloud:', res)
        this.saveRecordToStorage(recordData)
      })
      .catch(error => {
        console.error('[Home] Failed to save record to cloud:', error)
        this.saveRecordToStorage(recordData)
        wx.showToast({
          title: '云端保存失败，已存本地',
          icon: 'none',
          duration: 2000
        })
      })
  },

  saveRecordToStorage(recordData) {
    try {
      let records = wx.getStorageSync('cooking_records') || []
      const exists = records.some(item => item && item.timestamp === recordData.timestamp)
      if (!exists) {
        records.unshift(recordData)
      }
      wx.setStorageSync('cooking_records', records)
      console.log('[Home] Record saved to storage, total:', records.length)
    } catch (error) {
      console.error('[Home] Failed to save record to storage:', error)
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

    if (tab === 'stats') {
      this.loadRecords(true)
    }

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
  },

  loadRecords(force) {
    if (this.data.recordsLoading || (!force && this.data.recordsLoaded)) {
      return
    }

    this.setData({ recordsLoading: true })

    if (!wx.cloud) {
      this.setRecordsFromStorage()
      return
    }

    const db = wx.cloud.database()
    db.collection('cooking_records')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get()
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : []
        const merged = this.mergeRecords(list)
        const records = this.formatRecords(merged)
        this.setData({
          records,
          recordsLoading: false,
          recordsLoaded: true
        })
        this.cacheRecords(merged)
      })
      .catch(error => {
        console.error('[Home] Failed to load records from cloud:', error)
        this.setRecordsFromStorage()
      })
  },

  mergeRecords(cloudRecords) {
    let localRecords = []
    try {
      localRecords = wx.getStorageSync('cooking_records') || []
    } catch (error) {
      console.error('[Home] Failed to read local records for merge:', error)
    }

    const merged = []
    const seen = {}
    const addRecord = record => {
      if (!record) {
        return
      }
      const key = record.timestamp || record._id || record.id
      if (key && seen[key]) {
        return
      }
      if (key) {
        seen[key] = true
      }
      merged.push(record)
    }

    cloudRecords.forEach(addRecord)
    localRecords.forEach(addRecord)

    merged.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    return merged
  },

  cacheRecords(records) {
    try {
      wx.setStorageSync('cooking_records', records)
    } catch (error) {
      console.error('[Home] Failed to cache records:', error)
    }
  },

  setRecordsFromStorage() {
    let records = []
    try {
      records = wx.getStorageSync('cooking_records') || []
    } catch (error) {
      console.error('[Home] Failed to load records from storage:', error)
    }
    this.setData({
      records: this.formatRecords(records),
      recordsLoading: false,
      recordsLoaded: true
    })
  },

  formatRecords(records) {
    return (records || []).map((record, index) => {
      const typeCounts = this.normalizeTypeCounts(record)
      const tags = this.buildTags(typeCounts)
      const displayDate = record.date || this.formatDateFromTimestamp(record.timestamp) || '--'
      const methodLabel = record.method || '未选择'

      return Object.assign({}, record, {
        typeCounts,
        tags,
        displayDate,
        methodLabel,
        recordId: record._id || record.id || `${record.timestamp || 'local'}-${index}`
      })
    })
  },

  normalizeTypeCounts(record) {
    if (record.typeCounts && typeof record.typeCounts === 'object') {
      return record.typeCounts
    }
    const counts = {
      standard: 0,
      service: 0,
      backin: 0,
      lite: 0,
      reverse: 0
    }
    const types = Array.isArray(record.types) ? record.types : []
    types.forEach(type => {
      if (Object.prototype.hasOwnProperty.call(counts, type)) {
        counts[type] += 1
      }
    })
    return counts
  },

  buildTags(typeCounts) {
    return Object.keys(TYPE_LABELS).reduce((tags, key) => {
      const count = Number(typeCounts[key] || 0)
      if (count > 0) {
        tags.push({
          key,
          label: TYPE_LABELS[key],
          count
        })
      }
      return tags
    }, [])
  },

  formatDateFromTimestamp(timestamp) {
    if (!timestamp) {
      return ''
    }
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    return this.formatDate(date)
  },

  formatDate(date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
  }
})
