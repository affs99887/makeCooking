// components/recordDrawer/recordDrawer.js
const BASE_TYPE_COUNTS = {
  standard: 0,
  service: 0,
  backin: 0,
  lite: 0,
  reverse: 0,
  suck: 0
}
const BASE_TYPE_SCORES = {
  standard: 0,
  service: 0,
  backin: 0,
  lite: 0,
  reverse: 0,
  suck: 0
}
const TYPE_LABELS = {
  standard: '标准',
  service: '服务',
  backin: '回味',
  lite: '清淡',
  reverse: '反转',
  suck: '萨克'
}
const TYPE_ORDER = ['standard', 'service', 'backin', 'lite', 'reverse', 'suck']
const SCORE_MODE = {
  total: 'total',
  perType: 'perType'
}
const TOTAL_SCORE_MAX = 4100
const TYPE_SCORE_MAX = 4000
const SCORE_STEP = 100
const SECTION_EXIT_DURATION = 360
const SCORE_SLOT_DURATION = 620
const SLOT_ENTER_DELAY = 200
const SCORE_FADE_DURATION = 200
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
    },
    scoreMax: {
      type: Number,
      value: TOTAL_SCORE_MAX,
      observer: 'onScoreMaxChange'
    }
  },

  data: {
    isAnimating: false,
    isOpen: false,
    isDragging: false,
    isExpanded: false,
    isClosing: false,
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
    renderMethodSection: false,
    methodSlotOpen: false,
    methodVisible: false,
    methodExiting: false,
    scoreMode: SCORE_MODE.total,
    scoreModeManual: false,
    typeScores: Object.assign({}, BASE_TYPE_SCORES),
    totalScore: 0,
    scoreTypeList: [],
    showScoreSection: false,
    renderScoreSection: false,
    scoreSlotOpen: false,
    scoreVisible: false,
    showScoreToggle: false,
    totalScoreMax: TOTAL_SCORE_MAX,
    typeScoreMax: TYPE_SCORE_MAX,
    scoreStep: SCORE_STEP,
    currentScore: 0,         // 当前评分（总分模式）
    canSave: false           // 是否可以保存
  },

  lifetimes: {
    attached() {
      this.onModeChange(this.properties.mode)
      this.onRecordChange(this.properties.record)
      this.onScoreMaxChange(this.properties.scoreMax)
      this.initDrawerMetrics()
      console.log('[RecordDrawer] Component attached')
    },

    detached() {
      this.clearOpenSettleTimer()
      this.clearClosingTimer()
      this.clearMethodTimers()
      this.clearScoreTimers()
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

    clearClosingTimer() {
      if (this.closingTimer) {
        clearTimeout(this.closingTimer)
        this.closingTimer = null
      }
    },

    clearMethodTimers() {
      if (this.methodEnterTimer) {
        clearTimeout(this.methodEnterTimer)
        this.methodEnterTimer = null
      }
      if (this.methodExitTimer) {
        clearTimeout(this.methodExitTimer)
        this.methodExitTimer = null
      }
      if (this.methodRemoveTimer) {
        clearTimeout(this.methodRemoveTimer)
        this.methodRemoveTimer = null
      }
    },

    clearScoreTimers() {
      if (this.scoreEnterTimer) {
        clearTimeout(this.scoreEnterTimer)
        this.scoreEnterTimer = null
      }
      if (this.scoreCollapseTimer) {
        clearTimeout(this.scoreCollapseTimer)
        this.scoreCollapseTimer = null
      }
      if (this.scoreRemoveTimer) {
        clearTimeout(this.scoreRemoveTimer)
        this.scoreRemoveTimer = null
      }
    },

    updateMethodSectionTransition(shouldShow, prevShow) {
      if (shouldShow === prevShow) {
        return
      }
      this.clearMethodTimers()
      if (shouldShow) {
        this.setData({
          renderMethodSection: true,
          methodSlotOpen: false,
          methodVisible: false,
          methodExiting: false
        })
        wx.nextTick(() => {
          if (!this.data.showMethod) {
            return
          }
          this.setData({ methodSlotOpen: true })
          this.methodEnterTimer = setTimeout(() => {
            if (this.data.showMethod) {
              this.setData({ methodVisible: true })
            }
          }, SLOT_ENTER_DELAY)
        })
        return
      }

      if (!this.data.renderMethodSection) {
        return
      }
      if (!this.data.methodVisible) {
        this.setData({
          methodVisible: false,
          methodExiting: false,
          methodSlotOpen: false
        })
        this.methodRemoveTimer = setTimeout(() => {
          if (!this.data.showMethod) {
            this.setData({ renderMethodSection: false })
          }
        }, SCORE_SLOT_DURATION)
        return
      }
      this.setData({ methodExiting: true })
      this.methodExitTimer = setTimeout(() => {
        if (!this.data.showMethod) {
          this.setData({
            methodVisible: false,
            methodExiting: false,
            methodSlotOpen: false
          })
          this.methodRemoveTimer = setTimeout(() => {
            if (!this.data.showMethod) {
              this.setData({ renderMethodSection: false })
            }
          }, SCORE_SLOT_DURATION)
        }
      }, SECTION_EXIT_DURATION)
    },

    updateScoreSectionTransition(shouldShow, prevShow) {
      if (shouldShow === prevShow) {
        return
      }
      this.clearScoreTimers()
      if (shouldShow) {
        this.setData({
          renderScoreSection: true,
          scoreSlotOpen: false,
          scoreVisible: false
        })
        wx.nextTick(() => {
          if (!this.data.showScoreSection) {
            return
          }
          this.setData({ scoreSlotOpen: true })
          this.scoreEnterTimer = setTimeout(() => {
            if (this.data.showScoreSection) {
              this.setData({ scoreVisible: true })
            }
          }, SLOT_ENTER_DELAY)
        })
        return
      }

      if (!this.data.renderScoreSection) {
        return
      }
      this.setData({ scoreVisible: false })
      this.scoreCollapseTimer = setTimeout(() => {
        if (!this.data.showScoreSection) {
          this.setData({ scoreSlotOpen: false })
          this.scoreRemoveTimer = setTimeout(() => {
            if (!this.data.showScoreSection) {
              this.setData({ renderScoreSection: false })
            }
          }, SCORE_SLOT_DURATION)
        }
      }, SCORE_FADE_DURATION)
    },

    /**
     * 监听visible变化
     */
    onVisibleChange(newVal, oldVal) {
      this.initDrawerMetrics()
      this.clearOpenSettleTimer()
      this.clearClosingTimer()
      this.clearMethodTimers()
      this.clearScoreTimers()
      const positions = this.getDrawerPositions()
      if (newVal) {
        this.setData({ isClosing: false })
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
        this.setData({ isClosing: true })
        this.closingTimer = setTimeout(() => {
          if (!this.properties.visible) {
            this.setData({ isClosing: false })
          }
        }, SECTION_EXIT_DURATION)
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
      const typeScores = Object.assign({}, this.data.typeScores)

      if (!Object.prototype.hasOwnProperty.call(typeCounts, type)) {
        return
      }

      // 触觉反馈
      wx.vibrateShort({ type: 'light' })

      typeCounts[type] += 1

      const showMethod = typeCounts.suck > 0
      let { selectedMethod } = this.data
      if (!showMethod) {
        selectedMethod = ''
      }
      const prevShowScore = this.data.showScoreSection
      const prevShowMethod = this.data.showMethod

      const modeState = this.resolveScoreModeState(
        typeCounts,
        this.data.scoreMode,
        this.data.scoreModeManual
      )
      const syncState = this.syncSingleTypeScore(
        modeState.activeTypes,
        typeScores,
        this.data.currentScore,
        modeState.scoreMode,
        this.data.scoreMode
      )
      const scoreState = this.getScoreState(
        typeCounts,
        syncState.typeScores,
        modeState.scoreMode,
        syncState.currentScore
      )
      this.setData(Object.assign({
        typeCounts,
        typeScores: syncState.typeScores,
        showMethod,
        selectedMethod,
        currentScore: syncState.currentScore,
        scoreMode: modeState.scoreMode,
        scoreModeManual: modeState.scoreModeManual,
        showScoreSection: modeState.showScoreSection,
        showScoreToggle: modeState.showScoreToggle
      }, scoreState), () => {
        this.updateMethodSectionTransition(showMethod, prevShowMethod)
        this.updateScoreSectionTransition(modeState.showScoreSection, prevShowScore)
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
      const typeScores = Object.assign({}, this.data.typeScores)

      if (!Object.prototype.hasOwnProperty.call(typeCounts, type)) {
        return
      }

      if (typeCounts[type] <= 0) {
        return
      }

      this.ignoreTypeTap = true
      wx.vibrateShort({ type: 'light' })

      typeCounts[type] -= 1
      if (typeCounts[type] <= 0) {
        typeCounts[type] = 0
        typeScores[type] = 0
      }

      const showMethod = typeCounts.suck > 0
      let { selectedMethod } = this.data
      if (!showMethod) {
        selectedMethod = ''
      }
      const prevShowScore = this.data.showScoreSection
      const prevShowMethod = this.data.showMethod

      const modeState = this.resolveScoreModeState(
        typeCounts,
        this.data.scoreMode,
        this.data.scoreModeManual
      )
      const syncState = this.syncSingleTypeScore(
        modeState.activeTypes,
        typeScores,
        this.data.currentScore,
        modeState.scoreMode,
        this.data.scoreMode
      )
      const scoreState = this.getScoreState(
        typeCounts,
        syncState.typeScores,
        modeState.scoreMode,
        syncState.currentScore
      )
      this.setData(Object.assign({
        typeCounts,
        typeScores: syncState.typeScores,
        showMethod,
        selectedMethod,
        currentScore: syncState.currentScore,
        scoreMode: modeState.scoreMode,
        scoreModeManual: modeState.scoreModeManual,
        showScoreSection: modeState.showScoreSection,
        showScoreToggle: modeState.showScoreToggle
      }, scoreState), () => {
        this.updateMethodSectionTransition(showMethod, prevShowMethod)
        this.updateScoreSectionTransition(modeState.showScoreSection, prevShowScore)
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
     * 切换评分模式（分开/总分）
     */
    onScoreModeToggle() {
      const nextMode =
        this.data.scoreMode === SCORE_MODE.total
          ? SCORE_MODE.perType
          : SCORE_MODE.total
      this.setScoreMode(nextMode)
    },

    onScoreModeTab(e) {
      const nextMode = e.currentTarget.dataset.mode
      this.setScoreMode(nextMode)
    },

    setScoreMode(nextMode) {
      if (this.data.isReadonly) {
        return
      }
      if (nextMode !== SCORE_MODE.total && nextMode !== SCORE_MODE.perType) {
        return
      }
      if (nextMode === this.data.scoreMode) {
        return
      }
      const activeTypes = this.getActiveTypes(this.data.typeCounts)
      if (activeTypes.length <= 1) {
        return
      }
      const scoreState = this.getScoreState(
        this.data.typeCounts,
        this.data.typeScores,
        nextMode,
        this.data.currentScore
      )

      this.setData(Object.assign({
        scoreMode: nextMode,
        scoreModeManual: true,
        showScoreSection: true,
        showScoreToggle: true
      }, scoreState))

      this.checkCanSave()
    },

    /**
     * 评分滑块变化中（总分）
     */
    onScoreChanging(e) {
      if (this.data.isReadonly || this.data.scoreMode !== SCORE_MODE.total) {
        return
      }
      const currentScore = Number(e.detail.value || 0)
      const activeTypes = this.getActiveTypes(this.data.typeCounts)
      const nextData = {
        currentScore,
        totalScore: currentScore
      }
      if (activeTypes.length === 1) {
        const type = activeTypes[0]
        const typeScores = Object.assign({}, this.data.typeScores, {
          [type]: currentScore
        })
        nextData.typeScores = typeScores
        nextData.scoreTypeList = this.buildScoreTypeList(this.data.typeCounts, typeScores)
      }
      this.setData(nextData)
    },

    /**
     * 评分滑块变化完成（总分）
     */
    onScoreChange(e) {
      if (this.data.isReadonly || this.data.scoreMode !== SCORE_MODE.total) {
        return
      }
      const score = Number(e.detail.value || 0)

      // 触觉反馈
      wx.vibrateShort({ type: 'light' })

      const activeTypes = this.getActiveTypes(this.data.typeCounts)
      const nextData = {
        currentScore: score,
        totalScore: score
      }
      if (activeTypes.length === 1) {
        const type = activeTypes[0]
        const typeScores = Object.assign({}, this.data.typeScores, {
          [type]: score
        })
        nextData.typeScores = typeScores
        nextData.scoreTypeList = this.buildScoreTypeList(this.data.typeCounts, typeScores)
      }
      this.setData(nextData)

      this.checkCanSave()
    },

    /**
     * 评分滑块变化中（分项）
     */
    onTypeScoreChanging(e) {
      if (this.data.isReadonly || this.data.scoreMode !== SCORE_MODE.perType) {
        return
      }
      const type = e.currentTarget.dataset.type
      if (!type) {
        return
      }
      const score = Number(e.detail.value || 0)
      const typeScores = Object.assign({}, this.data.typeScores, {
        [type]: score
      })
      const totalScore = this.computePerTypeTotal(this.data.typeCounts, typeScores)
      const scoreTypeList = this.buildScoreTypeList(this.data.typeCounts, typeScores)

      this.setData({
        typeScores,
        totalScore,
        scoreTypeList
      })
    },

    /**
     * 评分滑块变化完成（分项）
     */
    onTypeScoreChange(e) {
      if (this.data.isReadonly || this.data.scoreMode !== SCORE_MODE.perType) {
        return
      }
      const type = e.currentTarget.dataset.type
      if (!type) {
        return
      }
      const score = Number(e.detail.value || 0)

      // 触觉反馈
      wx.vibrateShort({ type: 'light' })

      const typeScores = Object.assign({}, this.data.typeScores, {
        [type]: score
      })
      const totalScore = this.computePerTypeTotal(this.data.typeCounts, typeScores)
      const scoreTypeList = this.buildScoreTypeList(this.data.typeCounts, typeScores)

      this.setData({
        typeScores,
        totalScore,
        scoreTypeList
      })

      this.checkCanSave()
    },

    getActiveTypes(typeCounts) {
      return TYPE_ORDER.filter(key => Number(typeCounts[key] || 0) > 0)
    },

    resolveScoreModeState(typeCounts, scoreMode, scoreModeManual) {
      const activeTypes = this.getActiveTypes(typeCounts)
      let nextMode = scoreMode
      let manual = scoreModeManual
      if (activeTypes.length <= 1) {
        nextMode = SCORE_MODE.total
        manual = false
      } else if (!scoreModeManual) {
        nextMode = SCORE_MODE.perType
      }
      return {
        activeTypes,
        scoreMode: nextMode,
        scoreModeManual: manual,
        showScoreSection: activeTypes.length > 0,
        showScoreToggle: activeTypes.length > 1
      }
    },

    syncSingleTypeScore(activeTypes, typeScores, currentScore, scoreMode, prevScoreMode) {
      if (activeTypes.length !== 1) {
        return { typeScores, currentScore }
      }
      const type = activeTypes[0]
      let nextScore = Number(currentScore || 0)
      const nextTypeScores = Object.assign({}, typeScores)
      if (scoreMode === SCORE_MODE.total) {
        if (prevScoreMode === SCORE_MODE.perType) {
          nextScore = Number(nextTypeScores[type] || 0)
        }
        nextTypeScores[type] = nextScore
      }
      return {
        typeScores: nextTypeScores,
        currentScore: nextScore
      }
    },

    buildScoreTypeList(typeCounts, typeScores) {
      return TYPE_ORDER.reduce((list, key) => {
        const count = Number(typeCounts[key] || 0)
        if (count > 0) {
          list.push({
            key,
            label: TYPE_LABELS[key] || key,
            count,
            score: Number(typeScores[key] || 0)
          })
        }
        return list
      }, [])
    },

    computePerTypeTotal(typeCounts, typeScores) {
      return TYPE_ORDER.reduce((total, key) => {
        if (typeCounts[key] > 0) {
          return total + Number(typeScores[key] || 0)
        }
        return total
      }, 0)
    },

    getScoreState(typeCounts, typeScores, scoreMode, currentScore) {
      const scoreTypeList = this.buildScoreTypeList(typeCounts, typeScores)
      const totalScore = scoreMode === SCORE_MODE.total
        ? Number(currentScore || 0)
        : this.computePerTypeTotal(typeCounts, typeScores)
      return {
        scoreTypeList,
        totalScore
      }
    },

    /**
     * 检查是否可以保存
     */
    checkCanSave() {
      const { typeCounts, selectedMethod, totalScore } = this.data

      // 至少选择一种风格
      const hasType = Object.keys(typeCounts).some(key => typeCounts[key] > 0)

      // 如果选择了Service，必须选择手法
      const hasMethod = typeCounts.suck > 0 ? selectedMethod !== '' : true

      // 评分大于0
      const hasScore = totalScore > 0

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
      this.clearMethodTimers()
      this.clearScoreTimers()
      const dateState = this.getDateTimeState(new Date())
      this.setData(Object.assign({}, dateState, {
        typeCounts: Object.assign({}, BASE_TYPE_COUNTS),
        typeScores: Object.assign({}, BASE_TYPE_SCORES),
        selectedMethod: '',
        showMethod: false,
        renderMethodSection: false,
        methodSlotOpen: false,
        methodVisible: false,
        methodExiting: false,
        scoreMode: SCORE_MODE.total,
        scoreModeManual: false,
        totalScore: 0,
        scoreTypeList: [],
        showScoreSection: false,
        renderScoreSection: false,
        scoreSlotOpen: false,
        scoreVisible: false,
        showScoreToggle: false,
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

    onScoreMaxChange(scoreMax) {
      const normalized = this.normalizeScoreMax(scoreMax)
      if (normalized !== this.data.totalScoreMax) {
        this.setData({ totalScoreMax: normalized })
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

    normalizeScoreMax(rawScore, currentScore) {
      const value = Number(rawScore)
      if (!Number.isFinite(value) || value <= 0) {
        return TOTAL_SCORE_MAX
      }
      const safeCurrentScore = Number.isFinite(Number(currentScore))
        ? Number(currentScore)
        : Number(this.data.currentScore || 0)
      return Math.max(value, safeCurrentScore)
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
      this.clearMethodTimers()
      this.clearScoreTimers()
      const typeCounts = this.normalizeTypeCounts(record)
      let typeScores = this.normalizeTypeScores(record)
      const scoreMode = this.normalizeScoreMode(record, typeScores)
      const showMethod = typeCounts.suck > 0
      let selectedMethod = record.method || ''
      if (!showMethod) {
        selectedMethod = ''
      }
      const score = Number(record.score || 0)
      const recordId = record._id || record.id || ''
      const dateState = this.getDateTimeState(this.resolveRecordDate(record))
      const activeTypes = this.getActiveTypes(typeCounts)
      const scoreModeManual = activeTypes.length > 1 && scoreMode === SCORE_MODE.total
      const modeState = this.resolveScoreModeState(
        typeCounts,
        scoreMode,
        scoreModeManual
      )
      let currentScore = score
      if (modeState.activeTypes.length === 1 && modeState.scoreMode === SCORE_MODE.total) {
        const singleType = modeState.activeTypes[0]
        const singleScore = Number(typeScores[singleType] || score || 0)
        typeScores = Object.assign({}, typeScores, {
          [singleType]: singleScore
        })
        currentScore = singleScore
      }
      const totalScoreMax = this.normalizeScoreMax(this.properties.scoreMax, currentScore)
      const scoreState = this.getScoreState(
        typeCounts,
        typeScores,
        modeState.scoreMode,
        currentScore
      )

      this.setData(Object.assign({
        typeCounts,
        typeScores,
        showMethod,
        renderMethodSection: showMethod,
        methodSlotOpen: showMethod,
        methodVisible: showMethod,
        methodExiting: false,
        selectedMethod,
        scoreMode: modeState.scoreMode,
        scoreModeManual: modeState.scoreModeManual,
        showScoreSection: modeState.showScoreSection,
        renderScoreSection: modeState.showScoreSection,
        scoreSlotOpen: modeState.showScoreSection,
        scoreVisible: modeState.showScoreSection,
        showScoreToggle: modeState.showScoreToggle,
        currentScore,
        totalScoreMax,
        currentRecordId: recordId,
        showDateEditor: false
      }, scoreState, dateState))

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

    normalizeTypeScores(record) {
      if (record.typeScores && typeof record.typeScores === 'object') {
        const scores = Object.assign({}, BASE_TYPE_SCORES, record.typeScores)
        TYPE_ORDER.forEach(key => {
          scores[key] = Number(scores[key] || 0)
        })
        return scores
      }
      return Object.assign({}, BASE_TYPE_SCORES)
    },

    normalizeScoreMode(record, typeScores) {
      const mode = record && record.scoreMode
      if (mode === SCORE_MODE.total || mode === SCORE_MODE.perType) {
        return mode
      }
      const hasScores = TYPE_ORDER.some(key => Number(typeScores[key] || 0) > 0)
      return hasScores ? SCORE_MODE.perType : SCORE_MODE.total
    },

    buildRecordData(includeId) {
      const typeCounts = Object.assign({}, this.data.typeCounts)
      const types = Object.keys(typeCounts).filter(key => typeCounts[key] > 0)
      const dateValue = this.createDateFromPicker(this.data.selectedDate, this.data.selectedTime)
      const baseDate = dateValue || new Date()
      const timestamp = baseDate.getTime()
      const date = this.formatDate(baseDate)
      const time = this.data.selectedTime || this.formatTime(baseDate)
      const scoreMode = this.data.scoreMode
      const totalScore = scoreMode === SCORE_MODE.total
        ? this.data.currentScore
        : this.computePerTypeTotal(typeCounts, this.data.typeScores)
      const recordData = {
        types,
        typeCounts,
        method: this.data.selectedMethod,
        score: totalScore,
        scoreMode,
        typeScores: Object.assign({}, this.data.typeScores),
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
