/**
 * Converts a camelCase payload into a snake_case column payload using
 * the given field map. Keys with `undefined` values are dropped so
 * partial updates never accidentally null out unrelated columns.
 *
 * @param {Object} payload
 * @param {Object} fieldMap - camelCase key -> db column name
 * @returns {Object} mapped payload keyed by db column names
 */
export const mapPayload = (payload = {}, fieldMap = {}) => {
  const mapped = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) continue;
    mapped[fieldMap[key] || key] = value;
  }
  return mapped;
};

/**
 * Builds a parameterized INSERT statement from a mapped (snake_case) payload.
 *
 * @param {string} table
 * @param {Object} mapped
 * @returns {{ text: string, values: any[] }}
 */
export const buildInsert = (table, mapped) => {
  const columns = Object.keys(mapped);
  if (!columns.length) {
    throw new Error(`buildInsert: no columns provided for table "${table}"`);
  }
  const values = Object.values(mapped);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
  return {
    text: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders}) RETURNING *`,
    values,
  };
};