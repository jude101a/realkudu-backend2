import pool from "../config/db.js";

/* -------------------------------------------------------------------------- */
/*                               CONSTANTS                                    */
/* -------------------------------------------------------------------------- */

const TABLE = "users";

const COLUMN_MAP = {
  firstName: "first_name",
  lastName: "last_name",
  email: "email",
  phone: "phone_number",
  phoneNumber: "phone_number",
  firebaseUid: "firebase_uid",
  transactionPin: "transaction_pin",
  positionAtWork: "position_at_work",
  placeOfWork: "place_of_work",
  localGovernmentArea: "local_government_area",
  maritalStatus: "marital_status",
  numberOfChildren: "number_of_children",
  profileImageUrl: "profile_image_url",
  isProfileComplete: "is_profile_complete",
  isLawyer: "is_lawyer",
  isVerified: "is_verified",
  isUpgraded: "is_upgraded",
};

/* -------------------------------------------------------------------------- */
/*                               HELPERS                                      */
/* -------------------------------------------------------------------------- */

const mapToDbColumn = (key) => COLUMN_MAP[key] || key;

const buildDynamicUpdate = (data, allowedFields) => {
  const updates = [];
  const values = [];
  let index = 1;

  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;

    const column = mapToDbColumn(key);
    if (!allowedFields.includes(column)) continue;

    updates.push(`${column}=$${index}`);
    values.push(value);
    index++;
  }

  return { updates, values };
};

/* -------------------------------------------------------------------------- */
/*                               CREATE                                       */
/* -------------------------------------------------------------------------- */

export const createUser = async (data) => {
  const {
    email,
    password,
    firebaseUid,
    firstName,
    lastName,
    phone,
    transactionPin,
    address,
    occupation,
    positionAtWork,
    placeOfWork,
    localGovernmentArea,
    state,
    country,
    maritalStatus,
    numberOfChildren,
    hobbies,
    role,
  } = data;

  const query = `
    INSERT INTO ${TABLE} (
      email,
      password_hash,
      firebase_uid,
      first_name,
      last_name,
      phone_number,
      transaction_pin,
      address,
      occupation,
      position_at_work,
      place_of_work,
      local_government_area,
      state,
      country,
      marital_status,
      number_of_children,
      hobbies,
      role
    )
    VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
    )
    RETURNING *
  `;

  const values = [
    email,
    password,
    firebaseUid,
    firstName,
    lastName,
    phone,
    transactionPin,
    address,
    occupation,
    positionAtWork,
    placeOfWork,
    localGovernmentArea,
    state,
    country,
    maritalStatus,
    numberOfChildren,
    hobbies,
    role,
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
};

/* -------------------------------------------------------------------------- */
/*                               READ                                         */
/* -------------------------------------------------------------------------- */

export const findUserByEmail = async (email) => {
  const { rows } = await pool.query(
    `SELECT * FROM ${TABLE} WHERE email=$1 LIMIT 1`,
    [email]
  );
  return rows[0] || null;
};

export const findUserById = async (id) => {
  const { rows } = await pool.query(
    `SELECT * FROM ${TABLE} WHERE id=$1 LIMIT 1`,
    [id]
  );
  return rows[0] || null;
};

export const getUserFullnameByEmail = async (email) => {
  const { rows } = await pool.query(
    `SELECT first_name, last_name FROM ${TABLE} WHERE email=$1`,
    [email]
  );
  return rows[0] || null;
};

/* -------------------------------------------------------------------------- */
/*                               UPDATE (SIMPLE)                              */
/* -------------------------------------------------------------------------- */

export const updateUser = async (id, { firstName, lastName, phone }) => {
  const { rows } = await pool.query(
    `
    UPDATE ${TABLE}
    SET first_name=$1,
        last_name=$2,
        phone_number=$3,
        updated_at=NOW()
    WHERE id=$4
    RETURNING *
    `,
    [firstName, lastName, phone, id]
  );

  return rows[0] || null;
};

export const updatePassword = async (id, passwordHash) => {
  await pool.query(
    `
    UPDATE ${TABLE}
    SET password_hash=$1,
        updated_at=NOW()
    WHERE id=$2
    `,
    [passwordHash, id]
  );
};

export const updateUserIsLawyer = async (id, isLawyer) => {
  const { rows } = await pool.query(
    `UPDATE ${TABLE} SET is_lawyer=$1 WHERE id=$2 RETURNING *`,
    [isLawyer, id]
  );
  return rows[0] || null;
};

export const userUpgradeToSeller = async (id) => {
  const { rows } = await pool.query(
    `UPDATE ${TABLE} SET is_upgraded=true WHERE id=$1 RETURNING *`,
    [id]
  );
  return rows[0] || null;
};

/* -------------------------------------------------------------------------- */
/*                         DYNAMIC PROFILE UPDATE                              */
/* -------------------------------------------------------------------------- */

export const updateUserById = async (id, data) => {
  const allowedFields = [
    "first_name",
    "last_name",
    "email",
    "phone_number",
    "address",
    "occupation",
    "position_at_work",
    "place_of_work",
    "local_government_area",
    "state",
    "country",
    "marital_status",
    "number_of_children",
    "hobbies",
    "profile_image_url",
    "is_profile_complete",
    "is_lawyer",
    "is_verified",
    "is_upgraded",
  ];

  const { updates, values } = buildDynamicUpdate(data, allowedFields);

  if (!updates.length) return null;

  updates.push(`updated_at=NOW()`);
  values.push(id);

  const query = `
    UPDATE ${TABLE}
    SET ${updates.join(", ")}
    WHERE id=$${values.length}
    RETURNING *
  `;

  const { rows } = await pool.query(query, values);
  return rows[0] || null;
};

/* -------------------------------------------------------------------------- */
/*                              PARTIAL READS                                 */
/* -------------------------------------------------------------------------- */

export const getUserFirstnameAndLocation = async (id) => {
  const { rows } = await pool.query(
    `SELECT first_name, address FROM ${TABLE} WHERE id=$1`,
    [id]
  );

  if (!rows.length) return null;

  return {
    firstName: rows[0].first_name,
    location: rows[0].address,
  };
};

export const getUserBasicInfoByIdModel = async (id) => {
  const { rows } = await pool.query(
    `
    SELECT
      id,
      first_name,
      last_name,
      email,
      phone_number,
      address,
      profile_image_url,
      occupation,
      position_at_work,
      place_of_work,
      local_government_area,
      state,
      country,
      marital_status,
      number_of_children,
      hobbies,
      is_lawyer,
      is_verified,
      is_upgraded
    FROM ${TABLE}
    WHERE id=$1
    `,
    [id]
  );

  if (!rows.length) return null;

  const u = rows[0];

  return {
    id: u.id,
    firstName: u.first_name,
    lastName: u.last_name,
    email: u.email,
    phoneNumber: u.phone_number,
    address: u.address,
    profileImageUrl: u.profile_image_url,
    occupation: u.occupation,
    positionAtWork: u.position_at_work,
    placeOfWork: u.place_of_work,
    localGovernmentArea: u.local_government_area,
    state: u.state,
    country: u.country,
    maritalStatus: u.marital_status,
    numberOfChildren: u.number_of_children,
    hobbies: u.hobbies,
    isLawyer: u.is_lawyer,
    isVerified: u.is_verified,
    isUpgraded: u.is_upgraded,
  };
};