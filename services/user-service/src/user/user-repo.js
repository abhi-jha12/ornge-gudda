class UserRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async getAllUsers() {
    const query = `
      SELECT id, client_id, name, streak, actions, level, 
             daily_quote_count, games_played, tarot_draws, 
             last_login, food_points, food_streak, gender,
             is_special_moodboard_allowed,weekly_spends
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
                 is_special_moodboard_allowed,weekly_spends
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
  async getUserByClientId(clientId) {
    const query = `
        SELECT id, client_id, name, streak, actions, level, 
                 daily_quote_count, games_played, tarot_draws, 
                 last_login, food_points, food_streak, gender,
                 is_special_moodboard_allowed,weekly_spends
                  today_expense, created_at
        FROM orange_users
        WHERE client_id = $1
        `;
    const result = await this.pool.query(query, [clientId]);
    if (result.rows.length === 0) {
      throw new Error(`User with client ID ${clientId} not found`);
    }
    return result.rows[0];
  }
  async updateUserByClientId(clientId, userData) {
    const updatableFields = [
      "name",
      "streak",
      "actions",
      "level",
      "daily_quote_count",
      "games_played",
      "tarot_draws",
      "last_login",
      "food_points",
      "food_streak",
      "gender",
      "is_special_moodboard_allowed",
      "weekly_spends",
      "today_expense",
    ];
    const fieldsToUpdate = {};
    for (const field of updatableFields) {
      if (userData.hasOwnProperty(field) && userData[field] !== undefined) {
        fieldsToUpdate[field] = userData[field];
      }
    }
    if (Object.keys(fieldsToUpdate).length === 0) {
      throw new Error("No valid fields provided for update");
    }
    const setClause = Object.keys(fieldsToUpdate)
      .map((field, index) => `${field} = $${index + 2}`)
      .join(", ");
    const query = `
    UPDATE orange_users 
    SET ${setClause}
    WHERE client_id = $1
    RETURNING id, client_id, name, streak, actions, level, 
              daily_quote_count, games_played, tarot_draws, 
              last_login, food_points, food_streak, gender,
              is_special_moodboard_allowed, weekly_spends,
              today_expense, created_at
  `;
    const params = [clientId, ...Object.values(fieldsToUpdate)];

    try {
      const result = await this.pool.query(query, params);

      if (result.rows.length === 0) {
        throw new Error(`User with client ID ${clientId} not found`);
      }

      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }
  async getUserSubscription(clientId) {
    const query = `SELECT push_subscription FROM orange_users WHERE client_id = $1`;
    const result = await this.pool.query(query, [clientId]);
    if (result.rows.length === 0) {
      throw new Error(`User with client ID ${clientId} not found`);
    }
    return result.rows[0].push_subscription;
  }
  async updateUserSubscription(clientId, subscription) {
    const query = `
      UPDATE orange_users 
      SET push_subscription = $1 
      WHERE client_id = $2
      RETURNING id, client_id, push_subscription
    `;
    const result = await this.pool.query(query, [subscription, clientId]);
    if (result.rows.length === 0) {
      throw new Error(`User with client ID ${clientId} not found`);
    }
    return result.rows[0];
  }
  async createUserSubscription(clientId, subscription) {
    const query = `
      INSERT INTO orange_users (client_id, push_subscription) 
      VALUES ($1, $2)
      RETURNING id, client_id, push_subscription
    `;
    const result = await this.pool.query(query, [clientId, subscription]);
    return result.rows[0];
  }
  async checkUserBySubscriptionAuth(subscription) {
    try {
      if (!subscription || !subscription.keys || !subscription.keys.auth) {
        throw new Error("Invalid subscription format: missing auth key");
      }

      const authValue = subscription.keys.auth;
      const query = `
      SELECT id, client_id, push_subscription 
      FROM orange_users 
      WHERE push_subscription->>'keys' IS NOT NULL 
      AND push_subscription->'keys'->>'auth' = $1
    `;

      const result = await this.pool.query(query, [authValue]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      throw new Error(`Error checking subscription: ${error.message}`);
    }
  }
}

module.exports = UserRepository;
// This code defines a UserRepository class that interacts with a PostgreSQL database
