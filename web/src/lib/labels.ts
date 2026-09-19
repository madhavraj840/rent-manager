// Display labels for stored codes (codes from docs/05 CHECK constraints).
export const METHODS = { CASH: "Cash", UPI: "UPI", BANK_TRANSFER: "Bank", CHEQUE: "Cheque", CARD: "Card", MOBILE_WALLET: "Wallet", OTHER: "Other", OPENING_BALANCE: "Opening", INTERNAL_TRANSFER: "Transfer" } as const;
export const PAY_METHODS = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD", "MOBILE_WALLET", "OTHER"] as const;

export const CHARGE_CATEGORIES = { UTILITY: "Electricity / water", MAINTENANCE: "Maintenance", LATE_FEE: "Late fee", PARKING: "Parking", DAMAGE: "Damage", CLEANING: "Cleaning", TAX: "Tax", OTHER: "Other" } as const;
export const CREDIT_CATEGORIES = { DISCOUNT: "Discount", WAIVER: "Waiver", ADJUSTMENT: "Adjustment", WRITE_OFF: "Write-off" } as const;

export const PROPERTY_TYPES = {
  RESIDENTIAL_BUILDING: "Apartment building", INDEPENDENT_HOUSE: "Independent house", APARTMENT: "Single apartment", PG_HOSTEL: "PG / hostel",
  COMMERCIAL: "Commercial", MIXED_USE: "Mixed use", LAND: "Land", OTHER: "Other",
} as const;

export const UNIT_TYPES = { FLAT: "Flat", HOUSE: "House", ROOM: "Room", BED: "Bed", SHOP: "Shop", OFFICE: "Office", WAREHOUSE: "Warehouse", PARKING: "Parking", OTHER: "Other" } as const;

export const label = <T extends Record<string, string>>(map: T, code?: string | null) => (code && code in map ? map[code as keyof T] : code ?? "");
