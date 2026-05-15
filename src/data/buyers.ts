export type BuyerType = "Strategic" | "Sponsor";
export type Sector =
  | "Software & SaaS"
  | "Healthcare"
  | "Industrials"
  | "Consumer"
  | "Financial Services"
  | "Energy & Power"
  | "TMT"
  | "Business Services";

export type Buyer = {
  id: string;
  name: string;
  type: BuyerType;
  initials: string;
  sectors: Sector[];          // primary sectors this buyer targets
  sectorFit: number;          // dynamically computed per-analysis, 0-100
  appetite: number;           // 0-100 deployment appetite
  pastDeals: { target: string; year: number; size: number; sector: Sector }[];
  rationale: string;
  aum?: string;
  hq: string;
};

export const BUYERS: Buyer[] = [
  // ── Sponsors — Software / Tech focused ────────────────────────────────────
  {
    id: "b1", name: "Thoma Bravo", type: "Sponsor", initials: "TB", hq: "Chicago", aum: "$160B AUM",
    sectors: ["Software & SaaS", "Financial Services"],
    sectorFit: 96, appetite: 92,
    rationale: "Most active enterprise software sponsor globally; proven playbook of margin expansion and buy-and-build in vertical SaaS.",
    pastDeals: [
      { target: "Anaplan", year: 2022, size: 10700e6, sector: "Software & SaaS" },
      { target: "Coupa Software", year: 2022, size: 8000e6, sector: "Software & SaaS" },
      { target: "Darktrace", year: 2024, size: 5300e6, sector: "Software & SaaS" },
      { target: "Bottomline Tech", year: 2022, size: 2600e6, sector: "Financial Services" },
    ],
  },
  {
    id: "b2", name: "Vista Equity Partners", type: "Sponsor", initials: "VE", hq: "Austin", aum: "$100B AUM",
    sectors: ["Software & SaaS", "Financial Services", "Healthcare"],
    sectorFit: 94, appetite: 88,
    rationale: "Vertical and horizontal software specialist; deep operating playbook with Vista Consulting Group.",
    pastDeals: [
      { target: "Avalara", year: 2022, size: 8400e6, sector: "Software & SaaS" },
      { target: "KnowBe4", year: 2023, size: 4600e6, sector: "Software & SaaS" },
      { target: "Smartsheet", year: 2024, size: 8400e6, sector: "Software & SaaS" },
    ],
  },
  {
    id: "b3", name: "Silver Lake", type: "Sponsor", initials: "SL", hq: "Menlo Park", aum: "$102B AUM",
    sectors: ["Software & SaaS", "TMT", "Consumer"],
    sectorFit: 88, appetite: 76,
    rationale: "Tech-focused mega-fund; comfortable with large-cap take-privates and complex technology transactions.",
    pastDeals: [
      { target: "Qualtrics", year: 2023, size: 12500e6, sector: "Software & SaaS" },
      { target: "Endeavor Group", year: 2024, size: 13000e6, sector: "TMT" },
    ],
  },

  // ── Sponsors — Healthcare focused ──────────────────────────────────────────
  {
    id: "b4", name: "Nordic Capital", type: "Sponsor", initials: "NC", hq: "Stockholm", aum: "$22B AUM",
    sectors: ["Healthcare", "Financial Services", "Business Services"],
    sectorFit: 91, appetite: 80,
    rationale: "Europe's leading healthcare sponsor; deep expertise in medtech, pharma services, and health IT.",
    pastDeals: [
      { target: "Inovalon", year: 2022, size: 7300e6, sector: "Healthcare" },
    ],
  },
  {
    id: "b5", name: "Hellman & Friedman", type: "Sponsor", initials: "HF", hq: "San Francisco", aum: "$120B AUM",
    sectors: ["Healthcare", "Software & SaaS", "Financial Services"],
    sectorFit: 85, appetite: 78,
    rationale: "Concentrated portfolio strategy; deep sector expertise across healthcare, fintech, and software.",
    pastDeals: [
      { target: "Athenahealth", year: 2022, size: 17000e6, sector: "Healthcare" },
      { target: "Zendesk", year: 2022, size: 10200e6, sector: "Software & SaaS" },
      { target: "Enverus", year: 2022, size: 4500e6, sector: "Energy & Power" },
    ],
  },
  {
    id: "b6", name: "Warburg Pincus", type: "Sponsor", initials: "WP", hq: "New York", aum: "$83B AUM",
    sectors: ["Healthcare", "Financial Services", "TMT", "Consumer"],
    sectorFit: 82, appetite: 77,
    rationale: "Global growth equity and buyout; particularly active in healthcare services and health IT.",
    pastDeals: [
      { target: "Modernizing Medicine", year: 2021, size: 1500e6, sector: "Healthcare" },
    ],
  },

  // ── Sponsors — Industrials / Energy focused ────────────────────────────────
  {
    id: "b7", name: "KKR", type: "Sponsor", initials: "KK", hq: "New York", aum: "$600B AUM",
    sectors: ["Industrials", "Healthcare", "Software & SaaS", "Business Services", "Energy & Power"],
    sectorFit: 80, appetite: 85,
    rationale: "Largest global diversified sponsor; industrial, infra, and tech verticals all active.",
    pastDeals: [
      { target: "Instructure", year: 2024, size: 4800e6, sector: "Software & SaaS" },
    ],
  },
  {
    id: "b8", name: "Blackstone", type: "Sponsor", initials: "BX", hq: "New York", aum: "$1.1T AUM",
    sectors: ["Consumer", "Industrials", "Healthcare", "Business Services", "Software & SaaS"],
    sectorFit: 78, appetite: 88,
    rationale: "World's largest alternative asset manager; deploys across all sectors at mega-cap scale.",
    pastDeals: [
      { target: "Smartsheet", year: 2024, size: 8400e6, sector: "Software & SaaS" },
      { target: "Cvent", year: 2023, size: 4600e6, sector: "Software & SaaS" },
      { target: "Medline", year: 2021, size: 34000e6, sector: "Healthcare" },
    ],
  },
  {
    id: "b9", name: "Carlyle Group", type: "Sponsor", initials: "CG", hq: "Washington DC", aum: "$435B AUM",
    sectors: ["Industrials", "Healthcare", "Energy & Power", "Business Services"],
    sectorFit: 76, appetite: 79,
    rationale: "Defense, aerospace, industrials, and healthcare specialist; deep government services expertise.",
    pastDeals: [
      { target: "Medline", year: 2021, size: 34000e6, sector: "Healthcare" },
    ],
  },
  {
    id: "b10", name: "Veritas Capital", type: "Sponsor", initials: "VC", hq: "New York", aum: "$45B AUM",
    sectors: ["Energy & Power", "Industrials", "Business Services", "Healthcare"],
    sectorFit: 83, appetite: 75,
    rationale: "Government and defense technology specialist; energy data and services with recurring revenue.",
    pastDeals: [
      { target: "Wood Mackenzie", year: 2023, size: 3100e6, sector: "Energy & Power" },
    ],
  },
  {
    id: "b11", name: "Advent International", type: "Sponsor", initials: "AD", hq: "Boston", aum: "$95B AUM",
    sectors: ["Financial Services", "Business Services", "Consumer", "Industrials"],
    sectorFit: 72, appetite: 68,
    rationale: "Global buyout with fintech, payments, and industrial services focus.",
    pastDeals: [
      { target: "Nuvei", year: 2024, size: 6300e6, sector: "Financial Services" },
    ],
  },
  {
    id: "b12", name: "Permira", type: "Sponsor", initials: "PM", hq: "London", aum: "$80B AUM",
    sectors: ["Consumer", "Software & SaaS", "TMT", "Business Services"],
    sectorFit: 80, appetite: 74,
    rationale: "Transatlantic sponsor with consumer tech and digital marketplace expertise.",
    pastDeals: [
      { target: "Squarespace", year: 2024, size: 6900e6, sector: "Consumer" },
      { target: "Zendesk", year: 2022, size: 10200e6, sector: "Software & SaaS" },
      { target: "Adevinta", year: 2023, size: 14200e6, sector: "Consumer" },
    ],
  },

  // ── Strategics — Tech ─────────────────────────────────────────────────────
  {
    id: "b13", name: "Microsoft", type: "Strategic", initials: "MS", hq: "Redmond",
    sectors: ["Software & SaaS", "TMT", "Business Services"],
    sectorFit: 92, appetite: 60,
    rationale: "Azure, Copilot, and Teams ecosystem acquisitions; AI and productivity bolt-ons.",
    pastDeals: [
      { target: "Nuance Communications", year: 2022, size: 19700e6, sector: "Software & SaaS" },
      { target: "Activision Blizzard", year: 2023, size: 68700e6, sector: "TMT" },
    ],
  },
  {
    id: "b14", name: "Salesforce", type: "Strategic", initials: "SF", hq: "San Francisco",
    sectors: ["Software & SaaS", "Business Services"],
    sectorFit: 88, appetite: 50,
    rationale: "CRM platform expansions; M&A discipline tightened post-Slack integration.",
    pastDeals: [
      { target: "Slack", year: 2021, size: 27700e6, sector: "Software & SaaS" },
    ],
  },
  {
    id: "b15", name: "Oracle", type: "Strategic", initials: "OR", hq: "Austin",
    sectors: ["Software & SaaS", "Healthcare", "Business Services"],
    sectorFit: 84, appetite: 68,
    rationale: "Cloud and ERP expansion; healthcare data post-Cerner acquisition.",
    pastDeals: [
      { target: "Cerner", year: 2022, size: 28300e6, sector: "Healthcare" },
    ],
  },

  // ── Strategics — Healthcare ───────────────────────────────────────────────
  {
    id: "b16", name: "UnitedHealth / Optum", type: "Strategic", initials: "UH", hq: "Minnetonka",
    sectors: ["Healthcare"],
    sectorFit: 94, appetite: 70,
    rationale: "Optum health services platform; largest healthcare strategic acquirer by volume.",
    pastDeals: [
      { target: "Change Healthcare", year: 2022, size: 13000e6, sector: "Healthcare" },
    ],
  },
  {
    id: "b17", name: "CVS Health", type: "Strategic", initials: "CV", hq: "Woonsocket",
    sectors: ["Healthcare"],
    sectorFit: 88, appetite: 65,
    rationale: "Vertical integration into primary care and specialty health services.",
    pastDeals: [
      { target: "Signify Health", year: 2022, size: 8000e6, sector: "Healthcare" },
    ],
  },

  // ── Strategics — Industrials ──────────────────────────────────────────────
  {
    id: "b18", name: "Siemens", type: "Strategic", initials: "SI", hq: "Munich",
    sectors: ["Industrials", "Energy & Power", "Software & SaaS"],
    sectorFit: 88, appetite: 72,
    rationale: "Industrial software consolidation via Siemens Digital Industries; PLM and simulation.",
    pastDeals: [
      { target: "Altair Engineering", year: 2024, size: 10600e6, sector: "Industrials" },
    ],
  },
  {
    id: "b19", name: "Cisco Systems", type: "Strategic", initials: "CS", hq: "San Jose",
    sectors: ["Software & SaaS", "TMT"],
    sectorFit: 80, appetite: 68,
    rationale: "Security and observability platform expansion; post-Splunk integration underway.",
    pastDeals: [
      { target: "Splunk", year: 2024, size: 28000e6, sector: "Software & SaaS" },
    ],
  },

  // ── Strategics — Financial Services ──────────────────────────────────────
  {
    id: "b20", name: "Intercontinental Exchange (ICE)", type: "Strategic", initials: "IC", hq: "Atlanta",
    sectors: ["Financial Services", "Business Services"],
    sectorFit: 90, appetite: 70,
    rationale: "Data and exchange infrastructure acquirer; mortgage tech and fixed income data.",
    pastDeals: [
      { target: "Black Knight", year: 2023, size: 13100e6, sector: "Financial Services" },
    ],
  },
];

/**
 * Get buyers ranked by how well they match a given sector.
 * Returns buyers who cover that sector, sorted by appetite × sectorFit.
 */
export function getBuyersForSector(sector: string): Buyer[] {
  return BUYERS
    .filter(b => b.sectors.includes(sector as Sector))
    .sort((a, b) => (b.sectorFit * b.appetite) - (a.sectorFit * a.appetite));
}
