class FoodEntryRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async getUserMonthlyFoodEntries(clientId){
    const query = `
      SELECT 
        id, 
        client_id, 
        date, 
        meal_type, 
        calories, 
        date, 
        created_at
      FROM orange_food_entries
      WHERE client_id = $1
      ORDER BY date DESC
    `;
    const result = await this.pool.query(query, [clientId]);
    return {
      foodEntries: result.rows,
    };
  }
  
  
}

module.exports = UserRepository;
// This code defines a UserRepository class that interacts with a PostgreSQL database
