class NotificationLogic {
  constructor(fridgeRepository, notificationService) {
    this.fridgeRepository = fridgeRepository;
    this.notificationService = notificationService;
  }

  async processExpiringItems() {
    try {
      const expiringItems = await this.fridgeRepository.getExpiringItems(3);

      // Group by client_id
      const clientGroups = this.groupByClientId(expiringItems);

      for (const [clientId, items] of clientGroups) {
        const title = "Items Expiring Soon! 🕒";
        const body = this.formatExpiringItemsMessage(items);

        await this.notificationService.sendNotification(clientId, title, body);
      }
    } catch (error) {
      console.error("Error processing expiring items:", error);
    }
  }

  async processLowStockItems() {
    try {
      const lowStockItems = await this.fridgeRepository.getLowStockItems(2);

      const clientGroups = this.groupByClientId(lowStockItems);

      for (const [clientId, items] of clientGroups) {
        const title = "Low Stock Alert! 📦";
        const body = this.formatLowStockMessage(items);

        await this.notificationService.sendNotification(clientId, title, body);
      }
    } catch (error) {
      console.error("Error processing low stock items:", error);
    }
  }

  async processExpiredItems() {
    try {
      const expiredItems = await this.fridgeRepository.getExpiredItems();

      const clientGroups = this.groupByClientId(expiredItems);

      for (const [clientId, items] of clientGroups) {
        const title = "Items Expired! ⚠️";
        const body = this.formatExpiredItemsMessage(items);

        await this.notificationService.sendNotification(clientId, title, body);
      }
    } catch (error) {
      console.error("Error processing expired items:", error);
    }
  }

  groupByClientId(items) {
    const groups = new Map();

    items.forEach((item) => {
      const clientId = item.client_ids;
      if (!groups.has(clientId)) {
        groups.set(clientId, []);
      }
      groups.get(clientId).push(item);
    });

    return groups;
  }

  formatExpiringItemsMessage(items) {
    if (items.length === 1) {
      const item = items[0];
      return `${item.name} expires in ${this.getDaysUntilExpiry(
        item.expiry_date
      )} days`;
    }

    return `${items.length} items are expiring soon: ${items
      .map((i) => i.name)
      .join(", ")}`;
  }

  formatLowStockMessage(items) {
    if (items.length === 1) {
      const item = items[0];
      return `${item.name} is running low (${item.quantity} left)`;
    }

    return `${items.length} items are running low: ${items
      .map((i) => `${i.name} (${i.quantity})`)
      .join(", ")}`;
  }

  formatExpiredItemsMessage(items) {
    if (items.length === 1) {
      const item = items[0];
      return `${item.name} has expired and should be removed`;
    }

    return `${items.length} items have expired: ${items
      .map((i) => i.name)
      .join(", ")}`;
  }

  getDaysUntilExpiry(expiryDate) {
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry - now;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}
module.exports = NotificationLogic;
