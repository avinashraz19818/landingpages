const db = require('../db');

class AnalyticsService {
  constructor() {}

  getDateKey(date) {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  }

  formatDisplayDate(date) {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  detectDevice(userAgent) {
    if (!userAgent) return 'Unknown';
    const ua = userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad')) return 'iOS (iPhone/iPad)';
    if (ua.includes('android')) return 'Android';
    if (ua.includes('windows') || ua.includes('macintosh') || ua.includes('linux')) return 'Desktop';
    return 'Mobile / Other';
  }

  getDashboardStats() {
    const events = db.data.events;
    const now = new Date();
    
    const todayKey = this.getDateKey(now);
    
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = this.getDateKey(yesterday);

    const initStats = () => ({
      linksGenerated: 0,
      joinRequests: 0,
      pixelHits: 0,
      approvedMembers: 0,
      conversionsRate: '0%'
    });

    const todayStats = initStats();
    const yesterdayStats = initStats();
    const lifetimeStats = {
      totalLinks: 0,
      totalRequests: 0,
      totalPixelFired: 0,
      totalApproved: 0,
      conversionRate: '0%'
    };

    const dailyMap = {};
    const campaignMap = {};
    const deviceMap = { 'Android': 0, 'iOS (iPhone/iPad)': 0, 'Desktop': 0, 'Mobile / Other': 0 };
    const hourlyPoints = Array(24).fill(0); // For today's 24 hours chart

    events.forEach(ev => {
      const evDate = new Date(ev.timestamp);
      const evDateKey = this.getDateKey(ev.timestamp);
      
      // Daily map
      if (!dailyMap[evDateKey]) {
        dailyMap[evDateKey] = {
          dateKey: evDateKey,
          displayDate: this.formatDisplayDate(ev.timestamp),
          linksGenerated: 0,
          joinRequests: 0,
          pixelHits: 0,
          approvedMembers: 0
        };
      }
      const dayObj = dailyMap[evDateKey];

      // Campaign tracking from UTM or source
      const campaignName = ev.utm?.campaign || ev.utm?.source || 'Direct / Meta Organic';
      if (!campaignMap[campaignName]) {
        campaignMap[campaignName] = { campaign: campaignName, clicks: 0, leads: 0, pixelFired: 0 };
      }

      // Device detection
      const dev = this.detectDevice(ev.userAgent);
      if (deviceMap[dev] !== undefined) {
        deviceMap[dev]++;
      }

      // Counting by event type
      if (ev.type === 'LINK_GENERATED') {
        lifetimeStats.totalLinks++;
        dayObj.linksGenerated++;
        campaignMap[campaignName].clicks++;
        if (evDateKey === todayKey) {
          todayStats.linksGenerated++;
          hourlyPoints[evDate.getHours()]++;
        }
        if (evDateKey === yesterdayKey) yesterdayStats.linksGenerated++;
      } else if (ev.type === 'JOIN_REQUEST') {
        lifetimeStats.totalRequests++;
        dayObj.joinRequests++;
        campaignMap[campaignName].leads++;
        if (evDateKey === todayKey) todayStats.joinRequests++;
        if (evDateKey === yesterdayKey) yesterdayStats.joinRequests++;
      } else if (ev.type === 'PIXEL_FIRED') {
        lifetimeStats.totalPixelFired++;
        dayObj.pixelHits++;
        campaignMap[campaignName].pixelFired++;
        if (evDateKey === todayKey) todayStats.pixelHits++;
        if (evDateKey === yesterdayKey) yesterdayStats.pixelHits++;
      } else if (ev.type === 'MEMBER_APPROVED') {
        lifetimeStats.totalApproved++;
        dayObj.approvedMembers++;
        if (evDateKey === todayKey) todayStats.approvedMembers++;
        if (evDateKey === yesterdayKey) yesterdayStats.approvedMembers++;
      }
    });

    if (todayStats.linksGenerated > 0) {
      todayStats.conversionsRate = ((todayStats.joinRequests / todayStats.linksGenerated) * 100).toFixed(1) + '%';
    }
    if (yesterdayStats.linksGenerated > 0) {
      yesterdayStats.conversionsRate = ((yesterdayStats.joinRequests / yesterdayStats.linksGenerated) * 100).toFixed(1) + '%';
    }
    if (lifetimeStats.totalLinks > 0) {
      lifetimeStats.conversionRate = ((lifetimeStats.totalRequests / lifetimeStats.totalLinks) * 100).toFixed(1) + '%';
    }

    const dailyBreakdown = Object.values(dailyMap).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    const campaignBreakdown = Object.values(campaignMap).sort((a, b) => b.leads - a.leads);

    return {
      todayDate: this.formatDisplayDate(now),
      yesterdayDate: this.formatDisplayDate(yesterday),
      today: todayStats,
      yesterday: yesterdayStats,
      lifetime: lifetimeStats,
      dailyBreakdown,
      campaignBreakdown,
      deviceBreakdown: deviceMap,
      hourlyPoints,
      recentEvents: events.slice(0, 50)
    };
  }
}

module.exports = new AnalyticsService();
