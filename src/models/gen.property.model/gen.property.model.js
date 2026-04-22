export const FIELD_MAP = Object.freeze({
  // primary keys / relations
  propertyId: "property_id",
  houseId: "house_id",
  sellerId: "seller_id",
  estateId: "estate_id",
  lawyerId: "lawyer_id",
  buyerId: "buyer_id",

  // identity
  referenceCode: "reference_code",
  name: "name",
  houseName: "house_name",
  unitNumber: "unit_number",
  propertyType: "property_type",

  // location
  address: "address",
  state: "state",
  lga: "lga",
  country: "country",

  // quantity / dimensions
  quantity: "quantity",
  bedrooms: "bedrooms",
  kitchens: "kitchens",
  livingRooms: "living_rooms",
  toilets: "toilets",
  roomSize: "room_size",
  size: "size",
  floors: "floors",

  // utilities
  hasRunningWater: "has_running_water",
  hasElectricity: "has_electricity",
  hasParkingSpace: "has_parking_space",
  hasInternet: "has_internet",

  // media / content
  coverImageUrl: "cover_image_url",
  description: "description",

  // pricing
  price: "price",
  askingPrice: "asking_price",
  finalSalePrice: "final_sale_price",
  currency: "currency",

  // fees
  bookingFee: "booking_fee",
  statutoryFee: "statutory_fee",
  developmentFee: "development_fee",
  surveyFee: "survey_fee",
  legalFee: "legal_fee",
  documentationFee: "documentation_fee",
  agencyFee: "agency_fee",
  otherFees: "other_fees",
  cautionFee: "caution_fee",
  subscriptionFee: "subscription_fee",

  // documents / land data
  documentsAvailable: "documents_available",
  landType: "land_type",
  topography: "topography",
  soilType: "soil_type",
  fencingStatus: "fencing_status",

  // access / legal / usage
  accessRoadType: "access_road_type",
  surveyStatus: "survey_status",
  governmentAcquisitionStatus: "government_acquisition_status",
  usageStatus: "usage_status",

  // state flags
  status: "status",
  soldOut: "sold_out",
  verificationStatus: "verification_status",
  isEstate: "is_estate",

  // descriptive metadata
  condition: "condition",
  furnishedStatus: "furnished_status",
  paymentDuration: "payment_duration",
  eligibility: "eligibility",

  // timestamps
  soldAt: "sold_at",
  createdAt: "created_at",
  updatedAt: "updated_at",
  deletedAt: "deleted_at",
});