App({
  globalData: {
    currentPlan: null,
    selectedCandidate: null,
    stockList: [],
    agentDraft: null,
    activeProject: null,
    customPartGroups: []
  },
  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'cloud1-d5gnrj8plf8520129',
        traceUser: true,
      })
    }
  }
})
