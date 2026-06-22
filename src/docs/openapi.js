const jsonContent = {
  "application/json": {
    schema: {
      type: "object",
      additionalProperties: true,
    },
  },
};

const commonResponses = {
  200: { description: "Success" },
  400: { description: "Invalid request" },
  401: { description: "Unauthorized" },
  403: { description: "Forbidden" },
  404: { description: "Not found" },
  500: { description: "Server error" },
};

const requestBody = {
  required: false,
  content: jsonContent,
};

function pathParams(path) {
  const matches = path.matchAll(/\{([^}]+)\}/g);
  return [...matches].map((match) => ({
    name: match[1],
    in: "path",
    required: true,
    schema: {
      type: "string",
    },
  }));
}

function operation({ method, path, tag, summary, auth = false, body = false }) {
  const item = {
    tags: [tag],
    summary,
    parameters: pathParams(path),
    responses: commonResponses,
  };

  if (auth) {
    item.security = [{ bearerAuth: [] }];
  }

  if (body) {
    item.requestBody = requestBody;
  }

  return [path, method.toLowerCase(), item];
}

function buildPaths(endpoints) {
  return endpoints.reduce((paths, endpoint) => {
    const [path, method, item] = operation(endpoint);
    paths[path] = {
      ...(paths[path] || {}),
      [method]: item,
    };
    return paths;
  }, {});
}

const endpoints = [
  { method: "GET", path: "/api/health", tag: "Health", summary: "Health check" },

  { method: "POST", path: "/api/users/register", tag: "Users", summary: "Register user", body: true },
  { method: "POST", path: "/api/users/login", tag: "Users", summary: "Login user", body: true },
  { method: "GET", path: "/api/users/verify-email", tag: "Users", summary: "Verify user email" },
  { method: "PUT", path: "/api/users/{id}", tag: "Users", summary: "Update user profile", auth: true, body: true },
  { method: "POST", path: "/api/users/{id}/change-password", tag: "Users", summary: "Change user password", auth: true, body: true },
  { method: "PUT", path: "/api/users/{id}/lawyer-status", tag: "Users", summary: "Set lawyer status", auth: true, body: true },
  { method: "GET", path: "/api/users/email/{email}", tag: "Users", summary: "Get user by email" },
  { method: "GET", path: "/api/users/fullname/{email}", tag: "Users", summary: "Get user full name", auth: true },
  { method: "GET", path: "/api/users/{id}/basic", tag: "Users", summary: "Get basic user info", auth: true },
  { method: "GET", path: "/api/users/get/{id}/basic", tag: "Users", summary: "Get basic user info legacy route", auth: true },
  { method: "GET", path: "/api/users/userNotifications/{id}", tag: "Users", summary: "Get user notifications", auth: true },

  { method: "GET", path: "/api/sellers", tag: "Sellers", summary: "List sellers" },
  { method: "GET", path: "/api/sellers/search", tag: "Sellers", summary: "Search sellers" },
  { method: "GET", path: "/api/sellers/verified", tag: "Sellers", summary: "List verified sellers" },
  { method: "GET", path: "/api/sellers/top-rated", tag: "Sellers", summary: "List top-rated sellers" },
  { method: "POST", path: "/api/sellers/login/{id}", tag: "Sellers", summary: "Login seller by seller id", body: true },
  { method: "GET", path: "/api/sellers/{id}/properties", tag: "Sellers", summary: "Get seller property listings" },
  { method: "GET", path: "/api/sellers/{id}", tag: "Sellers", summary: "Get seller" },
  { method: "POST", path: "/api/sellers/login", tag: "Sellers", summary: "Login seller", auth: true, body: true },
  { method: "POST", path: "/api/sellers/register/individual", tag: "Sellers", summary: "Register individual seller", auth: true, body: true },
  { method: "POST", path: "/api/sellers/register/company", tag: "Sellers", summary: "Register company seller", auth: true, body: true },
  { method: "GET", path: "/api/sellers/user/{userId}", tag: "Sellers", summary: "Get seller by user id", auth: true },
  { method: "GET", path: "/api/sellers/{id}/profile-completion", tag: "Sellers", summary: "Get seller profile completion", auth: true },
  { method: "GET", path: "/api/sellers/{id}/can-list-properties", tag: "Sellers", summary: "Check if seller can list properties", auth: true },
  { method: "PUT", path: "/api/sellers/{id}/profile", tag: "Sellers", summary: "Update seller business profile", auth: true, body: true },
  { method: "PUT", path: "/api/sellers/{id}/banking", tag: "Sellers", summary: "Update seller banking details", auth: true, body: true },
  { method: "PUT", path: "/api/sellers/{id}/kyc/individual", tag: "Sellers", summary: "Update individual seller KYC", auth: true, body: true },
  { method: "PUT", path: "/api/sellers/{id}/kyc/company", tag: "Sellers", summary: "Update company seller documents", auth: true, body: true },
  { method: "PUT", path: "/api/sellers/{id}/terms", tag: "Sellers", summary: "Update seller terms acceptance", auth: true, body: true },
  { method: "POST", path: "/api/sellers/{id}/gallery", tag: "Sellers", summary: "Add seller gallery image", auth: true, body: true },
  { method: "DELETE", path: "/api/sellers/{id}/gallery/{imageUrl}", tag: "Sellers", summary: "Remove seller gallery image", auth: true },
  { method: "GET", path: "/api/sellers/analytics/counts-by-status", tag: "Sellers Admin", summary: "Get seller counts by status", auth: true },
  { method: "GET", path: "/api/sellers/analytics/counts-by-verification", tag: "Sellers Admin", summary: "Get seller counts by verification", auth: true },
  { method: "GET", path: "/api/sellers/analytics/counts-by-type", tag: "Sellers Admin", summary: "Get seller counts by type", auth: true },
  { method: "GET", path: "/api/sellers/analytics/total-statistics", tag: "Sellers Admin", summary: "Get seller total statistics", auth: true },
  { method: "PUT", path: "/api/sellers/{id}/ratings", tag: "Sellers Admin", summary: "Update seller ratings", auth: true, body: true },
  { method: "POST", path: "/api/sellers/{id}/verify", tag: "Sellers Admin", summary: "Verify seller", auth: true, body: true },
  { method: "POST", path: "/api/sellers/{id}/reject", tag: "Sellers Admin", summary: "Reject seller", auth: true, body: true },
  { method: "POST", path: "/api/sellers/{id}/suspend", tag: "Sellers Admin", summary: "Suspend seller", auth: true, body: true },
  { method: "POST", path: "/api/sellers/{id}/deactivate", tag: "Sellers Admin", summary: "Deactivate seller", auth: true, body: true },
  { method: "POST", path: "/api/sellers/{id}/reactivate", tag: "Sellers Admin", summary: "Reactivate seller", auth: true },
  { method: "POST", path: "/api/sellers/{id}/certify", tag: "Sellers Admin", summary: "Certify seller", auth: true },
  { method: "POST", path: "/api/sellers/{id}/restore", tag: "Sellers Admin", summary: "Restore seller", auth: true, body: true },
  { method: "DELETE", path: "/api/sellers/{id}", tag: "Sellers Admin", summary: "Delete seller", auth: true, body: true },

  { method: "GET", path: "/api/estates/getAllEstateBySeller/{sellerId}", tag: "Estates", summary: "Get all estates by seller" },
  { method: "GET", path: "/api/estates/residential/{sellerId}", tag: "Estates", summary: "Get residential estates by seller" },
  { method: "GET", path: "/api/estates/getLandedEstates/{sellerId}", tag: "Estates", summary: "Get landed estates by seller" },
  { method: "GET", path: "/api/estates/getEstate/{estateId}", tag: "Estates", summary: "Get estate" },
  { method: "POST", path: "/api/estates/createEstate", tag: "Estates", summary: "Create estate", auth: true, body: true },
  { method: "PUT", path: "/api/estates/updateEstateCoverImage/{estateId}", tag: "Estates", summary: "Update estate cover image", auth: true, body: true },
  { method: "PUT", path: "/api/estates/updateEstate/{estateId}", tag: "Estates", summary: "Update estate details", auth: true, body: true },
  { method: "DELETE", path: "/api/estates/deleteEstate/{estateId}", tag: "Estates", summary: "Soft delete estate", auth: true },
  { method: "DELETE", path: "/api/estates/adminDeleteEstate/{estateId}", tag: "Estates Admin", summary: "Delete estate", auth: true },
  { method: "DELETE", path: "/api/estates/estates/{estateId}", tag: "Estates Admin", summary: "Delete estate admin route", auth: true },
  { method: "GET", path: "/api/estates/estates/getDeletedestatesBySellerID/{sellerId}", tag: "Estates Admin", summary: "Get deleted estates by seller", auth: true },
  { method: "GET", path: "/api/estates/estates/deleted/{sellerId}", tag: "Estates Admin", summary: "Get deleted estates by seller legacy route", auth: true },

  { method: "GET", path: "/api/houses", tag: "Houses", summary: "List houses" },
  { method: "GET", path: "/api/houses/getAllHouses", tag: "Houses", summary: "List houses legacy route" },
  { method: "GET", path: "/api/houses/standalone/{sellerId}", tag: "Houses", summary: "Get standalone houses by seller" },
  { method: "GET", path: "/api/houses/standalone", tag: "Houses", summary: "Get standalone houses" },
  { method: "GET", path: "/api/houses/estateHouses/{sellerId}/{estateId}", tag: "Houses", summary: "Get estate houses by seller" },
  { method: "GET", path: "/api/houses/estateHouses", tag: "Houses", summary: "Get estate houses" },
  { method: "GET", path: "/api/houses/seller/{sellerId}", tag: "Houses", summary: "Get houses by seller" },
  { method: "GET", path: "/api/houses/estate/{estateId}", tag: "Houses", summary: "Get houses by estate" },
  { method: "GET", path: "/api/houses/{id}", tag: "Houses", summary: "Get house" },
  { method: "PUT", path: "/api/houses/updateHouseDescription/{houseId}", tag: "Houses", summary: "Update house description", auth: true, body: true },
  { method: "POST", path: "/api/houses", tag: "Houses", summary: "Create house", auth: true, body: true },
  { method: "POST", path: "/api/houses/createHouse", tag: "Houses", summary: "Create house legacy route", auth: true, body: true },
  { method: "PUT", path: "/api/houses/{id}/cover", tag: "Houses", summary: "Update house cover", auth: true, body: true },
  { method: "PUT", path: "/api/houses/{id}/coverImage", tag: "Houses", summary: "Update house cover legacy route", auth: true, body: true },
  { method: "PUT", path: "/api/houses/{id}/lawyer", tag: "Houses", summary: "Update house lawyer", auth: true, body: true },
  { method: "PUT", path: "/api/houses/{id}/updateHouseLawyer", tag: "Houses", summary: "Update house lawyer legacy route", auth: true, body: true },
  { method: "PUT", path: "/api/houses/{id}/caretaker", tag: "Houses", summary: "Update house caretaker", auth: true, body: true },
  { method: "PUT", path: "/api/houses/{id}/updateHouseCaretaker", tag: "Houses", summary: "Update house caretaker legacy route", auth: true, body: true },
  { method: "PUT", path: "/api/houses/softDeleteHouse/{id}", tag: "Houses", summary: "Soft delete house", body: true },
  { method: "PUT", path: "/api/houses/{id}", tag: "Houses", summary: "Update house", auth: true, body: true },
  { method: "PUT", path: "/api/houses/updateHouse/{id}", tag: "Houses", summary: "Update house legacy route", auth: true, body: true },
  { method: "DELETE", path: "/api/houses/{id}", tag: "Houses Admin", summary: "Delete house", auth: true },
  { method: "DELETE", path: "/api/houses/deleteHouse/{id}", tag: "Houses Admin", summary: "Delete house legacy route", auth: true },

  { method: "GET", path: "/api/properties/get", tag: "Properties", summary: "Get all properties" },
  { method: "GET", path: "/api/properties/available", tag: "Properties", summary: "Get available properties" },
  { method: "GET", path: "/api/properties/search", tag: "Properties", summary: "Search properties" },
  { method: "GET", path: "/api/properties/list", tag: "Properties", summary: "List properties" },
  { method: "GET", path: "/api/properties/stats", tag: "Properties", summary: "Get property stats" },
  { method: "GET", path: "/api/properties/sellerProperties/{sellerId}", tag: "Properties", summary: "Get seller properties" },
  { method: "GET", path: "/api/properties/sellerHouseApartments/{sellerId}/{houseId}", tag: "Properties", summary: "Get seller house apartments" },
  { method: "POST", path: "/api/properties/stats/count", tag: "Properties", summary: "Count properties", body: true },
  { method: "POST", path: "/api/properties/sellerProperties/{sellerId}", tag: "Properties", summary: "Get seller properties by type", body: true },
  { method: "POST", path: "/api/properties/sellerEstateProperties/{sellerId}/{estateId}/{propertyType}", tag: "Properties", summary: "Get estate properties", body: true },
  { method: "POST", path: "/api/properties/sellerNonEstateProperties/{sellerId}/{propertyType}", tag: "Properties", summary: "Get non-estate properties", body: true },
  { method: "GET", path: "/api/properties/getById/{propertyId}/{sellerId}", tag: "Properties", summary: "Get property by id" },
  { method: "DELETE", path: "/api/properties/deleteProperty/{sellerId}/{propertyId}", tag: "Properties", summary: "Delete property" },
  { method: "POST", path: "/api/properties/create", tag: "Properties", summary: "Create property", body: true },
  { method: "PUT", path: "/api/properties/update/{propertyId}", tag: "Properties", summary: "Update property", body: true },
  { method: "GET", path: "/api/properties/sellerEstateLand/{sellerId}", tag: "Properties", summary: "Get seller estate lands" },
  { method: "PATCH", path: "/api/properties/coverImageUrl/{propertyId}", tag: "Properties", summary: "Update property cover image URL", body: true },
  { method: "POST", path: "/api/properties/bulkInsert", tag: "Properties", summary: "Insert multiple properties", body: true },
  { method: "POST", path: "/api/properties/bulk", tag: "Properties Admin", summary: "Bulk insert properties", auth: true, body: true },
  { method: "DELETE", path: "/api/properties/delete/{propertyId}", tag: "Properties Admin", summary: "Delete property by id", auth: true },
  { method: "DELETE", path: "/api/properties/clear/all", tag: "Properties Admin", summary: "Clear all properties", auth: true },

  { method: "GET", path: "/api/purchase-process/{propertyId}", tag: "Purchase Process", summary: "Get purchase process by property", auth: true },
  { method: "POST", path: "/api/purchase-process/{propertyId}/inspection/request", tag: "Purchase Process", summary: "Request inspection", auth: true, body: true },
  { method: "PATCH", path: "/api/purchase-process/{propertyId}/inspection/confirm", tag: "Purchase Process", summary: "Confirm inspection", auth: true, body: true },
  { method: "POST", path: "/api/purchase-process/{propertyId}/payment/request", tag: "Purchase Process", summary: "Request payment", auth: true, body: true },
  { method: "POST", path: "/api/purchase-process/{propertyId}/contract-signing/request", tag: "Purchase Process", summary: "Request contract signing", auth: true, body: true },
  { method: "PATCH", path: "/api/purchase-process/{propertyId}/contract-signing/confirm", tag: "Purchase Process", summary: "Confirm contract signing", auth: true, body: true },
  { method: "PATCH", path: "/api/purchase-process/{propertyId}/documents/confirm-upload", tag: "Purchase Process", summary: "Confirm document upload", auth: true, body: true },

  { method: "GET", path: "/api/images/getPropertyImages/{propertyId}", tag: "Images", summary: "Get property images" },
  { method: "GET", path: "/api/images/property/{propertyId}", tag: "Images", summary: "Get property images legacy route" },
  { method: "POST", path: "/api/images/bulk/getMulttipleImagesByid", tag: "Images", summary: "Get multiple property images", body: true },
  { method: "POST", path: "/api/images/bulk/get-by-property-ids", tag: "Images", summary: "Get multiple property images by property ids", body: true },
  { method: "POST", path: "/api/images/createImages", tag: "Images", summary: "Create property image", auth: true, body: true },
  { method: "POST", path: "/api/images/bulk/insertMultipleImages", tag: "Images", summary: "Insert multiple images", auth: true, body: true },
  { method: "DELETE", path: "/api/images/deleteSingleImage/{imageUrl}", tag: "Images", summary: "Delete single image" },
  { method: "DELETE", path: "/api/images/property/{propertyId}", tag: "Images", summary: "Delete property images", auth: true },
  { method: "DELETE", path: "/api/images/bulk/deleteMultiplePropertyImages", tag: "Images", summary: "Delete multiple property images", auth: true, body: true },
  { method: "DELETE", path: "/api/images/bulk/delete-by-property-ids", tag: "Images", summary: "Delete multiple property images by property ids", auth: true, body: true },

  { method: "GET", path: "/api/notifications/get/{id}", tag: "Notifications", summary: "Get notifications by user" },
  { method: "POST", path: "/api/notifications/inquiry", tag: "Notifications", summary: "Queue inquiry notification", body: true },
];

export const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "Real Kudu API",
    version: "1.0.0",
    description: "OpenAPI documentation for the Real Kudu API endpoints.",
  },
  servers: [
    {
      url: "/",
      description: "Current server",
    },
  ],
  tags: [
    "Health",
    "Users",
    "Sellers",
    "Sellers Admin",
    "Estates",
    "Estates Admin",
    "Houses",
    "Houses Admin",
    "Properties",
    "Properties Admin",
    "Purchase Process",
    "Images",
    "Notifications",
  ].map((name) => ({ name })),
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  paths: buildPaths(endpoints),
};

export function swaggerHtml() {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Real Kudu API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f7f8fa; }
      .swagger-ui .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: "/api/docs.json",
          dom_id: "#swagger-ui",
          deepLinking: true,
          persistAuthorization: true,
        });
      };
    </script>
  </body>
</html>`;
}
