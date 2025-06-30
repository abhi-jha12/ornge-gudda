class NotificationScheduler {
  constructor(notificationLogic) {
    this.notificationLogic = notificationLogic;
    this.intervals = new Map();
  }

  start() {
    // Check for expiring items every 12 hours
    const expiringInterval = setInterval(async () => {
      await this.notificationLogic.processExpiringItems();
    }, 12 * 60 * 60 * 1000);

    // Check for low stock every 6 hours
    const lowStockInterval = setInterval(async () => {
      await this.notificationLogic.processLowStockItems();
    }, 6 * 60 * 60 * 1000);

    // Check for expired items every 24 hours
    const expiredInterval = setInterval(async () => {
      await this.notificationLogic.processExpiredItems();
    }, 24 * 60 * 60 * 1000);

    this.intervals.set('expiring', expiringInterval);
    this.intervals.set('lowStock', lowStockInterval);
    this.intervals.set('expired', expiredInterval);

    console.log('📅 Notification scheduler started');
  }

  stop() {
    this.intervals.forEach((interval, name) => {
      clearInterval(interval);
      console.log(`Stopped ${name} interval`);
    });
    this.intervals.clear();
  }
}
module.exports = NotificationScheduler;