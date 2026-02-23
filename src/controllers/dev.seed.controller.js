import pool from "../config/db.js";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (value) => UUID_RE.test(String(value || ""));

const ok = (res, data, message = "Success", status = 200) =>
  res.status(status).json({ success: true, message, data });

const fail = (res, status, message, code = "BAD_REQUEST", details = undefined) =>
  res.status(status).json({
    success: false,
    error: { code, message, details },
  });

export const seedTestAssets = async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    return fail(
      res,
      403,
      "Seed endpoint is disabled in production",
      "FORBIDDEN"
    );
  }

  const actorUserId = req.user?.id;
  if (!actorUserId || !isUuid(actorUserId)) {
    return fail(res, 401, "Unauthorized", "UNAUTHORIZED");
  }

  const sellerIdInput = req.body?.sellerId;
  const sellerIdToUse = sellerIdInput || null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let sellerId = sellerIdToUse;
    if (!sellerId) {
      const sellerLookup = await client.query(
        `SELECT id FROM sellers WHERE user_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [actorUserId]
      );
      if (!sellerLookup.rowCount) {
        await client.query("ROLLBACK");
        return fail(
          res,
          404,
          "No seller profile found for authenticated user",
          "SELLER_NOT_FOUND"
        );
      }
      sellerId = sellerLookup.rows[0].id;
    }

    if (!isUuid(sellerId)) {
      await client.query("ROLLBACK");
      return fail(res, 400, "sellerId must be a valid UUID", "VALIDATION_ERROR");
    }

    const suffix = Date.now();

    const estateResult = await client.query(
      `
        INSERT INTO estates (
          seller_id, name, address, lga, state, is_land_estate
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, seller_id, name
      `,
      [
        sellerId,
        `Seed Estate ${suffix}`,
        "Seed Address, Lekki",
        "Eti-Osa",
        "Lagos",
        false,
      ]
    );
    const estateId = estateResult.rows[0].id;

    const houseResult = await client.query(
      `
        INSERT INTO houses (
          estate_id, seller_id, name, type, address, is_single_house
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id, estate_id, seller_id, name
      `,
      [
        estateId,
        sellerId,
        `Seed House ${suffix}`,
        "duplex",
        "Seed House Address, Lekki",
        true,
      ]
    );
    const houseId = houseResult.rows[0].id;

    const apartmentResult = await client.query(
      `
        INSERT INTO apartments (
          house_id,
          seller_id,
          apartment_address,
          number_of_bedrooms,
          number_of_kitchens,
          number_of_living_rooms,
          number_of_toilets,
          description,
          rent_amount,
          caution_fee,
          lawyer_fee,
          payment_duration,
          house_name,
          apartment_type,
          apartment_condition,
          furnished_status,
          tenant_eligibility,
          has_running_water,
          has_electricity,
          has_parking_space,
          has_internet
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
          $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
        )
        RETURNING id, house_id, seller_id, apartment_address
      `,
      [
        houseId,
        sellerId,
        "Seed Apartment Address, Lekki",
        2,
        1,
        1,
        2,
        "Seed apartment for integration testing",
        3500000,
        300000,
        150000,
        "yearly",
        `Seed House ${suffix}`,
        "2-bedroom",
        "new",
        "furnished",
        "Employed professionals",
        true,
        true,
        true,
        true,
      ]
    );

    const landResult = await client.query(
      `
        INSERT INTO land_properties (
          estate_id,
          seller_id,
          property_name,
          property_address,
          state_location,
          country,
          price,
          available_quantity,
          short_description,
          long_description,
          status,
          is_estate_land,
          land_type
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
        RETURNING property_id, estate_id, seller_id, property_name
      `,
      [
        estateId,
        sellerId,
        `Seed Land ${suffix}`,
        "Seed Land Address, Lekki",
        "Lagos",
        "Nigeria",
        25000000,
        12,
        "Seed land for integration testing",
        "Seed land for integration testing with full linkage",
        "available",
        true,
        "residential",
      ]
    );

    await client.query("COMMIT");

    return ok(
      res,
      {
        sellerId,
        estate: estateResult.rows[0],
        house: houseResult.rows[0],
        apartment: apartmentResult.rows[0],
        land: landResult.rows[0],
      },
      "Seed assets created successfully",
      201
    );
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {
      // no-op
    }

    if (error?.code === "23503") {
      return fail(
        res,
        400,
        "Invalid linked resource reference while seeding",
        "FK_CONSTRAINT"
      );
    }

    console.error("[dev.seed] seed failed", {
      message: error?.message,
      code: error?.code,
      detail: error?.detail,
    });
    return fail(res, 500, "Seed failed", "SEED_FAILED");
  } finally {
    client.release();
  }
};
