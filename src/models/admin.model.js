import pool from "../config/db.js";

const USERS_TABLE = "users";
const TRANSACTIONS_TABLE = "transactions";
const ADMIN_ACTIVITY_LOGS_TABLE = "admin_activity_logs";

/* -------------------------------------------------------------------------- */
/*                           ADMIN ACTIVITY LOGS                             */
/* -------------------------------------------------------------------------- */

export const createAdminActivityLog = async (data) => {
  const {
    adminId,
    action,
    method,
    path,
    statusCode,
    targetType,
    targetId,
    metadata,
    ipAddress,
    userAgent,
  } = data;

  const query = `
    INSERT INTO ${ADMIN_ACTIVITY_LOGS_TABLE} (
      admin_id,
      action,
      method,
      path,
      status_code,
      target_type,
      target_id,
      metadata,
      ip_address,
      user_agent,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
    RETURNING *;
  `;

  try {
    const result = await pool.query(query, [
      adminId,
      action,
      method,
      path,
      statusCode,
      targetType || null,
      targetId || null,
      metadata ? JSON.stringify(metadata) : null,
      ipAddress || null,
      userAgent || null,
    ]);
    return result.rows[0];
  } catch (error) {
    console.error("Error creating admin activity log:", error);
    // Don't throw - logging should not block operations
    return null;
  }
};

export const getAdminActivityLogs = async (
  adminId = null,
  limit = 50,
  offset = 0
) => {
  let query = `SELECT * FROM ${ADMIN_ACTIVITY_LOGS_TABLE}`;
  const values = [];

  if (adminId) {
    query += ` WHERE admin_id = $1`;
    values.push(adminId);
  }

  query += ` ORDER BY created_at DESC LIMIT $${values.length + 1} OFFSET $${
    values.length + 2
  }`;
  values.push(limit, offset);

  const result = await pool.query(query, values);
  return result.rows;
};

export const getAdminActivityLogsCount = async (adminId = null) => {
  let query = `SELECT COUNT(*) as count FROM ${ADMIN_ACTIVITY_LOGS_TABLE}`;
  const values = [];

  if (adminId) {
    query += ` WHERE admin_id = $1`;
    values.push(adminId);
  }

  const result = await pool.query(query, values);
  return parseInt(result.rows[0].count, 10);
};

/* -------------------------------------------------------------------------- */
/*                            USER QUERIES                                   */
/* -------------------------------------------------------------------------- */

export const getUserCount = async (role = null) => {
  let query = `SELECT COUNT(*) as count FROM ${USERS_TABLE}`;
  const values = [];

  if (role) {
    query += ` WHERE role = $1`;
    values.push(role);
  }

  const result = await pool.query(query, values);
  return parseInt(result.rows[0].count, 10);
};

export const getAdminUsers = async (role = null, search = null, limit = 20, offset = 0) => {
  let query = `SELECT * FROM ${USERS_TABLE} WHERE 1=1`;
  const values = [];
  let paramIndex = 1;

  if (role) {
    query += ` AND role = $${paramIndex}`;
    values.push(role);
    paramIndex++;
  }

  if (search) {
    query += ` AND (first_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
    values.push(`%${search}%`);
    paramIndex++;
  }

  query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  values.push(limit, offset);

  const result = await pool.query(query, values);
  return result.rows;
};

export const getUserById = async (id) => {
  const query = `SELECT * FROM ${USERS_TABLE} WHERE id = $1`;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

export const checkEmailPhoneExists = async (email, phone) => {
  const query = `
    SELECT COUNT(*) as count FROM ${USERS_TABLE}
    WHERE email = $1 OR phone_number = $2
  `;
  const result = await pool.query(query, [email, phone]);
  return parseInt(result.rows[0].count, 10) > 0;
};

export const getStaffAccounts = async () => {
  const query = `
    SELECT * FROM ${USERS_TABLE}
    WHERE role IN ('owner', 'customer_care', 'regional_manager', 'admin')
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query);
  return result.rows;
};

export const createAdminAccount = async (data) => {
  const {
    firstName,
    lastName,
    email,
    phone,
    passwordHash,
    role,
    region,
    position,
    department,
  } = data;

  const query = `
    INSERT INTO ${USERS_TABLE} (
      first_name,
      last_name,
      email,
      phone_number,
      password_hash,
      role,
      active_role,
      region,
      position,
      department,
      is_verified,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, NOW())
    RETURNING *
  `;

  const result = await pool.query(query, [
    firstName,
    lastName,
    email,
    phone,
    passwordHash,
    role,
    role,
    region || null,
    position,
    department || null,
  ]);

  return result.rows[0];
};

export const updateAdminAccount = async (id, updates) => {
  const allowedFields = [
    "first_name",
    "last_name",
    "phone_number",
    "role",
    "active_role",
    "position",
    "department",
    "region",
  ];

  const setClauses = [];
  const values = [];
  let paramIndex = 1;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key) && value !== undefined) {
      setClauses.push(`${key} = $${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
  }

  if (setClauses.length === 0) {
    return await getUserById(id);
  }

  values.push(id);
  const query = `
    UPDATE ${USERS_TABLE}
    SET ${setClauses.join(", ")}
    WHERE id = $${paramIndex}
    RETURNING *
  `;

  const result = await pool.query(query, values);
  return result.rows[0];
};

export const updateUserPassword = async (id, passwordHash) => {
  const query = `
    UPDATE ${USERS_TABLE}
    SET password_hash = $1
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [passwordHash, id]);
  return result.rows[0];
};

export const updateAccountStatus = async (id, accountStatus) => {
  const query = `
    UPDATE ${USERS_TABLE}
    SET account_status = $1
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [accountStatus, id]);
  return result.rows[0];
};

export const getStakeholders = async (role = null, search = null, limit = 50, offset = 0) => {
  let query = `SELECT * FROM ${USERS_TABLE} WHERE 1=1`;
  const values = [];
  let paramIndex = 1;

  if (role) {
    query += ` AND role = $${paramIndex}`;
    values.push(role);
    paramIndex++;
  } else {
    query += ` AND role IN ('owner', 'admin', 'regional_manager', 'customer_care')`;
  }

  if (search) {
    query += ` AND (first_name ILIKE $${paramIndex} OR last_name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`;
    values.push(`%${search}%`);
    paramIndex++;
  }

  query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  values.push(limit, offset);

  const result = await pool.query(query, values);
  return result.rows;
};

/* -------------------------------------------------------------------------- */
/*                          TRANSACTION QUERIES                              */
/* -------------------------------------------------------------------------- */

export const getTransactions = async (limit = 20, offset = 0) => {
  const query = `
    SELECT * FROM ${TRANSACTIONS_TABLE}
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `;
  const result = await pool.query(query, [limit, offset]);
  return result.rows;
};

export const getTransactionCount = async () => {
  const query = `SELECT COUNT(*) as count FROM ${TRANSACTIONS_TABLE}`;
  const result = await pool.query(query);
  return parseInt(result.rows[0].count, 10);
};

export const getTransactionById = async (id) => {
  const query = `SELECT * FROM ${TRANSACTIONS_TABLE} WHERE id = $1`;
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
};

/* -------------------------------------------------------------------------- */
/*                            STATISTICS                                     */
/* -------------------------------------------------------------------------- */

export const getUserStatistics = async () => {
  const query = `
    SELECT
      (SELECT COUNT(*) FROM ${USERS_TABLE}) as total_users,
      (SELECT COUNT(*) FROM ${USERS_TABLE} WHERE role = 'seller') as total_sellers,
      (SELECT COUNT(*) FROM ${USERS_TABLE} WHERE role = 'agent') as total_agents,
      (SELECT COUNT(*) FROM ${USERS_TABLE} WHERE role = 'lawyer') as total_lawyers
  `;
  const result = await pool.query(query);
  return result.rows[0];
};
