// pages/home/home.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    greetingIcon: '☀️',
    greetingText: '早安，美食家',
    statusBarHeight: 0,
    activeTab: 'today'
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    // 获取系统信息，设置状态栏高度
    this.setStatusBarHeight();

    // 设置个性化问候
    this.setGreeting();

    // 加载数据
    this.loadData();
  },

  /**
   * 设置状态栏高度
   */
  setStatusBarHeight() {
    const systemInfo = wx.getSystemInfoSync();
    const statusBarHeight = systemInfo.statusBarHeight || 20;

    // 设置状态栏高度到 data，用于模板绑定
    this.setData({
      statusBarHeight: statusBarHeight
    });

    console.log('状态栏高度:', statusBarHeight);
  },

  /**
   * 设置个性化问候
   */
  setGreeting() {
    const hour = new Date().getHours();
    let greetingIcon = '☀️';
    let greetingText = '早安，美食家';

    if (hour >= 5 && hour < 9) {
      greetingIcon = '🌅';
      greetingText = '早安，美食家';
    } else if (hour >= 9 && hour < 12) {
      greetingIcon = '☀️';
      greetingText = '上午好';
    } else if (hour >= 12 && hour < 14) {
      greetingIcon = '🍽️';
      greetingText = '午安，该吃饭了';
    } else if (hour >= 14 && hour < 18) {
      greetingIcon = '☕️';
      greetingText = '下午好';
    } else if (hour >= 18 && hour < 22) {
      greetingIcon = '🌆';
      greetingText = '晚上好';
    } else {
      greetingIcon = '🌙';
      greetingText = '夜深了';
    }

    this.setData({
      greetingIcon,
      greetingText
    });
  },

  /**
   * 加载数据
   */
  loadData() {
    // 可以在这里加载真实数据
    console.log('加载页面数据');
  },

  /**
   * 点击今日推荐
   */
  onHighlightTap() {
    wx.vibrateShort({ type: 'light' });

    wx.showToast({
      title: '查看菜谱详情',
      icon: 'none',
      duration: 1500
    });

    // 可以跳转到详情页
    // wx.navigateTo({
    //   url: '/pages/recipe-detail/recipe-detail?id=1'
    // });
  },

  /**
   * 点击探索分类
   */
  onExploreTap(e) {
    const type = e.currentTarget.dataset.type;
    wx.vibrateShort({ type: 'light' });

    console.log('探索类型:', type);
    wx.showToast({
      title: '探索更多内容',
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 点击菜系
   */
  onCuisineTap(e) {
    const cuisine = e.currentTarget.dataset.cuisine;
    wx.vibrateShort({ type: 'light' });

    console.log('选择菜系:', cuisine);
    wx.showToast({
      title: '浏览菜系',
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 点击技巧
   */
  onSkillTap(e) {
    const skill = e.currentTarget.dataset.skill;
    wx.vibrateShort({ type: 'light' });

    console.log('学习技巧:', skill);
    wx.showToast({
      title: '学习烹饪技巧',
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 点击食材
   */
  onIngredientTap(e) {
    const ingredient = e.currentTarget.dataset.ingredient;
    wx.vibrateShort({ type: 'light' });

    console.log('选择食材:', ingredient);
    wx.showToast({
      title: '查看食材菜谱',
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 开始烹饪
   */
  onStartCooking() {
    wx.vibrateShort({ type: 'medium' });

    wx.showToast({
      title: '让我们开始吧！',
      icon: 'success',
      duration: 2000
    });
  },

  /**
   * Tab 切换
   */
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab;

    // 触觉反馈
    wx.vibrateShort({ type: 'light' });

    // 切换 tab
    this.setData({
      activeTab: tab
    });

    // 提示（可选）
    const tabName = tab === 'today' ? 'Today' : '统计';
    console.log('切换到:', tabName);

    // 可以在这里添加页面切换逻辑
    // 例如显示/隐藏不同的内容区域
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    // 刷新问候语
    this.setGreeting();

    // 重新加载数据
    this.loadData();

    setTimeout(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
    }, 1000);
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    console.log('触底加载更多');
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '发现精致烹饪艺术 - makeCooking',
      path: '/pages/home/home',
      imageUrl: ''
    };
  }
});
