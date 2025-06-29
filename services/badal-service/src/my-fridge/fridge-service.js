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
}
module.exports = FridgeService;
