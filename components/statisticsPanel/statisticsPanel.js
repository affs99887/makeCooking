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
    ranges: RANGES,
    summary: buildStatistics([]),
    selectedBucket: null,
    selectedBucketKey: '',
    trendScrollTarget: '',
    updatedTime: ''
  },
  lifetimes: {
    attached() {
      this.records = []
      this.reload()
    },
    detached() {
      this.requestVersion = (this.requestVersion || 0) + 1
    }
  },
  methods: {
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
      const summary = buildStatistics(this.records, this.data.range, now)
      const currentKey = this.data.range === 'month'
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const selectedBucket = summary.trend.find(bucket => bucket.key === currentKey) || summary.trend[0]
      const selectedIndex = summary.trend.indexOf(selectedBucket)
      this.setData({
        summary,
        selectedBucket,
        selectedBucketKey: selectedBucket.key,
        trendScrollTarget: `trend-${Math.max(selectedIndex - 3, 0)}`
      })
    },
    onRangeChange(e) {
      const range = e.currentTarget.dataset.range
      if (!RANGES.some(item => item.key === range) || range === this.data.range) return
      this.setData({ range })
      this.updateSummary()
    },
    onBucketTap(e) {
      const selectedBucket = this.data.summary.trend[Number(e.currentTarget.dataset.index)]
      if (selectedBucket) {
        this.setData({ selectedBucket, selectedBucketKey: selectedBucket.key })
      }
    },
    onRefresh() { this.reload(true) },
    onRetry() { this.reload() },
    onCreate() { this.triggerEvent('create') }
  }
})
