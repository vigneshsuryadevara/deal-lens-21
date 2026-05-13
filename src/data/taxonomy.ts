export const SECTORS = [
  "Software & SaaS",
  "Healthcare",
  "Industrials",
  "Consumer",
  "Financial Services",
  "Energy & Power",
  "TMT",
  "Business Services",
] as const;

export const GEOGRAPHIES = [
  "North America",
  "EMEA",
  "APAC",
  "LATAM",
  "Global",
] as const;

export const DEAL_TYPES = [
  "Strategic M&A",
  "Sponsor Buyout",
  "Carve-Out",
  "Growth Equity",
  "Take-Private",
  "Roll-Up",
] as const;

export type Sector = typeof SECTORS[number];
export type Geography = typeof GEOGRAPHIES[number];
export type DealType = typeof DEAL_TYPES[number];
