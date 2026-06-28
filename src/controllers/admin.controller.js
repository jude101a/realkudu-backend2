import bcrypt from "bcrypt";
import {
  createAdminActivityLog,
  getAdminActivityLogs,
  getAdminActivityLogsCount,
  getUserCount,
  getAdminUsers,
  getUserById,
  checkEmailPhoneExists,
  getStaffAccounts,
  createAdminAccount,
  updateAdminAccount,
  updateUserPassword,
  updateAccountStatus,
  getStakeholders,
  getTransactions,
  getTransactionCount,
  getTransactionById,
  getUserStatistics,
} from "../models/admin.model.js";

const SALT_ROUNDS = 12;
const ADMIN_ROLES = ["owner", "admin", "regional_manager", "customer_care"];

/* -------------------------------------------------------------------------- */
/*                              HELPERS                                      */
/* -------------------------------------------------------------------------- */

const sanitizeUser = (user) => ({
  id: user.id,
  firstName: user.first_name,
  lastName: user.last_name,
  email: user.email,
  phone: user.phone_number,
  role: user.role,
  activeRole: user.active_role,
  position: user.position || null,
  department: user.department || null,
  region: user.region || null,
  isVerified: user.is_verified,
  accountStatus: user.account_status,
  createdAt: user.created_at,
});

const sendError = (res, status, error) => {
  return res.status(status).json({ success: false, error });
};

const sendSuccess = (res, status = 200, data = {}) => {
  return res.status(status).json({ success: true, ...data });
};

const recordActivity = async (req, data) => {
  try {
    await createAdminActivityLog({
      adminId: req.user?.id,
      method: req.method,
      path: req.originalUrl?.split("?")[0] || req.originalUrl,
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
      ...data,
    });
  } catch (error) {
    console.error("Failed to record admin activity:", error);
  }
};

/* -------------------------------------------------------------------------- */
/*                           OWNER BOOTSTRAP                                 */
/* -------------------------------------------------------------------------- */

export const bootstrapOwner = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, position, department, region, setupKey } = req.body;
    const requiredSetupKey = process.env.OWNER_SETUP_KEY;

    if (requiredSetupKey && setupKey !== requiredSetupKey) {
      return sendError(res, 403, "Invalid owner setup key");
    }

    if (!firstName || !lastName || !email || !phone || !password) {
      return sendError(
        res,
        400,
        "firstName, lastName, email, phone, and password are required"
      );
    }

    // Check if owner or admin already exists
    const ownerCount = await getUserCount("owner");
    const adminCount = await getUserCount("admin");

    if (ownerCount > 0 || adminCount > 0) {
      return sendError(
        res,
        409,
        "Owner bootstrap is closed because an owner/admin account already exists"
      );
    }

    if (await checkEmailPhoneExists(email, phone)) {
      return sendError(res, 400, "Email or phone already registered");
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createAdminAccount({
      firstName,
      lastName,
      email,
      phone,
      passwordHash,
      role: "owner",
      position: position || "Owner / CEO",
      department: department || "Executive",
      region: region || null,
    });

    await recordActivity(req, {
      action: "BOOTSTRAP OWNER",
      statusCode: 201,
      targetType: "user",
      targetId: String(user.id),
      metadata: { role: user.role, position: user.position },
    });

    return sendSuccess(res, 201, {
      user: sanitizeUser(user),
      message: "Owner account created successfully",
    });
  } catch (error) {
    console.error("Bootstrap owner error:", error);
    return sendError(res, 500, "Failed to create owner account");
  }
};

/* -------------------------------------------------------------------------- */
/*                            USER MANAGEMENT                                */
/* -------------------------------------------------------------------------- */

export const getAdminUsersList = async (req, res) => {
  try {
    const { role, search, page = 1 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limit = 20;
    const offset = (pageNum - 1) * limit;

    const users = await getAdminUsers(
      role || null,
      search || null,
      limit,
      offset
    );
    const totalCount = await getUserCount(role || null);

    await recordActivity(req, {
      action: "LIST USERS",
      statusCode: 200,
      metadata: { role, search, page: pageNum },
    });

    return sendSuccess(res, 200, {
      users: users.map(sanitizeUser),
      total: totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error("Get users list error:", error);
    return sendError(res, 500, "Failed to retrieve users");
  }
};

export const getAdminUserDetail = async (req, res) => {
  try {
    const id = parseInt(
      Array.isArray(req.params.userId)
        ? req.params.userId[0]
        : req.params.userId,
      10
    );

    const user = await getUserById(id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    await recordActivity(req, {
      action: "VIEW USER",
      statusCode: 200,
      targetType: "user",
      targetId: String(id),
    });

    return sendSuccess(res, 200, { user: sanitizeUser(user) });
  } catch (error) {
    console.error("Get user detail error:", error);
    return sendError(res, 500, "Failed to retrieve user");
  }
};

/* -------------------------------------------------------------------------- */
/*                          ADMIN STATISTICS                                 */
/* -------------------------------------------------------------------------- */

export const getAdminStats = async (req, res) => {
  try {
    const stats = await getUserStatistics();
    const transactionCount = await getTransactionCount();

    await recordActivity(req, {
      action: "VIEW STATS",
      statusCode: 200,
    });

    return sendSuccess(res, 200, {
      totalUsers: parseInt(stats.total_users, 10),
      totalSellers: parseInt(stats.total_sellers, 10),
      totalAgents: parseInt(stats.total_agents, 10),
      totalLawyers: parseInt(stats.total_lawyers, 10),
      totalProperties: 0,
      activeListings: 0,
      totalTransactions: transactionCount,
      totalRevenue: 0,
      newUsersToday: 0,
      pendingKyc: 0,
    });
  } catch (error) {
    console.error("Get stats error:", error);
    return sendError(res, 500, "Failed to retrieve statistics");
  }
};

export const getTrafficStats = async (req, res) => {
  try {
    await recordActivity(req, {
      action: "VIEW TRAFFIC",
      statusCode: 200,
    });

    return sendSuccess(res, 200, {
      dailyVisits: [],
      totalVisitsToday: 0,
      uniqueVisitorsToday: 0,
      avgSessionDuration: 0,
    });
  } catch (error) {
    console.error("Get traffic stats error:", error);
    return sendError(res, 500, "Failed to retrieve traffic stats");
  }
};

export const getFinancialStats = async (req, res) => {
  try {
    await recordActivity(req, {
      action: "VIEW FINANCIAL STATS",
      statusCode: 200,
    });

    return sendSuccess(res, 200, {
      totalRevenue: 0,
      totalWithdrawals: 0,
      pendingWithdrawals: 0,
      platformFees: 0,
      revenueByMonth: [],
      transactionsByType: [],
    });
  } catch (error) {
    console.error("Get financial stats error:", error);
    return sendError(res, 500, "Failed to retrieve financial stats");
  }
};

export const getApiStats = async (req, res) => {
  try {
    await recordActivity(req, {
      action: "VIEW API STATS",
      statusCode: 200,
    });

    return sendSuccess(res, 200, {
      avgResponseTime: 0,
      totalRequests: 0,
      errorRate: 0,
      uptime: 100,
      requestsByEndpoint: [],
    });
  } catch (error) {
    console.error("Get API stats error:", error);
    return sendError(res, 500, "Failed to retrieve API stats");
  }
};

/* -------------------------------------------------------------------------- */
/*                          TRANSACTION MANAGEMENT                           */
/* -------------------------------------------------------------------------- */

export const getTransactionsList = async (req, res) => {
  try {
    const { page = 1 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limit = 20;
    const offset = (pageNum - 1) * limit;

    const transactions = await getTransactions(limit, offset);
    const totalCount = await getTransactionCount();

    await recordActivity(req, {
      action: "LIST TRANSACTIONS",
      statusCode: 200,
      metadata: { page: pageNum },
    });

    return sendSuccess(res, 200, {
      transactions: transactions.map((t) => ({
        ...t,
        amount: parseFloat(t.amount || 0),
        metadata: t.metadata || {},
        createdAt: t.created_at?.toISOString(),
        updatedAt: t.updated_at?.toISOString(),
      })),
      total: totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error("Get transactions list error:", error);
    return sendError(res, 500, "Failed to retrieve transactions");
  }
};

export const getTransactionDetail = async (req, res) => {
  try {
    const id = parseInt(
      Array.isArray(req.params.transactionId)
        ? req.params.transactionId[0]
        : req.params.transactionId,
      10
    );

    const transaction = await getTransactionById(id);
    if (!transaction) {
      return sendError(res, 404, "Transaction not found");
    }

    await recordActivity(req, {
      action: "VIEW TRANSACTION",
      statusCode: 200,
      targetType: "transaction",
      targetId: String(id),
    });

    return sendSuccess(res, 200, {
      transaction: {
        ...transaction,
        amount: parseFloat(transaction.amount || 0),
        metadata: transaction.metadata || {},
        createdAt: transaction.created_at?.toISOString(),
        updatedAt: transaction.updated_at?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Get transaction detail error:", error);
    return sendError(res, 500, "Failed to retrieve transaction");
  }
};

/* -------------------------------------------------------------------------- */
/*                          STAFF ACCOUNTS                                   */
/* -------------------------------------------------------------------------- */

export const getStaffAccountsList = async (req, res) => {
  try {
    const staff = await getStaffAccounts();

    await recordActivity(req, {
      action: "LIST STAFF",
      statusCode: 200,
    });

    return sendSuccess(res, 200, {
      staff: staff.map(sanitizeUser),
    });
  } catch (error) {
    console.error("Get staff accounts error:", error);
    return sendError(res, 500, "Failed to retrieve staff accounts");
  }
};

export const createStaffAccount = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      role,
      region,
      password,
      position,
      department,
    } = req.body;

    if (!firstName || !lastName || !email || !phone || !role || !password || !position) {
      return sendError(
        res,
        400,
        "firstName, lastName, email, phone, role, password, and position are required"
      );
    }

    if (!ADMIN_ROLES.includes(role)) {
      return sendError(
        res,
        400,
        "Role must be owner, admin, regional_manager, or customer_care"
      );
    }

    if (role === "owner" && req.user?.role !== "owner" && req.user?.activeRole !== "owner") {
      return sendError(
        res,
        403,
        "Only the owner can create another owner account"
      );
    }

    if (await checkEmailPhoneExists(email, phone)) {
      return sendError(res, 400, "Email or phone already registered");
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createAdminAccount({
      firstName,
      lastName,
      email,
      phone,
      passwordHash,
      role,
      region: region || null,
      position,
      department: department || null,
    });

    await recordActivity(req, {
      action: "CREATE STAFF",
      statusCode: 201,
      targetType: "user",
      targetId: String(user.id),
      metadata: { role: user.role, position: user.position },
    });

    return sendSuccess(res, 201, {
      user: sanitizeUser(user),
      message: "Staff account created successfully",
    });
  } catch (error) {
    console.error("Create staff account error:", error);
    return sendError(res, 500, "Failed to create staff account");
  }
};

/* -------------------------------------------------------------------------- */
/*                          STAKEHOLDERS                                     */
/* -------------------------------------------------------------------------- */

export const getStakeholdersList = async (req, res) => {
  try {
    const { role, search, page = 1 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limit = 50;
    const offset = (pageNum - 1) * limit;

    const stakeholders = await getStakeholders(
      role || null,
      search || null,
      limit,
      offset
    );

    await recordActivity(req, {
      action: "LIST STAKEHOLDERS",
      statusCode: 200,
      metadata: { role, search, page: pageNum },
    });

    return sendSuccess(res, 200, {
      stakeholders: stakeholders.map(sanitizeUser),
      page: pageNum,
    });
  } catch (error) {
    console.error("Get stakeholders list error:", error);
    return sendError(res, 500, "Failed to retrieve stakeholders");
  }
};

export const createStakeholder = async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      role,
      password,
      position,
      department,
      region,
    } = req.body;

    if (!firstName || !lastName || !email || !phone || !role || !password || !position) {
      return sendError(
        res,
        400,
        "firstName, lastName, email, phone, role, password, and position are required"
      );
    }

    if (!ADMIN_ROLES.includes(role)) {
      return sendError(res, 400, "Invalid stakeholder role");
    }

    if (role === "owner" && req.user?.role !== "owner" && req.user?.activeRole !== "owner") {
      return sendError(
        res,
        403,
        "Only the owner can create another owner account"
      );
    }

    if (await checkEmailPhoneExists(email, phone)) {
      return sendError(res, 400, "Email or phone already registered");
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await createAdminAccount({
      firstName,
      lastName,
      email,
      phone,
      passwordHash,
      role,
      position,
      department: department || null,
      region: region || null,
    });

    await recordActivity(req, {
      action: "CREATE STAKEHOLDER",
      statusCode: 201,
      targetType: "user",
      targetId: String(user.id),
      metadata: { role: user.role },
    });

    return sendSuccess(res, 201, {
      user: sanitizeUser(user),
      message: "Stakeholder created successfully",
    });
  } catch (error) {
    console.error("Create stakeholder error:", error);
    return sendError(res, 500, "Failed to create stakeholder");
  }
};

export const updateStakeholder = async (req, res) => {
  try {
    const id = parseInt(
      Array.isArray(req.params.userId)
        ? req.params.userId[0]
        : req.params.userId,
      10
    );

    const current = await getUserById(id);
    if (!current || !ADMIN_ROLES.includes(current.role)) {
      return sendError(res, 404, "Stakeholder not found");
    }

    if (current.role === "owner" && req.user?.role !== "owner" && req.user?.activeRole !== "owner") {
      return sendError(res, 403, "Only the owner can update owner accounts");
    }

    const {
      firstName,
      lastName,
      phone,
      role,
      activeRole,
      position,
      department,
      region,
    } = req.body;

    if (role && !ADMIN_ROLES.includes(role)) {
      return sendError(res, 400, "Invalid stakeholder role");
    }

    if (role === "owner" && req.user?.role !== "owner" && req.user?.activeRole !== "owner") {
      return sendError(
        res,
        403,
        "Only the owner can assign owner role"
      );
    }

    const updates = {};
    if (firstName !== undefined) updates.first_name = firstName;
    if (lastName !== undefined) updates.last_name = lastName;
    if (phone !== undefined) updates.phone_number = phone;
    if (role !== undefined) updates.role = role;
    if (activeRole !== undefined) updates.active_role = activeRole;
    if (position !== undefined) updates.position = position;
    if (department !== undefined) updates.department = department;
    if (region !== undefined) updates.region = region;

    const user = await updateAdminAccount(id, updates);

    await recordActivity(req, {
      action: "UPDATE STAKEHOLDER",
      statusCode: 200,
      targetType: "user",
      targetId: String(id),
      metadata: updates,
    });

    return sendSuccess(res, 200, {
      user: sanitizeUser(user),
      message: "Stakeholder updated successfully",
    });
  } catch (error) {
    console.error("Update stakeholder error:", error);
    return sendError(res, 500, "Failed to update stakeholder");
  }
};

export const updateStakeholderPassword = async (req, res) => {
  try {
    const id = parseInt(
      Array.isArray(req.params.userId)
        ? req.params.userId[0]
        : req.params.userId,
      10
    );

    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 8) {
      return sendError(
        res,
        400,
        "newPassword must be at least 8 characters"
      );
    }

    const current = await getUserById(id);
    if (!current || !ADMIN_ROLES.includes(current.role)) {
      return sendError(res, 404, "Stakeholder not found");
    }

    if (current.role === "owner" && req.user?.role !== "owner" && req.user?.activeRole !== "owner") {
      return sendError(res, 403, "Only the owner can reset owner passwords");
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await updateUserPassword(id, passwordHash);

    await recordActivity(req, {
      action: "UPDATE STAKEHOLDER PASSWORD",
      statusCode: 200,
      targetType: "user",
      targetId: String(id),
    });

    return sendSuccess(res, 200, {
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Update stakeholder password error:", error);
    return sendError(res, 500, "Failed to update password");
  }
};

export const updateStakeholderStatus = async (req, res) => {
  try {
    const id = parseInt(
      Array.isArray(req.params.userId)
        ? req.params.userId[0]
        : req.params.userId,
      10
    );

    const { accountStatus } = req.body;

    if (!["active", "suspended"].includes(accountStatus)) {
      return sendError(
        res,
        400,
        "accountStatus must be active or suspended"
      );
    }

    const current = await getUserById(id);
    if (!current || !ADMIN_ROLES.includes(current.role)) {
      return sendError(res, 404, "Stakeholder not found");
    }

    if (current.role === "owner") {
      return sendError(
        res,
        403,
        "Owner account cannot be suspended from this endpoint"
      );
    }

    const user = await updateAccountStatus(id, accountStatus);

    await recordActivity(req, {
      action: "UPDATE STAKEHOLDER STATUS",
      statusCode: 200,
      targetType: "user",
      targetId: String(id),
      metadata: { status: accountStatus },
    });

    return sendSuccess(res, 200, {
      user: sanitizeUser(user),
      message: "Account status updated successfully",
    });
  } catch (error) {
    console.error("Update stakeholder status error:", error);
    return sendError(res, 500, "Failed to update account status");
  }
};

/* -------------------------------------------------------------------------- */
/*                            PASSWORD MANAGEMENT                            */
/* -------------------------------------------------------------------------- */

export const updateMyPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      return sendError(
        res,
        400,
        "currentPassword and newPassword of at least 8 characters are required"
      );
    }

    const user = await getUserById(req.user?.id);
    if (!user) {
      return sendError(res, 404, "User not found");
    }

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return sendError(res, 401, "Current password is incorrect");
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await updateUserPassword(req.user.id, passwordHash);

    await recordActivity(req, {
      action: "CHANGE OWN PASSWORD",
      statusCode: 200,
    });

    return sendSuccess(res, 200, {
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("Update own password error:", error);
    return sendError(res, 500, "Failed to update password");
  }
};

/* -------------------------------------------------------------------------- */
/*                          ACTIVITY LOGS                                    */
/* -------------------------------------------------------------------------- */

export const getActivityLogs = async (req, res) => {
  try {
    const { adminId, page = 1 } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limit = 50;
    const offset = (pageNum - 1) * limit;

    const logs = await getAdminActivityLogs(
      adminId ? parseInt(adminId, 10) : null,
      limit,
      offset
    );

    const totalCount = await getAdminActivityLogsCount(
      adminId ? parseInt(adminId, 10) : null
    );

    await recordActivity(req, {
      action: "VIEW ACTIVITY LOGS",
      statusCode: 200,
      metadata: { adminId, page: pageNum },
    });

    return sendSuccess(res, 200, {
      logs: logs.map((log) => ({
        ...log,
        metadata: log.metadata || {},
        createdAt: log.created_at?.toISOString(),
      })),
      total: totalCount,
      page: pageNum,
      totalPages: Math.ceil(totalCount / limit),
    });
  } catch (error) {
    console.error("Get activity logs error:", error);
    return sendError(res, 500, "Failed to retrieve activity logs");
  }
};
