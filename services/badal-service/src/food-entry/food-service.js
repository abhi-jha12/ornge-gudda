class FoodService {
  constructor(foodEntryRepository) {
    this.foodEntryRepository = foodEntryRepository;
  }

  async getUserFoodEntriesByDate(clientId, date) {
    try {
      const result = await this.foodEntryRepository.getUserFoodEntriesByDate(
        clientId,
        date
      );
      return result.foodEntries;
    } catch (error) {
      throw new Error(`Error fetching food entries by date: ${error.message}`);
    }
  }
  async getUserFoodEntriesByDateAndCategory(clientId, date, category) {
    try {
      const result =
        await this.foodEntryRepository.getUserFoodEntriesByDateAndCategory(
          clientId,
          date,
          category
        );
      return result.foodEntries;
    } catch (error) {
      throw new Error(
        `Error fetching food entries by date and category: ${error.message}`
      );
    }
  }

  async getUserFoodEntriesByDateRange(clientId, startDate, endDate) {
    try {
      const result =
        await this.foodEntryRepository.getUserFoodEntriesByDateRange(
          clientId,
          startDate,
          endDate
        );
      return result.foodEntries;
    } catch (error) {
      throw new Error(
        `Error fetching food entries by date range: ${error.message}`
      );
    }
  }

  async createUserFoodEntry(
    clientId,
    date,
    mealType,
    foodCategory,
    foodName,
    calories,
    moodTag
  ) {
    try {
      const result = await this.foodEntryRepository.createUserFoodEntry(
        clientId,
        date,
        mealType,
        foodCategory,
        foodName,
        calories,
        moodTag
      );
      return result.foodEntry;
    } catch (error) {
      throw new Error(`Error creating food entry: ${error.message}`);
    }
  }

  async updateUserFoodEntry(id, clientId, updates) {
    try {
      const result = await this.foodEntryRepository.updateUserFoodEntry(
        id,
        clientId,
        updates
      );
      if (!result) {
        throw new Error("Food entry not found or unauthorized");
      }
      return result.foodEntry;
    } catch (error) {
      throw new Error(`Error updating food entry: ${error.message}`);
    }
  }

  async deleteUserFoodEntry(id, clientId) {
    try {
      const result = await this.foodEntryRepository.deleteUserFoodEntry(
        id,
        clientId
      );
      if (!result.deleted) {
        throw new Error("Food entry not found or unauthorized");
      }
      return { success: true, id: result.id };
    } catch (error) {
      throw new Error(`Error deleting food entry: ${error.message}`);
    }
  }

  async getTotalCaloriesByDate(clientId, date) {
    try {
      const foodEntries = await this.getUserFoodEntriesByDate(clientId, date);
      const totalCalories = foodEntries.reduce(
        (sum, entry) => sum + (entry.calories || 0),
        0
      );
      return totalCalories;
    } catch (error) {
      throw new Error(`Error calculating total calories: ${error.message}`);
    }
  }
  async getWeeklyStats(clientId) {
    try {
      const result = await this.foodEntryRepository.getWeeklyStats(clientId);
      return result;
    } catch (error) {
      throw new Error(`Error calculating total calories: ${error.message}`);
    }
  }
  async getWeeklyEntries(clientId) {
    try {
      const result = await this.foodEntryRepository.getUserWeeklyEntries(clientId);
      return result;
    } catch (error) {
      throw new Error(`Error calculating total entries: ${error.message}`);
    }
  }
}

module.exports = FoodService;
