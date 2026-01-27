// pages/home/home.js
const TYPE_LABELS = {
  standard: 'Standard',
  service: 'Service',
  backin: 'Backin',
  lite: 'Lite',
  reverse: 'Reverse',
  suck: 'Suck'
}
const SCROLL_TICK_COUNT = 9
const SCROLL_TICKS = Array.from({ length: SCROLL_TICK_COUNT }, (_, index) => ({ index }))

const createAllOption = () => ({ label: '全部', value: '' })
const buildMonthOptions = () => {
  const options = [createAllOption()]
  for (let month = 1; month <= 12; month += 1) {
    options.push({ label: `${month}月`, value: month })
  }
  return options
}
const buildDayOptions = days => {
  const options = [createAllOption()]
  const maxDays = Math.max(Number(days) || 31, 1)
  for (let day = 1; day <= maxDays; day += 1) {
    options.push({ label: `${day}日`, value: day })
  }
  return options
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
    filteredRecords: [],
    recordsStatus: 'idle',
    recordsRefreshing: false,
    filtersActive: false,
    filterYearOptions: [createAllOption()],
    filterMonthOptions: buildMonthOptions(),
    filterDayOptions: buildDayOptions(31),
    filterYearIndex: 0,
    filterMonthIndex: 0,
    filterDayIndex: 0,
    scrollTicks: SCROLL_TICKS,
    scrollTickActiveIndex: 0
  },

  onLoad() {
    // 不立即加载，等待 splash 完成
    console.log('[Home] Page loaded, waiting for splash')
    this.recordsFetching = false
    this.recordsScrollTop = 0
    this.recordsViewHeight = 0
    this.recordsContentHeight = 0
  },

  onShow() {
    // 仅在 splash 已完成时更新
    if (!this.data.showSplash) {
      this.updateGreeting()
    }
    if (this.data.activeTab === 'stats') {
      this.setData({ recordsStatus: 'loading' })
      this.loadRecords(true, false)
      this.initScrollIndicatorMetrics()
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
      this.initScrollIndicatorMetrics()
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
    const index = Number(e.currentTarget.dataset.index || 0)
    const record =
      (Array.isArray(this.data.filteredRecords) && this.data.filteredRecords[index])
      || this.data.records[index]
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
      scoreMode: recordData.scoreMode || 'total',
      typeScores: recordData.typeScores || {},
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
        nextData.filteredRecords = []
        nextData.filtersActive = false
        nextData.filterYearOptions = [createAllOption()]
        nextData.filterMonthOptions = buildMonthOptions()
        nextData.filterDayOptions = buildDayOptions(31)
        nextData.filterYearIndex = 0
        nextData.filterMonthIndex = 0
        nextData.filterDayIndex = 0
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
        const filterState = this.syncFilterOptions(records)
        const filterResult = this.applyRecordFilters(records, filterState)
        this.setData({
          records,
          filteredRecords: filterResult.filteredRecords,
          filtersActive: filterResult.filtersActive,
          filterYearOptions: filterState.filterYearOptions,
          filterMonthOptions: filterState.filterMonthOptions,
          filterDayOptions: filterState.filterDayOptions,
          filterYearIndex: filterState.filterYearIndex,
          filterMonthIndex: filterState.filterMonthIndex,
          filterDayIndex: filterState.filterDayIndex,
          recordsStatus: 'loaded',
          recordsRefreshing: false
        })
        this.recordsFetching = false
        this.initScrollIndicatorMetrics()
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
          nextData.filteredRecords = []
          nextData.filtersActive = false
          nextData.filterYearOptions = [createAllOption()]
          nextData.filterMonthOptions = buildMonthOptions()
          nextData.filterDayOptions = buildDayOptions(31)
          nextData.filterYearIndex = 0
          nextData.filterMonthIndex = 0
          nextData.filterDayIndex = 0
        }
        this.setData(nextData)
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none',
          duration: 2000
        })
        this.initScrollIndicatorMetrics()
      })
  },

  formatRecords(records) {
    return (records || []).map((record, index) => {
      const typeCounts = this.normalizeTypeCounts(record)
      const tags = this.buildTags(typeCounts)
      const dateParts = this.parseRecordDateParts(record)
      const displayDate = dateParts
        ? this.formatDateParts(dateParts)
        : (record.date || this.formatDateFromTimestamp(record.timestamp) || '--')
      const timeValue = record.time || this.formatTimeFromTimestamp(record.timestamp) || ''
      const displayDateTime = timeValue ? `${displayDate} ${timeValue}` : displayDate
      const methodLabel = record.method || ''

      return Object.assign({}, record, {
        typeCounts,
        tags,
        displayDate,
        displayDateTime,
        methodLabel,
        dateParts,
        recordId: record._id || record.id || `${record.timestamp || 'local'}-${index}`
      })
    })
  },

  normalizeTypeCounts(record) {
    const counts = {
      standard: 0,
      service: 0,
      backin: 0,
      lite: 0,
      reverse: 0,
      suck: 0
    }
    if (record.typeCounts && typeof record.typeCounts === 'object') {
      return Object.assign({}, counts, record.typeCounts)
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

  getSelectedFilterValue(options, index) {
    if (!Array.isArray(options)) {
      return ''
    }
    const option = options[index]
    if (!option) {
      return ''
    }
    return option.value
  },

  findOptionIndex(options, value) {
    if (!Array.isArray(options)) {
      return 0
    }
    const idx = options.findIndex(option => option.value === value)
    return idx >= 0 ? idx : 0
  },

  buildYearOptions(records) {
    const years = new Set()
    ;(records || []).forEach(record => {
      const parts = record.dateParts || this.parseRecordDateParts(record)
      if (parts && parts.year) {
        years.add(parts.year)
      }
    })
    const sortedYears = Array.from(years).sort((a, b) => b - a)
    return [createAllOption(), ...sortedYears.map(year => ({
      label: `${year}年`,
      value: year
    }))]
  },

  getDayOptions(yearValue, monthValue) {
    if (yearValue && monthValue) {
      const days = new Date(yearValue, monthValue, 0).getDate()
      return buildDayOptions(days)
    }
    return buildDayOptions(31)
  },

  syncFilterOptions(records) {
    const filterYearOptions = this.buildYearOptions(records)
    const filterMonthOptions = buildMonthOptions()
    const prevYearValue = this.getSelectedFilterValue(
      this.data.filterYearOptions,
      this.data.filterYearIndex
    )
    const prevMonthValue = this.getSelectedFilterValue(
      this.data.filterMonthOptions,
      this.data.filterMonthIndex
    )
    const prevDayValue = this.getSelectedFilterValue(
      this.data.filterDayOptions,
      this.data.filterDayIndex
    )
    const filterYearIndex = this.findOptionIndex(filterYearOptions, prevYearValue)
    const filterMonthIndex = this.findOptionIndex(filterMonthOptions, prevMonthValue)
    const yearValue = this.getSelectedFilterValue(filterYearOptions, filterYearIndex)
    const monthValue = this.getSelectedFilterValue(filterMonthOptions, filterMonthIndex)
    const filterDayOptions = this.getDayOptions(yearValue, monthValue)
    const filterDayIndex = this.findOptionIndex(filterDayOptions, prevDayValue)

    return {
      filterYearOptions,
      filterMonthOptions,
      filterDayOptions,
      filterYearIndex,
      filterMonthIndex,
      filterDayIndex
    }
  },

  applyRecordFilters(records, filterState) {
    const yearOptions = filterState ? filterState.filterYearOptions : this.data.filterYearOptions
    const monthOptions = filterState ? filterState.filterMonthOptions : this.data.filterMonthOptions
    const dayOptions = filterState ? filterState.filterDayOptions : this.data.filterDayOptions
    const yearIndex = filterState ? filterState.filterYearIndex : this.data.filterYearIndex
    const monthIndex = filterState ? filterState.filterMonthIndex : this.data.filterMonthIndex
    const dayIndex = filterState ? filterState.filterDayIndex : this.data.filterDayIndex
    const yearValue = this.getSelectedFilterValue(yearOptions, yearIndex)
    const monthValue = this.getSelectedFilterValue(monthOptions, monthIndex)
    const dayValue = this.getSelectedFilterValue(dayOptions, dayIndex)
    const filtersActive = Boolean(yearValue || monthValue || dayValue)

    const filteredRecords = (records || []).filter(record => {
      if (!filtersActive) {
        return true
      }
      const parts = record.dateParts || this.parseRecordDateParts(record)
      if (!parts) {
        return false
      }
      if (yearValue && parts.year !== yearValue) {
        return false
      }
      if (monthValue && parts.month !== monthValue) {
        return false
      }
      if (dayValue && parts.day !== dayValue) {
        return false
      }
      return true
    })

    return { filteredRecords, filtersActive }
  },

  onFilterYearChange(e) {
    const filterYearIndex = Number(e.detail.value || 0)
    const yearValue = this.getSelectedFilterValue(this.data.filterYearOptions, filterYearIndex)
    const monthValue = this.getSelectedFilterValue(
      this.data.filterMonthOptions,
      this.data.filterMonthIndex
    )
    const filterDayOptions = this.getDayOptions(yearValue, monthValue)
    const prevDayValue = this.getSelectedFilterValue(
      this.data.filterDayOptions,
      this.data.filterDayIndex
    )
    const filterDayIndex = this.findOptionIndex(filterDayOptions, prevDayValue)
    const filterResult = this.applyRecordFilters(this.data.records, {
      filterYearOptions: this.data.filterYearOptions,
      filterMonthOptions: this.data.filterMonthOptions,
      filterDayOptions,
      filterYearIndex,
      filterMonthIndex: this.data.filterMonthIndex,
      filterDayIndex
    })
    this.setData({
      filterYearIndex,
      filterDayOptions,
      filterDayIndex,
      filteredRecords: filterResult.filteredRecords,
      filtersActive: filterResult.filtersActive
    })
    this.initScrollIndicatorMetrics()
  },

  onFilterMonthChange(e) {
    const filterMonthIndex = Number(e.detail.value || 0)
    const yearValue = this.getSelectedFilterValue(
      this.data.filterYearOptions,
      this.data.filterYearIndex
    )
    const monthValue = this.getSelectedFilterValue(this.data.filterMonthOptions, filterMonthIndex)
    const filterDayOptions = this.getDayOptions(yearValue, monthValue)
    const prevDayValue = this.getSelectedFilterValue(
      this.data.filterDayOptions,
      this.data.filterDayIndex
    )
    const filterDayIndex = this.findOptionIndex(filterDayOptions, prevDayValue)
    const filterResult = this.applyRecordFilters(this.data.records, {
      filterYearOptions: this.data.filterYearOptions,
      filterMonthOptions: this.data.filterMonthOptions,
      filterDayOptions,
      filterYearIndex: this.data.filterYearIndex,
      filterMonthIndex,
      filterDayIndex
    })
    this.setData({
      filterMonthIndex,
      filterDayOptions,
      filterDayIndex,
      filteredRecords: filterResult.filteredRecords,
      filtersActive: filterResult.filtersActive
    })
    this.initScrollIndicatorMetrics()
  },

  onFilterDayChange(e) {
    const filterDayIndex = Number(e.detail.value || 0)
    const filterResult = this.applyRecordFilters(this.data.records, {
      filterYearOptions: this.data.filterYearOptions,
      filterMonthOptions: this.data.filterMonthOptions,
      filterDayOptions: this.data.filterDayOptions,
      filterYearIndex: this.data.filterYearIndex,
      filterMonthIndex: this.data.filterMonthIndex,
      filterDayIndex
    })
    this.setData({
      filterDayIndex,
      filteredRecords: filterResult.filteredRecords,
      filtersActive: filterResult.filtersActive
    })
    this.initScrollIndicatorMetrics()
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

  formatDateParts(parts) {
    if (!parts) {
      return ''
    }
    const year = String(parts.year || '').padStart(4, '0')
    const month = String(parts.month || '').padStart(2, '0')
    const day = String(parts.day || '').padStart(2, '0')
    return `${year}.${month}.${day}`
  },

  formatTimeFromTimestamp(timestamp) {
    if (!timestamp) {
      return ''
    }
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) {
      return ''
    }
    const hour = String(date.getHours()).padStart(2, '0')
    const minute = String(date.getMinutes()).padStart(2, '0')
    return `${hour}:${minute}`
  },

  parseRecordDateParts(record) {
    if (record && record.date) {
      const normalized = String(record.date).replace(/\./g, '-')
      const parts = normalized.split('-')
      if (parts.length >= 3) {
        const year = Number(parts[0])
        const month = Number(parts[1])
        const day = Number(parts[2])
        if (year && month && day) {
          return { year, month, day }
        }
      }
    }
    if (record && record.timestamp) {
      const date = new Date(record.timestamp)
      if (!Number.isNaN(date.getTime())) {
        return {
          year: date.getFullYear(),
          month: date.getMonth() + 1,
          day: date.getDate()
        }
      }
    }
    return null
  },

  onRecordsRefresh() {
    this.loadRecords(true, true)
  },

  onRecordsScroll(e) {
    const scrollTop = Number(e.detail.scrollTop || 0)
    const scrollHeight = Number(e.detail.scrollHeight || 0)
    const prevContentHeight = this.recordsContentHeight || 0
    this.recordsScrollTop = scrollTop
    const contentChanged = scrollHeight && scrollHeight !== prevContentHeight
    if (contentChanged) {
      this.recordsContentHeight = scrollHeight
    }
    if (!this.recordsViewHeight) {
      this.initScrollIndicatorMetrics(scrollHeight)
      return
    }
    this.updateScrollIndicatorState()
  },

  initScrollIndicatorMetrics(scrollHeight) {
    if (this.data.activeTab !== 'stats') {
      return
    }
    if (scrollHeight) {
      this.recordsContentHeight = scrollHeight
    }
    wx.nextTick(() => {
      const query = this.createSelectorQuery()
      query.select('.records-scroll').boundingClientRect()
      query.select('.records-inner').boundingClientRect()
      query.exec(res => {
        const [scrollRect, contentRect] = res || []
        if (!scrollRect) {
          return
        }
        this.recordsViewHeight = scrollRect.height || 0
        if (contentRect && contentRect.height) {
          this.recordsContentHeight = contentRect.height
        }
        this.updateScrollIndicatorState()
      })
    })
  },

  getScrollProgress() {
    const viewHeight = this.recordsViewHeight || 0
    const contentHeight = this.recordsContentHeight || viewHeight
    if (!viewHeight || !contentHeight) {
      return 0
    }
    const maxScrollTop = Math.max(contentHeight - viewHeight, 0)
    if (!maxScrollTop) {
      return 0
    }
    const scrollTop = Math.max(this.recordsScrollTop || 0, 0)
    return Math.min(Math.max(scrollTop / maxScrollTop, 0), 1)
  },

  updateScrollIndicatorState() {
    const progress = this.getScrollProgress()
    const rawIndex = Math.floor(progress * SCROLL_TICK_COUNT)
    const activeIndex = Math.min(Math.max(rawIndex, 0), SCROLL_TICK_COUNT - 1)
    if (activeIndex !== this.data.scrollTickActiveIndex) {
      this.setData({ scrollTickActiveIndex: activeIndex })
    }
  }
})
