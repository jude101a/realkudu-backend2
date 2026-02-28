import pool from "../config/db.js";

const MIGRATION_NAME = "bootstrap_schema_v1";
const MIGRATION_CHECKSUM = "real-kudu-bootstrap-v1";

async function runStep(client, name, fn) {
  try {
    await fn();
    console.log(`[DB] ${name} - completed`);
  } catch (err) {
    const normalized =
      err instanceof Error
        ? err
        : new Error(typeof err === "string" ? err : "Unknown DB error");

    console.error(`[DB] ${name} - failed`, {
      message: normalized.message,
      code: err?.code,
      detail: err?.detail,
    });

    throw normalized;
  }
}

async function ensureExtensions(client) {
  await client.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);
  await client.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
}

async function ensureMigrationHistory(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migration_history (
      id BIGSERIAL PRIMARY KEY,
      migration_name VARCHAR(255) NOT NULL UNIQUE,
      checksum VARCHAR(128) NOT NULL,
      status VARCHAR(50) NOT NULL,
      execution_time_ms INTEGER NOT NULL,
      error_message TEXT,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
}

async function alreadyApplied(client) {
  const { rows } = await client.query(
    `
      SELECT 1
      FROM _migration_history
      WHERE migration_name = $1
      AND checksum = $2
      AND status = 'success'
      LIMIT 1
    `,
    [MIGRATION_NAME, MIGRATION_CHECKSUM]
  );

  return rows.length > 0;
}

async function createCoreTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      firebase_uid VARCHAR(128) UNIQUE NOT NULL,
      first_name VARCHAR(50) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone_number VARCHAR(20) UNIQUE,
      password_hash TEXT NOT NULL,
      transaction_pin CHAR(4),
      address TEXT,
      profile_image_url TEXT,
      occupation VARCHAR(150),
      position_at_work VARCHAR(150),
      place_of_work VARCHAR(150),
      local_government_area VARCHAR(100),
      state VARCHAR(100),
      country VARCHAR(100) DEFAULT 'Nigeria',
      marital_status VARCHAR(20) DEFAULT 'single',
      number_of_children SMALLINT DEFAULT 0 CHECK (number_of_children >= 0),
      hobbies TEXT,
      nin VARCHAR(11) UNIQUE,
      bvn VARCHAR(11) UNIQUE,
      role VARCHAR(50) DEFAULT 'user',
      is_verified BOOLEAN DEFAULT FALSE,
      is_upgraded BOOLEAN DEFAULT FALSE,
      is_lawyer BOOLEAN DEFAULT FALSE,
      deleted_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_users_pin_digits CHECK (
        transaction_pin IS NULL OR transaction_pin ~ '^[0-9]{4}$'
      )
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS sellers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      business_name VARCHAR(255) NOT NULL,
      business_address TEXT,
      business_email VARCHAR(255) UNIQUE,
      business_phone VARCHAR(20),
      cac_number VARCHAR(50) UNIQUE,
      tin_number VARCHAR(50) UNIQUE,
      cac_document_url TEXT,
      business_specification TEXT,
      business_profile_image_url TEXT,
      is_verified BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS lawyers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      full_name VARCHAR(150) NOT NULL,
      phone VARCHAR(20),
      email VARCHAR(255) UNIQUE NOT NULL,
      supreme_court_number VARCHAR(50) UNIQUE NOT NULL,
      year_of_call SMALLINT NOT NULL CHECK (year_of_call >= 1950),
      nba_branch VARCHAR(100),
      law_firm VARCHAR(150),
      services TEXT,
      states TEXT,
      passport_photo_path TEXT,
      call_to_bar_path TEXT,
      annual_fee_path TEXT,
      gov_id_path TEXT,
      selfie_path TEXT,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT chk_lawyers_status CHECK (status IN ('pending','approved','rejected','suspended'))
    );
  `);
}

async function createPropertyTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS estates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      address TEXT,
      lga VARCHAR(100),
      state VARCHAR(100),
      cover_image_url TEXT,
      is_land_estate BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS houses (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      estate_id UUID REFERENCES estates(id) ON DELETE SET NULL,
      seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      lawyer_id UUID REFERENCES lawyers(id) ON DELETE SET NULL,
      caretaker_id UUID REFERENCES users(id) ON DELETE SET NULL,
      name VARCHAR(255) NOT NULL,
      type VARCHAR(100),
      address TEXT,
      cover_image_url TEXT,
      state VARCHAR(100),
      lga VARCHAR(100),
      is_single_house BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS apartments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      house_id UUID NOT NULL REFERENCES houses(id) ON DELETE CASCADE,
      seller_id UUID REFERENCES sellers(id) ON DELETE SET NULL,
      tenant_id UUID REFERENCES users(id) ON DELETE SET NULL,
      apartment_address TEXT,
      house_name VARCHAR(255),
      unit_number VARCHAR(50),
      number_of_bedrooms INTEGER DEFAULT 0 CHECK (number_of_bedrooms >= 0),
      number_of_kitchens INTEGER DEFAULT 0 CHECK (number_of_kitchens >= 0),
      number_of_living_rooms INTEGER DEFAULT 0 CHECK (number_of_living_rooms >= 0),
      number_of_toilets INTEGER DEFAULT 0 CHECK (number_of_toilets >= 0),
      room_size VARCHAR(100),
      has_running_water BOOLEAN DEFAULT FALSE,
      has_electricity BOOLEAN DEFAULT FALSE,
      has_parking_space BOOLEAN DEFAULT FALSE,
      has_internet BOOLEAN DEFAULT FALSE,
      images JSONB,
      cover_image_url TEXT,
      description TEXT,
      apartment_condition VARCHAR(100),
      furnished_status VARCHAR(100),
      apartment_type VARCHAR(100),
      rent_amount NUMERIC(12,2) DEFAULT 0 CHECK (rent_amount >= 0),
      caution_fee NUMERIC(12,2) DEFAULT 0 CHECK (caution_fee >= 0),
      lawyer_fee NUMERIC(12,2) DEFAULT 0 CHECK (lawyer_fee >= 0),
      legal_fees TEXT,
      payment_duration VARCHAR(50),
      apartment_status VARCHAR(50) DEFAULT 'available',
      tenant_eligibility TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      tenant_updated_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS land_properties (
      property_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      estate_id UUID REFERENCES estates(id) ON DELETE SET NULL,
      seller_id UUID NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
      property_name TEXT NOT NULL,
      property_address TEXT NOT NULL,
      state_location TEXT NOT NULL,
      country TEXT NOT NULL,
      cover_image_url TEXT,
      gallery_images JSONB,
      price NUMERIC(14,2) NOT NULL CHECK (price >= 0),
      available_quantity NUMERIC NOT NULL CHECK (available_quantity >= 0),
      short_description TEXT NOT NULL,
      long_description TEXT NOT NULL,
      land_size NUMERIC,
      custom_land_size NUMERIC,
      price_per_450sqm NUMERIC,
      price_per_900sqm NUMERIC,
      price_per_custom_sqm NUMERIC,
      price_per_plot NUMERIC,
      booking_fee NUMERIC,
      statutory_fee NUMERIC,
      development_fee NUMERIC,
      survey_fee NUMERIC,
      legal_fee NUMERIC,
      documentation_fee NUMERIC,
      subscription_fee NUMERIC,
      agency_fee NUMERIC,
      other_fees NUMERIC,
      documents_available JSONB,
      land_type TEXT,
      topography TEXT,
      soil_type TEXT,
      fencing_status TEXT,
      electricity_availability TEXT,
      access_road_type TEXT,
      survey_status TEXT,
      government_acquisition_status TEXT,
      usage_status TEXT,
      status TEXT DEFAULT 'available',
      is_estate_land BOOLEAN DEFAULT FALSE,
      sold_out BOOLEAN DEFAULT FALSE,
      listing_date TIMESTAMPTZ DEFAULT NOW(),
      purchase_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS houses_for_sale (
      house_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
      lawyer_id UUID REFERENCES lawyers(id) ON DELETE SET NULL,
      buyer_id UUID REFERENCES users(id) ON DELETE SET NULL,
      status TEXT NOT NULL,
      verification_status TEXT NOT NULL,
      state TEXT NOT NULL,
      lga TEXT NOT NULL,
      address TEXT NOT NULL,
      landmark TEXT,
      latitude NUMERIC,
      longitude NUMERIC,
      bedrooms INTEGER,
      bathrooms INTEGER,
      toilets INTEGER,
      floors INTEGER,
      land_size NUMERIC,
      house_type TEXT,
      asking_price NUMERIC(14,2) NOT NULL CHECK (asking_price >= 0),
      final_sale_price NUMERIC(14,2) CHECK (final_sale_price >= 0),
      currency TEXT DEFAULT 'NGN',
      title_document TEXT NOT NULL,
      has_survey_plan BOOLEAN DEFAULT FALSE,
      has_building_approval BOOLEAN DEFAULT FALSE,
      governor_consent_obtained BOOLEAN DEFAULT FALSE,
      description TEXT,
      features JSONB,
      images JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      sold_at TIMESTAMPTZ,
      CONSTRAINT chk_hfs_status CHECK (status IN ('active','under_offer','sold','withdrawn')),
      CONSTRAINT chk_hfs_verification CHECK (verification_status IN ('pending','verified','rejected'))
    );
  `);
}

async function createFinanceAndOpsTables(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS tenant_meta (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      property_id UUID NOT NULL,
      property_type VARCHAR(50) NOT NULL,
      rent_amount NUMERIC(12,2) NOT NULL CHECK (rent_amount >= 0),
      rent_currency VARCHAR(10) DEFAULT 'NGN',
      rent_frequency VARCHAR(20) NOT NULL,
      tenancy_start_date DATE NOT NULL,
      tenancy_end_date DATE,
      is_active_tenant BOOLEAN DEFAULT TRUE,
      has_paid_current_rent BOOLEAN DEFAULT FALSE,
      notice_served BOOLEAN DEFAULT FALSE,
      last_payment_date DATE,
      next_due_date DATE,
      outstanding_balance NUMERIC(12,2) DEFAULT 0.00 CHECK (outstanding_balance >= 0),
      tenancy_status VARCHAR(30) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT chk_tenant_property_type CHECK (property_type IN ('apartment','house','land')),
      CONSTRAINT chk_tenant_rent_frequency CHECK (rent_frequency IN ('monthly','quarterly','yearly'))
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS finance_accounts (
      finance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      user_role VARCHAR(30) NOT NULL,
      wallet_balance NUMERIC(15,2) DEFAULT 0 CHECK (wallet_balance >= 0),
      commission_balance NUMERIC(15,2) DEFAULT 0 CHECK (commission_balance >= 0),
      total_earnings NUMERIC(15,2) DEFAULT 0 CHECK (total_earnings >= 0),
      total_withdrawn NUMERIC(15,2) DEFAULT 0 CHECK (total_withdrawn >= 0),
      total_properties_sold INTEGER DEFAULT 0 CHECK (total_properties_sold >= 0),
      total_sales_value NUMERIC(15,2) DEFAULT 0 CHECK (total_sales_value >= 0),
      bank_name VARCHAR(100),
      bank_account_number VARCHAR(30),
      bank_account_name VARCHAR(100),
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_name VARCHAR(200) NOT NULL,
      user_avatar_url TEXT,
      rating NUMERIC(2,1) CHECK (rating BETWEEN 0 AND 5),
      review_text TEXT,
      report_count INTEGER DEFAULT 0 CHECK (report_count >= 0),
      helpful_count INTEGER DEFAULT 0 CHECK (helpful_count >= 0),
      verified_buyer BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      deleted_at TIMESTAMPTZ
    );
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS property_orders (
      order_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      agent_id UUID REFERENCES users(id) ON DELETE SET NULL,
      lawyer_id UUID REFERENCES lawyers(id) ON DELETE SET NULL,
      property_id UUID NOT NULL,
      property_type VARCHAR(50) NOT NULL,
      status VARCHAR(30) NOT NULL,
      payment_type VARCHAR(30) NOT NULL,
      booking_fee NUMERIC(15,2) DEFAULT 0 CHECK (booking_fee >= 0),
      agreed_amount NUMERIC(15,2) NOT NULL CHECK (agreed_amount >= 0),
      amount_paid NUMERIC(15,2) DEFAULT 0 CHECK (amount_paid >= 0),
      currency VARCHAR(10) DEFAULT 'NGN',
      inspection_required BOOLEAN DEFAULT TRUE,
      inspection_completed BOOLEAN DEFAULT FALSE,
      due_diligence_completed BOOLEAN DEFAULT FALSE,
      agreement_signed BOOLEAN DEFAULT FALSE,
      government_consent_required BOOLEAN DEFAULT TRUE,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ
    );
  `);
}

async function ensureUpdatedAtTrigger(client) {
  await client.query(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);

  const triggerTables = [
    "users",
    "sellers",
    "lawyers",
    "estates",
    "houses",
    "apartments",
    "land_properties",
    "houses_for_sale",
    "tenant_meta",
    "finance_accounts",
    "property_orders",
  ];

  for (const tableName of triggerTables) {
    await client.query(`
      DROP TRIGGER IF EXISTS trg_${tableName}_updated_at ON ${tableName};
      CREATE TRIGGER trg_${tableName}_updated_at
      BEFORE UPDATE ON ${tableName}
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `);
  }
}

async function ensureIndexes(client) {
  const indexSql = [
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number)`,
    `CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at)`,
    `CREATE INDEX IF NOT EXISTS idx_sellers_user_id ON sellers(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_lawyers_user_id ON lawyers(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_estates_seller_id ON estates(seller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_houses_seller_id ON houses(seller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_houses_estate_id ON houses(estate_id)`,
    `CREATE INDEX IF NOT EXISTS idx_apartments_house_id ON apartments(house_id)`,
    `CREATE INDEX IF NOT EXISTS idx_apartments_tenant_id ON apartments(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_land_properties_seller_id ON land_properties(seller_id)`,
    `CREATE INDEX IF NOT EXISTS idx_houses_for_sale_owner_id ON houses_for_sale(owner_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tenant_meta_tenant_id ON tenant_meta(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_finance_accounts_user_id ON finance_accounts(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_property_orders_buyer_id ON property_orders(buyer_id)`,
    `CREATE INDEX IF NOT EXISTS idx_property_orders_property ON property_orders(property_type, property_id)`,
  ];

  for (const statement of indexSql) {
    await client.query(statement);
  }
}

export async function initializeDatabaseTablesSafe() {
  const client = await pool.connect();
  const startedAt = Date.now();

  try {
    console.log("[DB] migration started");

    await client.query("BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
      MIGRATION_NAME,
    ]);

    await runStep(client, "extensions", async () => ensureExtensions(client));
    await runStep(client, "_migration_history", async () =>
      ensureMigrationHistory(client)
    );

    if (await alreadyApplied(client)) {
      await client.query("COMMIT");
      console.log("[DB] migration skipped (already applied)");
      return { success: true, skipped: true };
    }

    await runStep(client, "core tables", async () => createCoreTables(client));
    await runStep(client, "property tables", async () =>
      createPropertyTables(client)
    );
    await runStep(client, "finance and ops tables", async () =>
      createFinanceAndOpsTables(client)
    );
    await runStep(client, "updated_at triggers", async () =>
      ensureUpdatedAtTrigger(client)
    );
    await runStep(client, "indexes", async () => ensureIndexes(client));

    const executionTimeMs = Date.now() - startedAt;
    await client.query(
      `
        INSERT INTO _migration_history (
          migration_name, checksum, status, execution_time_ms
        )
        VALUES ($1, $2, 'success', $3)
        ON CONFLICT (migration_name)
        DO UPDATE SET
          checksum = EXCLUDED.checksum,
          status = EXCLUDED.status,
          execution_time_ms = EXCLUDED.execution_time_ms,
          error_message = NULL,
          executed_at = NOW()
      `,
      [MIGRATION_NAME, MIGRATION_CHECKSUM, executionTimeMs]
    );

    await client.query("COMMIT");
    console.log("[DB] migration completed", { durationMs: executionTimeMs });
    return { success: true, skipped: false };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[DB] rollback failed", {
        message: rollbackError.message,
      });
    }

    const normalized =
      error instanceof Error
        ? error
        : new Error(typeof error === "string" ? error : "Unknown DB error");

    try {
      await pool.query(
        `
          INSERT INTO _migration_history (
            migration_name, checksum, status, execution_time_ms, error_message
          )
          VALUES ($1, $2, 'failed', $3, $4)
          ON CONFLICT (migration_name)
          DO UPDATE SET
            checksum = EXCLUDED.checksum,
            status = EXCLUDED.status,
            execution_time_ms = EXCLUDED.execution_time_ms,
            error_message = EXCLUDED.error_message,
            executed_at = NOW()
        `,
        [MIGRATION_NAME, MIGRATION_CHECKSUM, Date.now() - startedAt, normalized.message]
      );
    } catch (_) {
      // Best effort logging only.
    }

    throw normalized;
  } finally {
    client.release();
  }
}
