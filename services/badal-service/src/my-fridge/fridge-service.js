class FridgeService {
  constructor(fridgeRepository) {
    this.fridgeRepository = fridgeRepository;
  }
  async getFridgeItems(clientId) {
    try {
      const result = await this.fridgeRepository.getFridgeItems(clientId);
      return result.fridgeItems;
    } catch (error) {
      throw new Error(`Error fetching fridge items: ${error.message}`);
    }
  }
  async addFridgeItem(clientId, item) {
    try {
      const result = await this.fridgeRepository.addFridgeItem(clientId, item);
      return result;
    } catch (error) {
      throw new Error(`Error adding fridge item: ${error.message}`);
    }
  }
  async createFridge(clientId, name) {
    try {
      const result = await this.fridgeRepository.createFridge(clientId, name);
      return result;
    } catch (error) {
      throw new Error(`Error creating fridge: ${error.message}`);
    }
  }
  async getFridge(clientId) {
    try {
      const result = await this.fridgeRepository.getFridge(clientId);
      return result;
    } catch (error) {
      throw new Error(`Error fetching fridge: ${error.message}`);
    }
  }
  async updateFridgeItem(clientId, itemUpdate) {
    try {
      const result = await this.fridgeRepository.updateFridgeItem(
        clientId,
        itemUpdate
      );
      return result;
    } catch (error) {
      throw new Error(`Error updating fridge item: ${error.message}`);
    }
  }
  async getExpiredItems() {
    try {
      const result = await this.fridgeRepository.getExpiredItems();
      return result;
    } catch (error) {
      throw new Error(`Error getting expired items: ${error.message}`);
    }
  }
  async getExpiringItems(days) {
    try {
      const result = await this.fridgeRepository.getExpiringItems(days);
      return result;
    } catch (error) {
      throw new Error(`Error getting expiring items: ${error.message}`);
    }
  }
  async getLowStockItems(threshold){
    try {
      const result = await this.fridgeRepository.getLowStockItems(threshold);
      return result;
    } catch (error) {
      throw new Error(`Error getting low stock items: ${error.message}`);
    }
  }
}
module.exports = FridgeService;
