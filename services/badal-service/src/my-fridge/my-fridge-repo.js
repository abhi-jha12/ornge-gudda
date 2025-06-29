class FridgeRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async getFridgeItems(clientId) {
    const query1 = `
    SELECT id FROM fridges 
    WHERE client_ids #>> '{}' = $1 
    ORDER BY created_date DESC
  `;

    const result1 = await this.pool.query(query1, [clientId]);
    if (result1.rows.length === 0) {
      return { fridgeItems: [] };
    }

    const fridgeId = result1.rows[0].id;
    const query2 = `
    SELECT
      id,
      name,
      category,
      quantity,
      expiry_date,
      added_date,
      is_shopping_item
    FROM fridge_items
    WHERE fridge_id = $1
  `;

    const result = await this.pool.query(query2, [fridgeId]);
    return {
      fridgeItems: result.rows,
    };
  }
  async addFridgeItem(clientId, item) {
    const query1 = `
    SELECT id FROM fridges 
    WHERE client_ids #>> '{}' = $1 
    ORDER BY created_date DESC
  `;

    const result1 = await this.pool.query(query1, [clientId]);
    if (result1.rows.length === 0) {
      throw new Error("Fridge not found for the given client ID");
    }
    const fridgeId = result1.rows[0].id;

    const query2 = `
    INSERT INTO fridge_items (fridge_id, name, category, quantity, expiry_date, added_date, is_shopping_item)
    VALUES ($1, $2, $3, $4, $5, NOW(), $6)
    RETURNING *
  `;

    const values = [
      fridgeId,
      item.name,
      item.category,
      item.quantity,
      item.expiry_date,
      item.is_shopping_item || false,
    ];

    const result2 = await this.pool.query(query2, values);
    return result2.rows[0];
  }
  async createFridge(clientId, name) {
    const query = `
    INSERT INTO fridges (client_ids, name)
    VALUES ($1::jsonb, $2)
    RETURNING *
  `;
    const values = [JSON.stringify(clientId), name];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }
  async getFridge(clientId) {
    const query = `
    SELECT * FROM fridges
    WHERE client_ids #>> '{}' = $1
  `;
    const result = await this.pool.query(query, [clientId]);
    if (result.rows.length === 0) {
      throw new Error("Fridge not found for the given client ID");
    }
    return result.rows[0];
  }
  async updateFridgeItem(clientId, itemUpdate) {
    const query1 = `
    SELECT id FROM fridges 
    WHERE client_ids #>> '{}' = $1 
    ORDER BY created_date DESC
  `;

    const result1 = await this.pool.query(query1, [clientId]);
    if (result1.rows.length === 0) {
      throw new Error("Fridge not found for the given client ID");
    }
    const fridgeId = result1.rows[0].id;
    const checkItemQuery = `
    SELECT id, quantity, score FROM fridge_items 
    WHERE fridge_id = $1 AND id = $2 
  `;

    const existingItem = await this.pool.query(checkItemQuery, [
      fridgeId,
      itemUpdate.id,
    ]);

    if (existingItem.rows.length === 0) {
      throw new Error("Item not found in fridge");
    }

    const currentItem = existingItem.rows[0];
    const operationType = itemUpdate.operation_type;

    let scoreChange = 0;
    let newQuantity = currentItem.quantity;

    // Determine score change and quantity update based on operation type
    switch (operationType) {
      case "add":
        scoreChange = 20;
        newQuantity += itemUpdate.quantity || 0;
        break;
      case "restock":
        scoreChange = 100;
        newQuantity += itemUpdate.quantity || 0;
        break;
      case "remove":
      case "consume":
        scoreChange = -15;
        newQuantity = Math.max(0, newQuantity - (itemUpdate.quantity || 0));
        break;
      default:
        scoreChange = 0;
        newQuantity =
          itemUpdate.quantity !== undefined
            ? itemUpdate.quantity
            : currentItem.quantity;
    }

    const newScore = Math.max(0, currentItem.score + scoreChange);
    const threshold = itemUpdate.threshold || 30;
    const shouldBeShoppingItem = newScore <= threshold;

    const updateQuery = `
    UPDATE fridge_items 
    SET 
      quantity = $2,
      score = $3,
      is_shopping_item = $4,
      expiry_date = COALESCE($5, expiry_date)
    WHERE id = $1
    RETURNING *
  `;

    const updateValues = [
      currentItem.id,
      newQuantity,
      newScore,
      shouldBeShoppingItem,
      itemUpdate.expiry_date,
    ];

    const result = await this.pool.query(updateQuery, updateValues);
    return {
      success: true,
      fridgeItems: result.rows[0],
    };
  }
}

module.exports = FridgeRepository;
// This code defines a UserRepository class that interacts with a PostgreSQL database
