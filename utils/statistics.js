const TYPE_NAMES = {
  standard: '标准',
  service: '服务',
  backin: '回味',
  lite: '清淡',
  reverse: '反转',
  suck: '萨克',
  sidein: '侧边'
}

const formatNumber = value => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const pad = value => String(value).padStart(2, '0')
const dayKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
const monthKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`

function getRecordDate(record) {
  const match = String(record.date || '').match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})$/)
  if (match) {
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
    if (date.getFullYear() === Number(match[1])
      && date.getMonth() === Number(match[2]) - 1
      && date.getDate() === Number(match[3])) {
      return date
    }
  }
  if (record.timestamp !== undefined && record.timestamp !== null) {
    const date = new Date(record.timestamp)
    if (Number.isFinite(date.getTime())) {
      return date
    }
  }
  return null
}

function getTypeCounts(record) {
  const counts = {}
  Object.keys(TYPE_NAMES).forEach(key => { counts[key] = 0 })
  if (record.typeCounts && typeof record.typeCounts === 'object') {
    Object.keys(counts).forEach(key => {
      const value = Number(record.typeCounts[key])
      counts[key] = Number.isFinite(value) ? Math.max(Math.floor(value), 0) : 0
    })
  } else {
    ;(Array.isArray(record.types) ? record.types : []).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(counts, key)) {
        counts[key] += 1
      }
    })
  }
  return counts
}

function normalizeRecord(record) {
  const rawScore = record.score
  const numberScore = Number(rawScore)
  const score = rawScore !== undefined && rawScore !== null && rawScore !== ''
    && Number.isFinite(numberScore) && numberScore >= 0 ? numberScore : null
  return {
    date: getRecordDate(record),
    score,
    counts: getTypeCounts(record),
    method: String(record.method || '').trim()
  }
}

function buildTrend(records, range, now) {
  const buckets = []
  if (range === 'month') {
    const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    for (let day = 1; day <= days; day += 1) {
      const date = new Date(now.getFullYear(), now.getMonth(), day)
      buckets.push({ key: dayKey(date), label: String(day), dateLabel: `${now.getMonth() + 1}月${day}日`, count: 0, scores: [] })
    }
  } else {
    for (let index = 0; index < 12; index += 1) {
      const date = range === 'year'
        ? new Date(now.getFullYear(), index, 1)
        : new Date(now.getFullYear(), now.getMonth() - 11 + index, 1)
      buckets.push({
        key: monthKey(date),
        label: `${date.getMonth() + 1}月`,
        dateLabel: `${date.getFullYear()}年${date.getMonth() + 1}月`,
        count: 0,
        scores: []
      })
    }
  }
  const lookup = {}
  buckets.forEach(bucket => { lookup[bucket.key] = bucket })
  records.forEach(record => {
    if (!record.date) return
    const key = range === 'month' ? dayKey(record.date) : monthKey(record.date)
    const bucket = lookup[key]
    if (!bucket) return
    bucket.count += 1
    if (record.score !== null) bucket.scores.push(record.score)
  })
  const maxCount = Math.max(1, ...buckets.map(bucket => bucket.count))
  return {
    trendMax: maxCount,
    trendMiddle: maxCount > 1 ? Math.round(maxCount / 2) : '',
    trend: buckets.map(bucket => ({
      key: bucket.key,
      label: bucket.label,
      dateLabel: bucket.dateLabel,
      count: bucket.count,
      height: Math.round(bucket.count / maxCount * 100),
      averageScoreText: bucket.scores.length
        ? formatNumber(Math.round(bucket.scores.reduce((sum, score) => sum + score, 0) / bucket.scores.length))
        : '—'
    }))
  }
}

function buildCalendar(trend, now) {
  // 周一为每周第一天，首尾补齐空格，保证每一行都是完整的一周。
  const offset = (new Date(now.getFullYear(), now.getMonth(), 1).getDay() + 6) % 7
  const cells = Array.from({ length: offset }, (_, index) => ({ key: `before-${index}`, isEmpty: true }))
  trend.forEach((bucket, index) => {
    cells.push(Object.assign({}, bucket, {
      trendIndex: index,
      isToday: index + 1 === now.getDate(),
      isFuture: index + 1 > now.getDate()
    }))
  })
  while (cells.length % 7) {
    cells.push({ key: `after-${cells.length}`, isEmpty: true })
  }
  return cells
}

function buildStatistics(source, range = 'month', now = new Date()) {
  const allRecords = (Array.isArray(source) ? source : []).map(normalizeRecord)
  const records = allRecords.filter(record => {
    if (range === 'all') return true
    if (!record.date || record.date.getFullYear() !== now.getFullYear()) return false
    return range === 'year' || record.date.getMonth() === now.getMonth()
  })
  const scores = records.filter(record => record.score !== null).map(record => record.score)
  const days = new Set()
  const counts = {}
  const methods = {}
  Object.keys(TYPE_NAMES).forEach(key => { counts[key] = 0 })
  records.forEach(record => {
    if (record.date) days.add(dayKey(record.date))
    Object.keys(counts).forEach(key => { counts[key] += record.counts[key] })
    if (record.method) methods[record.method] = (methods[record.method] || 0) + 1
  })
  const activityCount = Object.values(counts).reduce((sum, value) => sum + value, 0)
  const breakdown = Object.keys(TYPE_NAMES).map(key => ({
    key,
    label: TYPE_NAMES[key],
    count: counts[key],
    countText: formatNumber(counts[key]),
    percent: activityCount ? Math.round(counts[key] / activityCount * 100) : 0,
    width: activityCount ? counts[key] / activityCount * 100 : 0
  })).filter(item => item.count > 0).sort((a, b) => b.count - a.count)
  const methodBreakdown = Object.keys(methods).map(label => ({ label, count: methods[label] }))
    .sort((a, b) => b.count - a.count).slice(0, 3)
  const rangeLabel = range === 'month'
    ? `${now.getFullYear()}.${pad(now.getMonth() + 1)}`
    : (range === 'year' ? `${now.getFullYear()} 年` : '全部记录')
  const averageScore = scores.length
    ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length) : null
  const bestScore = scores.length ? scores.reduce((best, score) => Math.max(best, score), 0) : null
  const trendSummary = buildTrend(records, range, now)
  return Object.assign({
    recordCount: records.length,
    recordCountText: formatNumber(records.length),
    allRecordCount: allRecords.length,
    activityCount,
    activityCountText: formatNumber(activityCount),
    activeDays: days.size,
    scoredCount: scores.length,
    averageScore,
    averageScoreText: averageScore === null ? '—' : formatNumber(averageScore),
    bestScore,
    bestScoreText: bestScore === null ? '—' : formatNumber(bestScore),
    rangeLabel,
    breakdown,
    methodBreakdown,
    trendTitle: range === 'month' ? '每日记录' : '每月记录',
    trendCaption: range === 'all' ? '近 12 个月' : rangeLabel,
    calendar: range === 'month' ? buildCalendar(trendSummary.trend, now) : []
  }, trendSummary)
}

module.exports = { buildStatistics }
