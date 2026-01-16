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
    drawerMode: 'create',
    selectedRecord: null,
    records: [],
    recordsStatus: 'idle',
    recordsRefreshing: false
  },

  onLoad() {
    // 不立即加载，等待 splash 完成
    console.log('[Home] Page loaded, waiting for splash')
    this.recordsFetching = false
  },

  onShow() {
    // 仅在 splash 已完成时更新
    if (!this.data.showSplash) {
      this.updateGreeting()
    }
    if (this.data.activeTab === 'stats') {
      this.setData({ recordsStatus: 'loading' })
      this.loadRecords(true, false)
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
      showDrawer: true,
      drawerMode: 'create',
      selectedRecord: null
    })
  },

  /**
   * 关闭记录抽屉
   */
  onDrawerClose() {
    console.log('[Home] Closing record drawer')
    this.setData({
      showDrawer: false,
      drawerMode: 'create',
      selectedRecord: null
    })
  },

  /**
   * 保存记录
   */
  onRecordSave(e) {
    const recordData = e.detail
    console.log('[Home] Record saved:', recordData)
    this.setData({ recordsStatus: 'idle' })

    if (!wx.cloud) {
      wx.showToast({
        title: '云能力不可用',
        icon: 'none',
        duration: 2000
      })
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
        if (this.data.activeTab === 'stats') {
          this.setData({ recordsStatus: 'loading' })
          this.loadRecords(true, false)
        }
      })
      .catch(error => {
        console.error('[Home] Failed to save record to cloud:', error)
        wx.showToast({
          title: '云端保存失败，请重试',
          icon: 'none',
          duration: 2000
        })
      })
  },

  /**
   * Tab 切换
   */
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab

    // 触觉反馈
    wx.vibrateShort({ type: 'light' })

    // 切换 tab
    const nextData = { activeTab: tab }
    if (tab === 'stats') {
      nextData.recordsStatus = 'loading'
    }
    this.setData(nextData)

    if (tab === 'stats') {
      this.loadRecords(true, false)
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

  onRecordCardTap(e) {
    const index = e.currentTarget.dataset.index
    const record = this.data.records[index]
    if (!record) {
      return
    }
    this.setData({
      selectedRecord: record,
      drawerMode: 'view',
      showDrawer: true
    })
  },

  onRecordUpdate(e) {
    const recordData = e.detail || {}
    const recordId = recordData._id || recordData.id
    if (!recordId) {
      wx.showToast({
        title: '记录标识缺失',
        icon: 'none',
        duration: 2000
      })
      return
    }

    if (!wx.cloud) {
      wx.showToast({
        title: '云能力不可用',
        icon: 'none',
        duration: 2000
      })
      return
    }

    const db = wx.cloud.database()
    const payload = {
      types: recordData.types || [],
      typeCounts: recordData.typeCounts || {},
      method: recordData.method || '',
      score: recordData.score || 0,
      timestamp: recordData.timestamp,
      date: recordData.date,
      time: recordData.time || '',
      updatedAt: db.serverDate()
    }

    db.collection('cooking_records')
      .doc(recordId)
      .update({ data: payload })
      .then(() => {
        wx.showToast({
          title: '记录已更新',
          icon: 'success',
          duration: 2000
        })
        if (this.data.activeTab === 'stats') {
          this.setData({ recordsStatus: 'loading' })
          this.loadRecords(true, false)
        }
      })
      .catch(error => {
        console.error('[Home] Failed to update record:', error)
        wx.showToast({
          title: '更新失败，请重试',
          icon: 'none',
          duration: 2000
        })
      })
  },

  onRecordDelete(e) {
    const recordId = e.detail && (e.detail.id || e.detail._id)
    if (!recordId) {
      wx.showToast({
        title: '记录标识缺失',
        icon: 'none',
        duration: 2000
      })
      return
    }

    if (!wx.cloud) {
      wx.showToast({
        title: '云能力不可用',
        icon: 'none',
        duration: 2000
      })
      return
    }

    const db = wx.cloud.database()
    db.collection('cooking_records')
      .doc(recordId)
      .remove()
      .then(() => {
        wx.showToast({
          title: '记录已删除',
          icon: 'success',
          duration: 2000
        })
        if (this.data.activeTab === 'stats') {
          this.setData({ recordsStatus: 'loading' })
          this.loadRecords(true, false)
        }
      })
      .catch(error => {
        console.error('[Home] Failed to delete record:', error)
        wx.showToast({
          title: '删除失败，请重试',
          icon: 'none',
          duration: 2000
        })
      })
  },

  loadRecords(force, isRefresh) {
    if (this.recordsFetching || (!force && this.data.recordsStatus === 'loaded')) {
      return
    }

    this.recordsFetching = true
    const nextStatus = isRefresh ? this.data.recordsStatus : 'loading'
    this.setData({
      recordsStatus: nextStatus,
      recordsRefreshing: !!isRefresh
    })

    if (!wx.cloud) {
      this.recordsFetching = false
      const nextData = {
        recordsStatus: 'loaded',
        recordsRefreshing: false
      }
      if (!isRefresh) {
        nextData.records = []
      }
      this.setData(nextData)
      wx.showToast({
        title: '云能力不可用',
        icon: 'none',
        duration: 2000
      })
      return
    }

    const db = wx.cloud.database()
    db.collection('cooking_records')
      .orderBy('timestamp', 'desc')
      .limit(50)
      .get()
      .then(res => {
        const list = Array.isArray(res.data) ? res.data : []
        const records = this.formatRecords(list)
        this.setData({
          records,
          recordsStatus: 'loaded',
          recordsRefreshing: false
        })
        this.recordsFetching = false
      })
      .catch(error => {
        console.error('[Home] Failed to load records from cloud:', error)
        this.recordsFetching = false
        const nextData = {
          recordsStatus: 'loaded',
          recordsRefreshing: false
        }
        if (!isRefresh) {
          nextData.records = []
        }
        this.setData(nextData)
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none',
          duration: 2000
        })
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
  },

  onRecordsRefresh() {
    this.loadRecords(true, true)
  }
})
