const { buildStatistics } = require('../../utils/statistics')
const PAGE_SIZE = 20
const RANGES = [
  { key: 'month', label: '本月' },
  { key: 'year', label: '今年' },
  { key: 'all', label: '全部' }
]

Component({
  options: { styleIsolation: 'isolated' },
  properties: {
    theme: { type: String, value: 'light' },
    contentTop: { type: Number, value: 80 }
  },
  data: {
    status: 'loading',
    refreshing: false,
    range: 'month',
    rangeIndex: 0,
    indicatorPosition: 0,
    ranges: RANGES,
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    panels: RANGES.map(item => ({
      key: item.key,
      summary: buildStatistics([], item.key),
      selectedBucket: null,
      selectedBucketKey: ''
    })),
    updatedTime: ''
  },
  lifetimes: {
    attached() {
      this.records = []
      this.rangeOrigin = 0
      this.reload()
    },
    ready() {
      this.measureSwiper()
    },
    detached() {
      this.requestVersion = (this.requestVersion || 0) + 1
    }
  },
  pageLifetimes: {
    resize() { this.measureSwiper() }
  },
  methods: {
    measureSwiper() {
      this.createSelectorQuery().select('.statistics-swiper').boundingClientRect(rect => {
        if (rect && rect.width > 0) this.swiperWidth = rect.width
      }).exec()
    },
    async reload(isRefresh = false) {
      const version = (this.requestVersion || 0) + 1
      this.requestVersion = version
      this.setData({ status: 'loading', refreshing: !!isRefresh })
      try {
        if (!wx.cloud) throw new Error('Cloud unavailable')
        const db = wx.cloud.database()
        const records = []
        let cursor = ''
        // 按文档 ID 游标读取全部记录，统计不依赖历史列表的分页。
        while (version === this.requestVersion) {
          let query = db.collection('cooking_records')
          if (cursor) query = query.where({ _id: db.command.gt(cursor) })
          const response = await query.field({
            _id: true, timestamp: true, date: true, score: true,
            types: true, typeCounts: true, method: true
          }).orderBy('_id', 'asc').limit(PAGE_SIZE).get()
          if (version !== this.requestVersion) return
          const batch = Array.isArray(response.data) ? response.data : []
          records.push(...batch)
          if (batch.length < PAGE_SIZE) break
          const nextCursor = batch[batch.length - 1]._id
          if (!nextCursor || nextCursor === cursor) throw new Error('Invalid pagination cursor')
          cursor = nextCursor
        }
        if (version !== this.requestVersion) return
        this.records = records
        this.updateSummary()
        const now = new Date()
        this.setData({
          status: 'loaded', refreshing: false,
          updatedTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
        })
      } catch (error) {
        if (version !== this.requestVersion) return
        console.error('[Statistics] Failed to load records:', error)
        this.setData({ status: 'error', refreshing: false })
      }
    },
    updateSummary() {
      const now = new Date()
      const panels = RANGES.map((item, index) => {
        const summary = buildStatistics(this.records, item.key, now)
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        const currentKey = item.key === 'month' ? `${monthKey}-${String(now.getDate()).padStart(2, '0')}` : monthKey
        const previousKey = this.data.panels[index].selectedBucketKey
        const selectedBucket = summary.trend.find(bucket => bucket.key === previousKey)
          || summary.trend.find(bucket => bucket.key === currentKey) || summary.trend[0]
        return { key: item.key, summary, selectedBucket, selectedBucketKey: selectedBucket.key }
      })
      this.setData({ panels })
    },
    onRangeChange(e) {
      const range = e.currentTarget.dataset.range
      const rangeIndex = RANGES.findIndex(item => item.key === range)
      if (rangeIndex < 0 || range === this.data.range) return
      this.rangeOrigin = this.data.rangeIndex
      this.setData({ range, rangeIndex })
    },
    onRangeSwipe(e) {
      const rangeIndex = e.detail.current
      if (!RANGES[rangeIndex] || rangeIndex === this.data.rangeIndex) return
      // 点击已直接更新 current，忽略被后一次点击打断的旧程序切换事件。
      if (e.detail.source !== 'touch') return
      this.setData({ range: RANGES[rangeIndex].key, rangeIndex })
    },
    onRangeTouchStart() {
      this.rangeOrigin = this.data.rangeIndex
    },
    onRangeTransition(e) {
      const dx = Number(e.detail.dx)
      if (!this.swiperWidth || !Number.isFinite(dx)) return
      // 与原生 swiper 的每一帧共用进度，指示线始终跟随手势及惯性动画。
      const progress = (this.rangeOrigin || 0) + dx / this.swiperWidth
      const indicatorPosition = Math.round(Math.max(0, Math.min(RANGES.length - 1, progress)) * 1000) / 1000
      if (indicatorPosition !== this.data.indicatorPosition) this.setData({ indicatorPosition })
    },
    onRangeAnimationEnd(e) {
      const rangeIndex = e.detail.current
      if (!RANGES[rangeIndex] || rangeIndex !== this.data.rangeIndex) return
      this.rangeOrigin = rangeIndex
      this.setData({ range: RANGES[rangeIndex].key, rangeIndex, indicatorPosition: rangeIndex })
    },
    onBucketTap(e) {
      const panelIndex = RANGES.findIndex(item => item.key === e.currentTarget.dataset.range)
      if (panelIndex < 0) return
      const selectedBucket = this.data.panels[panelIndex].summary.trend[Number(e.currentTarget.dataset.index)]
      if (selectedBucket) {
        this.setData({
          [`panels[${panelIndex}].selectedBucket`]: selectedBucket,
          [`panels[${panelIndex}].selectedBucketKey`]: selectedBucket.key
        })
      }
    },
    onRefresh() { this.reload(true) },
    onRetry() { this.reload() },
    onCreate() { this.triggerEvent('create') }
  }
})
