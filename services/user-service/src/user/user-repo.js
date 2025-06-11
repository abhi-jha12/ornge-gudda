class UserRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async getAllUsers() {
    const query = `
      SELECT id, client_id, name, streak, actions, level, 
             daily_quote_count, games_played, tarot_draws, 
             last_login, food_points, food_streak, gender,
             today_expense, created_at
      FROM orange_users 
      ORDER BY created_at DESC
    `;
    const result = await this.pool.query(query);
    return {
      users: result.rows,
    };
  }
  async getUserById(userId) {
    const query = `
        SELECT id, client_id, name, streak, actions, level, 
                 daily_quote_count, games_played, tarot_draws, 
                 last_login, food_points, food_streak, gender,
                 today_expense, created_at
        FROM orange_users
        WHERE id = $1
        `;
    const result = await this.pool.query(query, [userId]);
    if (result.rows.length === 0) {
      throw new Error(`User with ID ${userId} not found`);
    }
    return result.rows[0];
  }
}

module.exports = UserRepository;
// This code defines a UserRepository class that interacts with a PostgreSQL database
