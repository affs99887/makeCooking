// components/recordDrawer/recordDrawer.js
const BASE_TYPE_COUNTS = {
  standard: 0,
  service: 0,
  backin: 0,
  lite: 0,
  reverse: 0
}
const BASE_SPACER_HEIGHT = 160
const MAX_MASK_BLUR = 20
const DEFAULT_DATE_LABEL = '刚刚烹饪完毕'
const DEFAULT_TIME_LABEL = '此刻'
const MODE_CONFIG = {
  create: {
    title: '今日烹饪记录',
    subtitle: '把味道写进日记',
    readonly: false
  },
  view: {
    title: '记录详情',
    subtitle: '把每一次味道收进记忆',
    readonly: true
  },
  edit: {
    title: '编辑记录',
    subtitle: '调整你的记录',
    readonly: false
  }
}

Component({
  options: {
    styleIsolation: 'isolated'
  },

  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer: 'onVisibleChange'
    },
    mode: {
      type: String,
      value: 'create',
      observer: 'onModeChange'
    },
    record: {
      type: Object,
      value: null,
      observer: 'onRecordChange'
    }
  },

  data: {
    isAnimating: false,
    isOpen: false,
    isDragging: false,
    isExpanded: false,
    currentMode: 'create',
    isReadonly: false,
    drawerTitle: MODE_CONFIG.create.title,
    drawerSubtitle: MODE_CONFIG.create.subtitle,
    currentRecordId: '',
    labelDate: DEFAULT_DATE_LABEL,
    labelTime: DEFAULT_TIME_LABEL,
    selectedDate: '',
    selectedTime: '',
    displayDate: '',
    displayTime: '',
    useNowLabel: false,
    showDateEditor: false,
    drawerTranslate: 0,
    maskBlur: 0,
    windowHeight: 0,
    safeAreaTop: 0,
    spacerHeight: BASE_SPACER_HEIGHT,
    typeCounts: Object.assign({}, BASE_TYPE_COUNTS), // 叠加次数
    selectedMethod: '',     // 选中的烹饪手法
    showMethod: false,      // 是否显示手法选择
    currentScore: 0,         // 当前评分
    canSave: false           // 是否可以保存
  },

  lifetimes: {
    attached() {
      this.onModeChange(this.properties.mode)
      this.onRecordChange(this.properties.record)
      this.initDrawerMetrics()
      console.log('[RecordDrawer] Component attached')
    },

    detached() {
      this.clearOpenSettleTimer()
      console.log('[RecordDrawer] Component detached')
    }
  },

  methods: {
    /**
     * 初始化抽屉尺寸信息
     */
    initDrawerMetrics() {
      if (this.data.windowHeight) {
        return
      }
      const systemInfo = wx.getSystemInfoSync()
      let safeAreaTop = 0
      if (systemInfo.safeArea && typeof systemInfo.safeArea.top === 'number') {
        safeAreaTop = systemInfo.safeArea.top
      } else if (
        systemInfo.safeAreaInsets
        && typeof systemInfo.safeAreaInsets.top === 'number'
      ) {
        safeAreaTop = systemInfo.safeAreaInsets.top
      } else if (typeof systemInfo.statusBarHeight === 'number') {
        safeAreaTop = systemInfo.statusBarHeight
      }
      this.setData({
        windowHeight: systemInfo.windowHeight,
        safeAreaTop
      })
    },

    /**
     * 抽屉关键位置
     */
    getDrawerPositions() {
      const windowHeight = this.data.windowHeight || wx.getSystemInfoSync().windowHeight
      const safeAreaTop = this.data.safeAreaTop || 0
      const expanded = Math.max(safeAreaTop + 6, 0)
      const defaultOffset = Math.max(
        Math.round(windowHeight * 0.14),
        expanded + Math.round(windowHeight * 0.08)
      )
      const openOvershoot = Math.round(windowHeight * 0.02)
      const closeThreshold = Math.round(windowHeight * 0.5)
      const expandThreshold = Math.max(
        expanded + Math.round(windowHeight * 0.04),
        expanded + 12
      )
      return {
        closed: windowHeight,
        default: defaultOffset,
        expanded,
        closeThreshold,
        expandThreshold,
        openOvershoot
      }
    },

    getSpacerMetrics(drawerTranslate, positions) {
      const metrics = positions || this.getDrawerPositions()
      const denom = metrics.default - metrics.expanded
      let progress = 1
      if (denom > 0) {
        progress = (drawerTranslate - metrics.expanded) / denom
      }
      if (progress < 0) {
        progress = 0
      } else if (progress > 1) {
        progress = 1
      }
      return {
        spacerHeight: Math.round(BASE_SPACER_HEIGHT * progress)
      }
    },

    getMaskBlur(drawerTranslate, positions) {
      const metrics = positions || this.getDrawerPositions()
      const denom = metrics.closed - metrics.default
      let progress = 1
      if (denom > 0 && drawerTranslate > metrics.default) {
        progress = 1 - (drawerTranslate - metrics.default) / denom
      }
      if (progress < 0) {
        progress = 0
      } else if (progress > 1) {
        progress = 1
      }
      return Number((MAX_MASK_BLUR * progress).toFixed(2))
    },

    setDrawerTranslate(drawerTranslate, extraData, positions) {
      const spacerMetrics = this.getSpacerMetrics(drawerTranslate, positions)
      const maskBlur = this.getMaskBlur(drawerTranslate, positions)
      this.setData(Object.assign({
        drawerTranslate,
        maskBlur
      }, spacerMetrics, extraData || {}))
    },

    clearOpenSettleTimer() {
      if (this.openStartTimer) {
        clearTimeout(this.openStartTimer)
        this.openStartTimer = null
      }
      if (this.openSettleTimer) {
        clearTimeout(this.openSettleTimer)
        this.openSettleTimer = null
      }
    },

    /**
     * 监听visible变化
     */
    onVisibleChange(newVal, oldVal) {
      this.initDrawerMetrics()
      this.clearOpenSettleTimer()
      const positions = this.getDrawerPositions()
      if (newVal) {
        this.setDrawerTranslate(positions.closed, {
          isAnimating: true,
          isOpen: false,
          isDragging: false,
          isExpanded: false
        }, positions)
        wx.nextTick(() => {
          this.openStartTimer = setTimeout(() => {
            const liftTarget = Math.max(
              positions.default - positions.openOvershoot,
              positions.expanded
            )
            this.setDrawerTranslate(liftTarget, { isOpen: true }, positions)
            this.openSettleTimer = setTimeout(() => {
              if (!this.data.isDragging && this.properties.visible) {
                this.setDrawerTranslate(positions.default, null, positions)
              }
            }, 220)
          }, 40)
        })
        // 触觉反馈
        wx.vibrateShort({ type: 'light' })
      } else {
        this.setDrawerTranslate(positions.closed, {
          isOpen: false,
          isDragging: false,
          isExpanded: false
        }, positions)
        // 延迟移除，等待动画完成
        setTimeout(() => {
          this.setData({ isAnimating: false })
        }, 800)
        this.setMode(this.normalizeMode(this.properties.mode))
      }
    },

    /**
     * 点击遮罩关闭
     */
    onMaskTap() {
      this.closeDrawer()
    },

    /**
     * 阻止冒泡（点击抽屉内容不关闭）
     */
    onDrawerTap() {
      // 阻止事件冒泡到遮罩
    },

    /**
     * 拖动开始
     */
    onHandleTouchStart(e) {
      if (!this.properties.visible) {
        return
      }
      this.clearOpenSettleTimer()
      const touch = e.touches[0]
      this.dragStartY = touch.clientY
      this.dragStartTranslate = this.data.drawerTranslate
      this.setData({ isDragging: true })
    },

    /**
     * 拖动中
     */
    onHandleTouchMove(e) {
      if (!this.data.isDragging) {
        return
      }
      const touch = e.touches[0]
      const deltaY = touch.clientY - this.dragStartY
      const positions = this.getDrawerPositions()
      let nextTranslate = this.dragStartTranslate + deltaY

      if (nextTranslate < positions.expanded) {
        nextTranslate =
          positions.expanded + (nextTranslate - positions.expanded) * 0.28
      } else if (nextTranslate > positions.closed) {
        nextTranslate =
          positions.closed + (nextTranslate - positions.closed) * 0.28
      }

      this.setDrawerTranslate(nextTranslate, null, positions)
    },

    /**
     * 拖动结束
     */
    onHandleTouchEnd() {
      if (!this.data.isDragging) {
        return
      }
      const positions = this.getDrawerPositions()
      const current = this.data.drawerTranslate
      let target = positions.default
      let isExpanded = false

      if (current > positions.closeThreshold) {
        this.setData({ isDragging: false })
        this.closeDrawer()
        return
      }

      if (current < positions.expandThreshold) {
        target = positions.expanded
        isExpanded = true
      }

      this.setDrawerTranslate(target, {
        isDragging: false,
        isExpanded
      }, positions)
    },

    /**
     * 关闭抽屉
     */
    closeDrawer() {
      this.setData({ visible: false })
      this.triggerEvent('close')
    },

    /**
     * 切换烹饪风格选择（多选）
     */
    onTypeToggle(e) {
      if (this.data.isReadonly) {
        return
      }
      if (this.ignoreTypeTap) {
        this.ignoreTypeTap = false
        return
      }
      const type = e.currentTarget.dataset.type
      const typeCounts = Object.assign({}, this.data.typeCounts)

      if (!Object.prototype.hasOwnProperty.call(typeCounts, type)) {
        return
      }

      // 触觉反馈
      wx.vibrateShort({ type: 'light' })

      typeCounts[type] += 1

      const showMethod = typeCounts.service > 0
      let { selectedMethod } = this.data
      if (!showMethod) {
        selectedMethod = ''
      }

      this.setData({
        typeCounts,
        showMethod,
        selectedMethod
      })

      this.checkCanSave()
    },

    /**
     * 减少烹饪风格次数（长按或点击计数）
     */
    onTypeDecrease(e) {
      if (this.data.isReadonly) {
        return
      }
      const type = e.currentTarget.dataset.type
      const typeCounts = Object.assign({}, this.data.typeCounts)

      if (!Object.prototype.hasOwnProperty.call(typeCounts, type)) {
        return
      }

      if (typeCounts[type] <= 0) {
        return
      }

      this.ignoreTypeTap = true
      wx.vibrateShort({ type: 'light' })

      typeCounts[type] -= 1

      const showMethod = typeCounts.service > 0
      let { selectedMethod } = this.data
      if (!showMethod) {
        selectedMethod = ''
      }

      this.setData({
        typeCounts,
        showMethod,
        selectedMethod
      })

      this.checkCanSave()
    },

    /**
     * 选择烹饪手法（单选）
     */
    onMethodSelect(e) {
      if (this.data.isReadonly) {
        return
      }
      const method = e.currentTarget.dataset.method

      // 触觉反馈
      wx.vibrateShort({ type: 'medium' })

      this.setData({
        selectedMethod: method
      })

      this.checkCanSave()
    },

    /**
     * 评分滑块变化中
     */
    onScoreChanging(e) {
      if (this.data.isReadonly) {
        return
      }
      this.setData({
        currentScore: e.detail.value
      })
    },

    /**
     * 评分滑块变化完成
     */
    onScoreChange(e) {
      if (this.data.isReadonly) {
        return
      }
      const score = e.detail.value

      // 触觉反馈
      wx.vibrateShort({ type: 'light' })

      this.setData({
        currentScore: score
      })

      this.checkCanSave()
    },

    /**
     * 检查是否可以保存
     */
    checkCanSave() {
      const { typeCounts, selectedMethod, currentScore } = this.data

      // 至少选择一种风格
      const hasType = Object.keys(typeCounts).some(key => typeCounts[key] > 0)

      // 如果选择了Service，必须选择手法
      const hasMethod = typeCounts.service > 0 ? selectedMethod !== '' : true

      // 评分大于0
      const hasScore = currentScore > 0

      const canSave = hasType && hasMethod && hasScore

      this.setData({ canSave })
    },

    /**
     * 保存记录
     */
    onSave() {
      if (this.data.isReadonly || !this.data.canSave) {
        return
      }

      wx.vibrateShort({ type: 'heavy' })

      if (this.data.currentMode === 'edit') {
        const recordData = this.buildRecordData(true)
        console.log('[RecordDrawer] Update record:', recordData)
        this.triggerEvent('update', recordData)
        setTimeout(() => {
          this.closeDrawer()
        }, 300)
        return
      }

      const recordData = this.buildRecordData(false)
      console.log('[RecordDrawer] Save record:', recordData)
      this.triggerEvent('save', recordData)
      wx.showToast({
        title: '记录保存成功',
        icon: 'success',
        duration: 2000
      })
      setTimeout(() => {
        this.closeDrawer()
        this.resetForm()
      }, 1000)
    },

    /**
     * 重置表单
     */
    resetForm() {
      const dateState = this.getDateTimeState(new Date())
      this.setData(Object.assign({}, dateState, {
        typeCounts: Object.assign({}, BASE_TYPE_COUNTS),
        selectedMethod: '',
        showMethod: false,
        currentScore: 0,
        canSave: false,
        currentRecordId: '',
        useNowLabel: true,
        showDateEditor: false
      }))
    },

    /**
     * 格式化日期
     */
    formatDate(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}.${month}.${day}`
    },

    formatPickerDate(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },

    formatTime(date) {
      const hour = String(date.getHours()).padStart(2, '0')
      const minute = String(date.getMinutes()).padStart(2, '0')
      return `${hour}:${minute}`
    },

    formatDisplayDate(pickerDate) {
      if (!pickerDate) {
        return ''
      }
      const parts = String(pickerDate).split('-')
      if (parts.length < 3) {
        return pickerDate
      }
      return `${parts[0]}.${parts[1]}.${parts[2]}`
    },

    getDateTimeState(date) {
      const baseDate = date instanceof Date && !Number.isNaN(date.getTime())
        ? date
        : new Date()
      return {
        selectedDate: this.formatPickerDate(baseDate),
        selectedTime: this.formatTime(baseDate),
        displayDate: this.formatDate(baseDate),
        displayTime: this.formatTime(baseDate),
        useNowLabel: false
      }
    },

    parseDateParts(dateStr) {
      if (!dateStr) {
        return null
      }
      const normalized = String(dateStr).replace(/\./g, '-')
      const parts = normalized.split('-')
      if (parts.length < 3) {
        return null
      }
      const year = Number(parts[0])
      const month = Number(parts[1])
      const day = Number(parts[2])
      if (!year || !month || !day) {
        return null
      }
      return { year, month, day }
    },

    parseTimeParts(timeStr) {
      if (!timeStr) {
        return null
      }
      const parts = String(timeStr).split(':')
      if (parts.length < 2) {
        return null
      }
      const hour = Number(parts[0])
      const minute = Number(parts[1])
      if (Number.isNaN(hour) || Number.isNaN(minute)) {
        return null
      }
      return { hour, minute }
    },

    createDateFromPicker(dateStr, timeStr) {
      const dateParts = this.parseDateParts(dateStr)
      if (!dateParts) {
        return null
      }
      const timeParts = this.parseTimeParts(timeStr) || { hour: 0, minute: 0 }
      const date = new Date(
        dateParts.year,
        dateParts.month - 1,
        dateParts.day,
        timeParts.hour,
        timeParts.minute
      )
      if (Number.isNaN(date.getTime())) {
        return null
      }
      return date
    },

    resolveRecordDate(record) {
      if (record && record.timestamp) {
        const timestampDate = new Date(record.timestamp)
        if (!Number.isNaN(timestampDate.getTime())) {
          return timestampDate
        }
      }
      const dateStr = record ? record.date : ''
      const timeStr = record ? record.time : ''
      const date = this.createDateFromPicker(dateStr, timeStr)
      return date || new Date()
    },

    onDateChange(e) {
      if (this.data.isReadonly) {
        return
      }
      const selectedDate = e.detail.value
      this.setData({
        selectedDate,
        displayDate: this.formatDisplayDate(selectedDate),
        useNowLabel: false
      })
    },

    onTimeChange(e) {
      if (this.data.isReadonly) {
        return
      }
      const selectedTime = e.detail.value
      this.setData({
        selectedTime,
        displayTime: selectedTime,
        displayDate: this.formatDisplayDate(this.data.selectedDate),
        useNowLabel: false
      })
    },

    onToggleDateEditor() {
      if (this.data.isReadonly) {
        return
      }
      const nextShow = !this.data.showDateEditor
      const nextData = { showDateEditor: nextShow }
      if (nextShow) {
        nextData.useNowLabel = false
        nextData.displayDate = this.formatDisplayDate(this.data.selectedDate)
        nextData.displayTime = this.data.selectedTime
      }
      this.setData(nextData)
    },

    onModeChange(newVal) {
      const mode = this.normalizeMode(newVal)
      this.setMode(mode)
      if (mode === 'create' && !this.properties.record) {
        this.resetForm()
      }
    },

    onRecordChange(record) {
      if (record && typeof record === 'object') {
        this.applyRecord(record)
        return
      }
      if (this.normalizeMode(this.properties.mode) === 'create') {
        this.resetForm()
      }
    },

    normalizeMode(mode) {
      if (mode === 'view' || mode === 'edit' || mode === 'create') {
        return mode
      }
      return 'create'
    },

    setMode(mode) {
      const config = MODE_CONFIG[mode] || MODE_CONFIG.create
      this.setData({
        currentMode: mode,
        isReadonly: config.readonly,
        drawerTitle: config.title,
        drawerSubtitle: config.subtitle,
        showDateEditor: false
      })
    },

    applyRecord(record) {
      const typeCounts = this.normalizeTypeCounts(record)
      const showMethod = typeCounts.service > 0
      let selectedMethod = record.method || ''
      if (!showMethod) {
        selectedMethod = ''
      }
      const score = Number(record.score || 0)
      const recordId = record._id || record.id || ''
      const dateState = this.getDateTimeState(this.resolveRecordDate(record))

      this.setData(Object.assign({
        typeCounts,
        showMethod,
        selectedMethod,
        currentScore: score,
        currentRecordId: recordId,
        showDateEditor: false
      }, dateState))

      this.checkCanSave()
    },

    normalizeTypeCounts(record) {
      if (record.typeCounts && typeof record.typeCounts === 'object') {
        return Object.assign({}, BASE_TYPE_COUNTS, record.typeCounts)
      }
      const counts = Object.assign({}, BASE_TYPE_COUNTS)
      const types = Array.isArray(record.types) ? record.types : []
      types.forEach(type => {
        if (Object.prototype.hasOwnProperty.call(counts, type)) {
          counts[type] += 1
        }
      })
      return counts
    },

    buildRecordData(includeId) {
      const typeCounts = Object.assign({}, this.data.typeCounts)
      const types = Object.keys(typeCounts).filter(key => typeCounts[key] > 0)
      const dateValue = this.createDateFromPicker(this.data.selectedDate, this.data.selectedTime)
      const baseDate = dateValue || new Date()
      const timestamp = baseDate.getTime()
      const date = this.formatDate(baseDate)
      const time = this.data.selectedTime || this.formatTime(baseDate)
      const recordData = {
        types,
        typeCounts,
        method: this.data.selectedMethod,
        score: this.data.currentScore,
        timestamp,
        date,
        time
      }
      if (includeId) {
        recordData._id = this.data.currentRecordId
      }
      return recordData
    },

    onEdit() {
      this.setMode('edit')
      this.checkCanSave()
    },

    onDelete() {
      if (!this.data.currentRecordId) {
        return
      }
      wx.showModal({
        title: '删除记录',
        content: '确定要删除这条记录吗？',
        confirmText: '删除',
        confirmColor: '#d57b73',
        cancelText: '取消',
        success: res => {
          if (res.confirm) {
            this.triggerEvent('delete', { id: this.data.currentRecordId })
            this.closeDrawer()
          }
        }
      })
    }
  }
})
