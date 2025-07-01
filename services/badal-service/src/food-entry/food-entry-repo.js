class FoodEntryRepository {
  constructor(pool) {
    this.pool = pool;
  }

  async getUserFoodEntriesByDate(clientId, date) {
    const query = `
      SELECT id, date, meal_type, food_category, food_name, calories, mood_tag
      FROM food_entries 
      WHERE client_id = $1 AND date = $2
      ORDER BY meal_type
    `;
    const result = await this.pool.query(query, [clientId, date]);
    return {
      foodEntries: result.rows,
    };
  }
  async getUserFoodEntriesByDateAndCategory(clientId, date, category) {
    const query = `
      SELECT id, date, meal_type, food_category, food_name, calories, mood_tag
      FROM food_entries 
      WHERE client_id = $1 AND date = $2 AND meal_type = $3
      ORDER BY meal_type
    `;
    const result = await this.pool.query(query, [clientId, date, category]);
    return {
      foodEntries: result.rows,
    };
  }

  async getUserFoodEntriesByDateRange(clientId, start_date, end_date) {
    const query = `
      SELECT id, client_id, date, meal_type, food_category, food_name, calories, mood_tag
      FROM food_entries 
      WHERE client_id = $1 AND date BETWEEN $2 AND $3
      ORDER BY date, meal_type
    `;
    const result = await this.pool.query(query, [
      clientId,
      start_date,
      end_date,
    ]);
    return {
      foodEntries: result.rows,
    };
  }

  async createUserFoodEntry(
    clientId,
    date,
    meal_type,
    food_category,
    food_name,
    calories,
    mood_tag
  ) {
    const query = `
      INSERT INTO food_entries (client_id, date, meal_type, food_category, food_name, calories, mood_tag)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, client_id, date, meal_type, food_category, food_name, calories, mood_tag
    `;
    const result = await this.pool.query(query, [
      clientId,
      date,
      meal_type,
      food_category,
      food_name,
      calories,
      mood_tag,
    ]);
    return {
      foodEntry: result.rows[0],
    };
  }

  async updateUserFoodEntry(id, clientId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    if (updates.date !== undefined) {
      fields.push(`date = $${paramCount++}`);
      values.push(updates.date);
    }
    if (updates.meal_type !== undefined) {
      fields.push(`meal_type = $${paramCount++}`);
      values.push(updates.meal_type);
    }
    if (updates.food_category !== undefined) {
      fields.push(`food_category = $${paramCount++}`);
      values.push(updates.food_category);
    }
    if (updates.food_name !== undefined) {
      fields.push(`food_name = $${paramCount++}`);
      values.push(updates.food_name);
    }
    if (updates.calories !== undefined) {
      fields.push(`calories = $${paramCount++}`);
      values.push(updates.calories);
    }
    if (updates.mood_tag !== undefined) {
      fields.push(`mood_tag = $${paramCount++}`);
      values.push(updates.mood_tag);
    }

    if (fields.length === 0) {
      throw new Error("No fields provided for update");
    }
    values.push(id, clientId);

    const query = `
      UPDATE food_entries 
      SET ${fields.join(", ")}
      WHERE id = $${paramCount++} AND client_id = $${paramCount}
      RETURNING id, client_id, date, meal_type, food_category, food_name, calories, mood_tag
    `;

    const result = await this.pool.query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return {
      foodEntry: result.rows[0],
    };
  }

  async deleteUserFoodEntry(id, clientId) {
    const query = `
      DELETE FROM food_entries 
      WHERE id = $1 AND client_id = $2
      RETURNING id
    `;
    const result = await this.pool.query(query, [id, clientId]);

    return {
      deleted: result.rows.length > 0,
      id: result.rows.length > 0 ? result.rows[0].id : null,
    };
  }
  async getWeeklyStats(clientId) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6);
    const formatDate = (date) => date.toISOString().split("T")[0];
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    const { foodEntries } = await this.getUserFoodEntriesByDateRange(
      clientId,
      startDateStr,
      endDateStr
    );
    const dailyCalories = {};
    foodEntries.forEach((entry) => {
      const date = entry.date;
      if (!dailyCalories[date]) {
        dailyCalories[date] = 0;
      }
      dailyCalories[date] += entry.calories;
    });
    const dates = Object.keys(dailyCalories).sort();
    const caloriesValues = Object.values(dailyCalories);
    const totalCalories = caloriesValues.reduce((sum, cal) => sum + cal, 0);
    const avgCalories =
      caloriesValues.length > 0
        ? Math.round(totalCalories / caloriesValues.length)
        : 0;
    return {
      avgCalories,
      daysTracked: dates.length,
    };
  }
  async getUserWeeklyEntries(clientId) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6);
    const formatDate = (date) => date.toISOString().split("T")[0];
    const startDateStr = formatDate(startDate);
    const endDateStr = formatDate(endDate);
    const { foodEntries } = await this.getUserFoodEntriesByDateRange(
      clientId,
      startDateStr,
      endDateStr
    );

    return foodEntries;
  }
}

module.exports = FoodEntryRepository;
