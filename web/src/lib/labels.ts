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

export const EXPENSE_CATEGORIES = {
  REPAIR: "Repair", MAINTENANCE: "Maintenance", UTILITY: "Utility bill", PROPERTY_TAX: "Property tax", INSURANCE: "Insurance",
  SALARY: "Salary", COMMISSION: "Commission", LEGAL: "Legal", LOAN_INTEREST: "Loan interest", OTHER: "Other",
} as const;

export const METER_TYPES = { ELECTRICITY: "Electricity", WATER: "Water", GAS: "Gas", OTHER: "Other" } as const;
export const UOMS = { KWH: "kWh", M3: "m³", LITRE: "litres", UNIT: "units" } as const;

export const DOC_CATEGORIES = {
  AGREEMENT: "Rent agreement", ID_PROOF: "ID proof", ADDRESS_PROOF: "Address proof", POLICE_VERIFICATION: "Police verification",
  PAYMENT_PROOF: "Payment proof", BILL: "Bill", PHOTO: "Photo", PAYMENT_QR: "Payment QR", OTHER: "Other",
} as const;
/** Always sensitive (05 §2.19). They are about a person, so on a tenancy they are filed under the tenant and follow them to later tenancies. */
export const PERSON_DOCS: readonly string[] = ["ID_PROOF", "ADDRESS_PROOF", "POLICE_VERIFICATION"];
