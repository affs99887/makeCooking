// components/recordDrawer/recordDrawer.js
Component({
  options: {
    styleIsolation: 'isolated'
  },

  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer: 'onVisibleChange'
    }
  },

  data: {
    isAnimating: false,
    isOpen: false,
    isDragging: false,
    isExpanded: false,
    drawerTranslate: 0,
    windowHeight: 0,
    safeAreaTop: 0,
    selectedTypes: [],       // 选中的烹饪风格
    selectedPosition: '',    // 选中的烹饪手法
    showPosition: false,     // 是否显示手法选择
    currentScore: 0,         // 当前评分
    canSave: false           // 是否可以保存
  },

  lifetimes: {
    attached() {
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
        this.setData({
          isAnimating: true,
          isOpen: false,
          isDragging: false,
          isExpanded: false,
          drawerTranslate: positions.closed
        })
        wx.nextTick(() => {
          this.openStartTimer = setTimeout(() => {
            const liftTarget = Math.max(
              positions.default - positions.openOvershoot,
              positions.expanded
            )
            this.setData({
              isOpen: true,
              drawerTranslate: liftTarget
            })
            this.openSettleTimer = setTimeout(() => {
              if (!this.data.isDragging && this.properties.visible) {
                this.setData({ drawerTranslate: positions.default })
              }
            }, 220)
          }, 40)
        })
        // 触觉反馈
        wx.vibrateShort({ type: 'light' })
      } else {
        this.setData({
          isOpen: false,
          isDragging: false,
          isExpanded: false,
          drawerTranslate: positions.closed
        })
        // 延迟移除，等待动画完成
        setTimeout(() => {
          this.setData({ isAnimating: false })
        }, 800)
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

      this.setData({ drawerTranslate: nextTranslate })
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

      this.setData({
        isDragging: false,
        isExpanded,
        drawerTranslate: target
      })
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
      const type = e.currentTarget.dataset.type
      let { selectedTypes } = this.data

      // 触觉反馈
      wx.vibrateShort({ type: 'light' })

      if (selectedTypes.includes(type)) {
        // 取消选择
        selectedTypes = selectedTypes.filter(t => t !== type)
      } else {
        // 添加选择
        selectedTypes.push(type)
      }

      // 检查是否选择了Inside
      const showPosition = selectedTypes.includes('Inside')

      // 如果取消了Inside，清空手法选择
      let { selectedPosition } = this.data
      if (!showPosition) {
        selectedPosition = ''
      }

      this.setData({
        selectedTypes,
        showPosition,
        selectedPosition
      })

      this.checkCanSave()
    },

    /**
     * 选择烹饪手法（单选）
     */
    onPositionSelect(e) {
      const position = e.currentTarget.dataset.position

      // 触觉反馈
      wx.vibrateShort({ type: 'medium' })

      this.setData({
        selectedPosition: position
      })

      this.checkCanSave()
    },

    /**
     * 评分滑块变化中
     */
    onScoreChanging(e) {
      this.setData({
        currentScore: e.detail.value
      })
    },

    /**
     * 评分滑块变化完成
     */
    onScoreChange(e) {
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
      const { selectedTypes, selectedPosition, currentScore } = this.data

      // 至少选择一种风格
      const hasType = selectedTypes.length > 0

      // 如果选择了Inside，必须选择手法
      const hasPosition = selectedTypes.includes('Inside') ? selectedPosition !== '' : true

      // 评分大于0
      const hasScore = currentScore > 0

      const canSave = hasType && hasPosition && hasScore

      this.setData({ canSave })
    },

    /**
     * 保存记录
     */
    onSave() {
      if (!this.data.canSave) {
        return
      }

      // 强烈触觉反馈
      wx.vibrateShort({ type: 'heavy' })

      const recordData = {
        types: this.data.selectedTypes,
        position: this.data.selectedPosition,
        score: this.data.currentScore,
        timestamp: Date.now(),
        date: this.formatDate(new Date())
      }

      console.log('[RecordDrawer] Save record:', recordData)

      // 触发保存事件，传递记录数据
      this.triggerEvent('save', recordData)

      // 显示成功提示
      wx.showToast({
        title: '记录保存成功',
        icon: 'success',
        duration: 2000
      })

      // 延迟关闭抽屉并重置
      setTimeout(() => {
        this.closeDrawer()
        this.resetForm()
      }, 1000)
    },

    /**
     * 重置表单
     */
    resetForm() {
      this.setData({
        selectedTypes: [],
        selectedPosition: '',
        showPosition: false,
        currentScore: 0,
        canSave: false
      })
    },

    /**
     * 格式化日期
     */
    formatDate(date) {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}.${month}.${day}`
    }
  }
})
