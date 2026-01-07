// components/splashScreen/splashScreen.js
Component({
  options: {
    styleIsolation: 'shared'
  },

  properties: {
    show: {
      type: Boolean,
      value: true
    }
  },

  data: {
    isFadingOut: false,
    isComplete: false
  },

  lifetimes: {
    attached() {
      console.log('[SplashScreen] Component attached')
      this.startSplashSequence()
    },

    detached() {
      console.log('[SplashScreen] Component detached')
      this.cleanup()
    }
  },

  methods: {
    /**
     * 启动 splash 动画序列
     */
    startSplashSequence() {
      this.fadeTimer = setTimeout(() => {
        this.fadeOut()
      }, 3000)
    },

    /**
     * 淡出动画
     */
    fadeOut() {
      if (this.data.isFadingOut) {
        console.warn('[SplashScreen] Already fading out, skipping')
        return
      }

      console.log('[SplashScreen] Starting fade out animation')
      this.setData({
        isFadingOut: true
      })

      // 600ms 淡出动画后触发完成事件
      this.completeTimer = setTimeout(() => {
        console.log('[SplashScreen] Animation complete')
        this.setData({
          isComplete: true
        })

        // 触发自定义事件，通知父页面动画完成
        this.triggerEvent('complete', {
          timestamp: Date.now()
        })
      }, 600)
    },

    /**
     * 清理定时器（防止内存泄漏）
     */
    cleanup() {
      if (this.fadeTimer) {
        clearTimeout(this.fadeTimer)
        this.fadeTimer = null
      }
      if (this.completeTimer) {
        clearTimeout(this.completeTimer)
        this.completeTimer = null
      }
    }
  }
})
