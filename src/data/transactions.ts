export type Confidence = "High" | "Medium" | "Low";
export type Sector =
  | "Software & SaaS"
  | "Healthcare"
  | "Industrials"
  | "Consumer"
  | "Financial Services"
  | "Energy & Power"
  | "TMT"
  | "Business Services";

export type Transaction = {
  id: string;
  target: string;
  acquirer: string;
  date: string;
  dealValue: number;    // USD absolute
  evRevenue: number;
  evEbitda: number;
  growth: number;       // %
  ebitdaMargin: number; // %
  type: "Strategic" | "Sponsor" | "Carve-Out" | "Take-Private";
  sector: Sector;
  confidence: Confidence;
  rationale: string;
  notes: string;
  sources: { label: string; url: string }[];
};

export const TRANSACTIONS: Transaction[] = [
  // ── Software & SaaS ────────────────────────────────────────────────────────
  { id: "t1",  sector: "Software & SaaS", target: "Anaplan",        acquirer: "Thoma Bravo",           date: "2022-06-21", dealValue: 10700e6, evRevenue: 13.4, evEbitda: 42.1, growth: 32, ebitdaMargin: 12, type: "Take-Private",  confidence: "High",   rationale: "Premium paid for category-defining EPM platform with sticky enterprise base.", notes: "Take-private at $66/share; 33% premium to undisturbed price.", sources: [{ label: "8-K", url: "#" }] },
  { id: "t2",  sector: "Software & SaaS", target: "Coupa Software", acquirer: "Thoma Bravo",           date: "2022-12-12", dealValue: 8000e6,  evRevenue: 9.4,  evEbitda: 38.7, growth: 18, ebitdaMargin: 18, type: "Take-Private",  confidence: "High",   rationale: "Spend management leader; LBO supported by recurring revenue base.", notes: "$81/share cash; direct lender financing.", sources: [{ label: "Proxy", url: "#" }] },
  { id: "t3",  sector: "Software & SaaS", target: "Avalara",        acquirer: "Vista Equity",          date: "2022-08-08", dealValue: 8400e6,  evRevenue: 9.8,  evEbitda: 35.2, growth: 28, ebitdaMargin: 14, type: "Take-Private",  confidence: "High",   rationale: "Mission-critical tax compliance; durable transaction-based model.", notes: "$93.50/share. 27% premium.", sources: [{ label: "8-K", url: "#" }] },
  { id: "t4",  sector: "Software & SaaS", target: "Citrix Systems", acquirer: "Vista / Evergreen",     date: "2022-01-31", dealValue: 16500e6, evRevenue: 5.3,  evEbitda: 14.8, growth: 4,  ebitdaMargin: 28, type: "Sponsor",       confidence: "High",   rationale: "Mature cash-generative software; merger with TIBCO unlocks scale.", notes: "Combined with TIBCO. Largest LBO of 2022.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t5",  sector: "Software & SaaS", target: "Zendesk",        acquirer: "H&F / Permira",         date: "2022-06-24", dealValue: 10200e6, evRevenue: 5.8,  evEbitda: 47.5, growth: 27, ebitdaMargin: 8,  type: "Take-Private",  confidence: "High",   rationale: "CX software at scale after activist pressure.", notes: "$77.50/share. Reverse process.", sources: [{ label: "Proxy", url: "#" }] },
  { id: "t6",  sector: "Software & SaaS", target: "Qualtrics",      acquirer: "Silver Lake / CPP",     date: "2023-03-13", dealValue: 12500e6, evRevenue: 8.0,  evEbitda: 36.4, growth: 25, ebitdaMargin: 9,  type: "Take-Private",  confidence: "High",   rationale: "Experience management spin from SAP; sponsor underwrites margin expansion.", notes: "$18.15/share.", sources: [{ label: "Proxy", url: "#" }] },
  { id: "t7",  sector: "Software & SaaS", target: "Splunk",         acquirer: "Cisco",                 date: "2023-09-21", dealValue: 28000e6, evRevenue: 7.0,  evEbitda: 26.2, growth: 16, ebitdaMargin: 22, type: "Strategic",     confidence: "High",   rationale: "Largest software M&A of 2023; observability + security cross-sell.", notes: "$157/share. 31% premium.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t8",  sector: "Software & SaaS", target: "Smartsheet",     acquirer: "Blackstone / Vista",    date: "2024-09-24", dealValue: 8400e6,  evRevenue: 7.6,  evEbitda: 32.8, growth: 19, ebitdaMargin: 13, type: "Take-Private",  confidence: "High",   rationale: "Collaborative work management; FCF inflection underwrites returns.", notes: "$56.50/share.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t9",  sector: "Software & SaaS", target: "Alteryx",        acquirer: "Clearlake / Insight",   date: "2023-12-18", dealValue: 4400e6,  evRevenue: 4.5,  evEbitda: 21.3, growth: 8,  ebitdaMargin: 14, type: "Take-Private",  confidence: "High",   rationale: "Analytics platform under pressure; sponsor consolidation play.", notes: "$48.25/share.", sources: [{ label: "Proxy", url: "#" }] },
  { id: "t10", sector: "Software & SaaS", target: "Darktrace",      acquirer: "Thoma Bravo",           date: "2024-04-26", dealValue: 5300e6,  evRevenue: 7.0,  evEbitda: 28.0, growth: 24, ebitdaMargin: 22, type: "Take-Private",  confidence: "High",   rationale: "AI-native security platform; LSE-listed take-private.", notes: "$7.75/share. UK take-private at material premium.", sources: [{ label: "Scheme Doc", url: "#" }] },

  // ── Healthcare ─────────────────────────────────────────────────────────────
  { id: "t11", sector: "Healthcare",      target: "Medline Industries",  acquirer: "Blackstone / Carlyle / HellFried", date: "2021-06-16", dealValue: 34000e6, evRevenue: 3.2,  evEbitda: 18.5, growth: 14, ebitdaMargin: 17, type: "Sponsor",      confidence: "High",   rationale: "Largest healthcare LBO in history; medical supply distribution at scale.", notes: "Consortium deal. Medline stays private.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t12", sector: "Healthcare",      target: "Athenahealth",        acquirer: "Hellman & Friedman / Bain", date: "2022-02-15", dealValue: 17000e6, evRevenue: 6.8,  evEbitda: 35.0, growth: 16, ebitdaMargin: 19, type: "Sponsor",      confidence: "High",   rationale: "Cloud-based EHR leader; GP buying back asset from previous consortium.", notes: "H&F and Bain acquired from Veritas / GIC.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t13", sector: "Healthcare",      target: "Inovalon",            acquirer: "Nordic Capital",           date: "2022-01-05", dealValue: 7300e6,  evRevenue: 8.5,  evEbitda: 42.0, growth: 22, ebitdaMargin: 20, type: "Take-Private",  confidence: "High",   rationale: "Healthcare data analytics platform; high recurring revenue from payer clients.", notes: "$41/share. 36% premium.", sources: [{ label: "Proxy", url: "#" }] },
  { id: "t14", sector: "Healthcare",      target: "Signify Health",      acquirer: "CVS Health",               date: "2022-09-02", dealValue: 8000e6,  evRevenue: 9.2,  evEbitda: 0,    growth: 35, ebitdaMargin: -5, type: "Strategic",    confidence: "High",   rationale: "Home health enablement platform; CVS expanding value-based care model.", notes: "$30.50/share. Won competitive auction.", sources: [{ label: "8-K", url: "#" }] },
  { id: "t15", sector: "Healthcare",      target: "Enovis",              acquirer: "Acuity Brands",            date: "2023-11-01", dealValue: 3900e6,  evRevenue: 3.5,  evEbitda: 19.2, growth: 10, ebitdaMargin: 18, type: "Strategic",    confidence: "Medium", rationale: "Orthopaedic devices consolidation; synergies in rehabilitation portfolio.", notes: "All-stock merger. Closed Q1 2024.", sources: [{ label: "Proxy", url: "#" }] },

  // ── Industrials ────────────────────────────────────────────────────────────
  { id: "t16", sector: "Industrials",     target: "Roper Technologies (Vertafore)", acquirer: "Roper / TPG",  date: "2022-08-23", dealValue: 2800e6,  evRevenue: 5.6,  evEbitda: 21.0, growth: 12, ebitdaMargin: 27, type: "Carve-Out",    confidence: "Medium", rationale: "Insurance software carve-out; TPG underwrites vertical SaaS transition.", notes: "Carve-out from Roper's asset rotation strategy.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t17", sector: "Industrials",     target: "Trimble",             acquirer: "AGCO (JV)",                date: "2023-01-09", dealValue: 2000e6,  evRevenue: 3.8,  evEbitda: 17.5, growth: 8,  ebitdaMargin: 22, type: "Strategic",    confidence: "Medium", rationale: "Precision agriculture JV; combines Trimble tech with AGCO machinery.", notes: "85/15 AGCO/Trimble joint venture structure.", sources: [{ label: "8-K", url: "#" }] },
  { id: "t18", sector: "Industrials",     target: "Arcline (Arcline)",   acquirer: "Arcline Investment",       date: "2023-07-12", dealValue: 1600e6,  evRevenue: 2.9,  evEbitda: 14.0, growth: 9,  ebitdaMargin: 20, type: "Sponsor",      confidence: "Medium", rationale: "Specialty industrial components; niche market leadership with pricing power.", notes: "Mid-market platform acquisition.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t19", sector: "Industrials",     target: "Ansys",               acquirer: "Synopsys",                 date: "2024-01-15", dealValue: 35000e6, evRevenue: 16.5, evEbitda: 38.2, growth: 13, ebitdaMargin: 38, type: "Strategic",    confidence: "High",   rationale: "Simulation + EDA convergence thesis; multi-physics design enablement.", notes: "Mixed cash and stock. Premium reflects scarcity value.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t20", sector: "Industrials",     target: "Altair Engineering",  acquirer: "Siemens",                  date: "2024-10-30", dealValue: 10600e6, evRevenue: 16.9, evEbitda: 56.3, growth: 9,  ebitdaMargin: 30, type: "Strategic",    confidence: "High",   rationale: "Industrial software consolidation; PLM + simulation strategy.", notes: "$113/share cash. Closes 2025.", sources: [{ label: "Press Release", url: "#" }] },

  // ── Consumer ───────────────────────────────────────────────────────────────
  { id: "t21", sector: "Consumer",        target: "Squarespace",         acquirer: "Permira",                  date: "2024-05-13", dealValue: 6900e6,  evRevenue: 6.3,  evEbitda: 23.5, growth: 17, ebitdaMargin: 18, type: "Take-Private",  confidence: "High",   rationale: "Self-serve subscription model with consistent FCF.", notes: "$46.50/share. Final deal price.", sources: [{ label: "Proxy", url: "#" }] },
  { id: "t22", sector: "Consumer",        target: "Dun & Bradstreet",    acquirer: "Black Knight / CC Capital", date: "2019-08-08", dealValue: 6900e6,  evRevenue: 4.5,  evEbitda: 18.7, growth: 5,  ebitdaMargin: 24, type: "Take-Private",  confidence: "High",   rationale: "B2B data and analytics platform; high switching costs.", notes: "Re-IPO'd 2020. Classic carve-and-relist.", sources: [{ label: "Proxy", url: "#" }] },
  { id: "t23", sector: "Consumer",        target: "Adevinta",            acquirer: "Permira / Blackstone",     date: "2023-06-08", dealValue: 14200e6, evRevenue: 7.4,  evEbitda: 27.0, growth: 12, ebitdaMargin: 27, type: "Take-Private",  confidence: "High",   rationale: "European digital classifieds; network effects and margin expansion thesis.", notes: "€24/share. Listed Oslo exchange.", sources: [{ label: "Scheme Doc", url: "#" }] },

  // ── Financial Services ─────────────────────────────────────────────────────
  { id: "t24", sector: "Financial Services", target: "Nuvei",            acquirer: "Advent International",     date: "2024-04-01", dealValue: 6300e6,  evRevenue: 4.7,  evEbitda: 16.4, growth: 22, ebitdaMargin: 28, type: "Take-Private",  confidence: "Medium", rationale: "Payments platform; sponsor consolidation thesis.", notes: "$34/share.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t25", sector: "Financial Services", target: "Black Knight",     acquirer: "ICE (Intercontinental Exchange)", date: "2023-09-05", dealValue: 13100e6, evRevenue: 8.1, evEbitda: 22.0, growth: 8, ebitdaMargin: 37, type: "Strategic", confidence: "High", rationale: "Mortgage tech consolidation; cross-sell into ICE's data and exchange platforms.", notes: "Regulatory review required divestitures.", sources: [{ label: "8-K", url: "#" }] },
  { id: "t26", sector: "Financial Services", target: "Bottomline Tech",  acquirer: "Thoma Bravo",              date: "2022-01-12", dealValue: 2600e6,  evRevenue: 5.2,  evEbitda: 28.0, growth: 9,  ebitdaMargin: 18, type: "Take-Private",  confidence: "High",   rationale: "B2B payments software; recurring revenue with bank and enterprise clients.", notes: "$57/share. 30% premium.", sources: [{ label: "Proxy", url: "#" }] },

  // ── Energy & Power ─────────────────────────────────────────────────────────
  { id: "t27", sector: "Energy & Power",  target: "Enverus",             acquirer: "Hellman & Friedman",       date: "2022-03-15", dealValue: 4500e6,  evRevenue: 8.2,  evEbitda: 32.0, growth: 18, ebitdaMargin: 26, type: "Sponsor",      confidence: "Medium", rationale: "Energy data and analytics; SaaS model serving E&P operators.", notes: "Secondary buyout from Genstar.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t28", sector: "Energy & Power",  target: "Wood Mackenzie",      acquirer: "Veritas Capital",          date: "2023-03-01", dealValue: 3100e6,  evRevenue: 6.0,  evEbitda: 25.0, growth: 10, ebitdaMargin: 42, type: "Carve-Out",    confidence: "Medium", rationale: "Energy research and analytics carved from Verisk; high margin data business.", notes: "Carve-out from Verisk Analytics.", sources: [{ label: "Press Release", url: "#" }] },

  // ── TMT ───────────────────────────────────────────────────────────────────
  { id: "t29", sector: "TMT",             target: "Univision",           acquirer: "ForgeLight / others",      date: "2021-12-31", dealValue: 4800e6,  evRevenue: 3.5,  evEbitda: 12.0, growth: 5,  ebitdaMargin: 29, type: "Sponsor",      confidence: "Medium", rationale: "Spanish-language media; streaming pivot with ViX platform.", notes: "Debt-heavy structure. Digital transformation thesis.", sources: [{ label: "Press Release", url: "#" }] },
  { id: "t30", sector: "TMT",             target: "Endeavor Group",      acquirer: "Silver Lake",              date: "2024-02-28", dealValue: 13000e6, evRevenue: 4.2,  evEbitda: 16.5, growth: 14, ebitdaMargin: 25, type: "Take-Private",  confidence: "High",   rationale: "Sports and entertainment conglomerate; live events scarcity value.", notes: "$27.50/share. Silver Lake takes WME/UFC parent private.", sources: [{ label: "Proxy", url: "#" }] },

  // ── Business Services ──────────────────────────────────────────────────────
  { id: "t31", sector: "Business Services", target: "Conduent",          acquirer: "Various (block sales)",    date: "2023-06-01", dealValue: 1800e6,  evRevenue: 0.8,  evEbitda: 7.5,  growth: -3, ebitdaMargin: 10, type: "Strategic",    confidence: "Low",    rationale: "BPO portfolio rationalization; segment divestitures ongoing.", notes: "Multiple asset sales. Government services focus retained.", sources: [{ label: "10-K", url: "#" }] },
  { id: "t32", sector: "Business Services", target: "Alight Solutions",  acquirer: "Stone Point Capital",     date: "2024-07-01", dealValue: 4800e6,  evRevenue: 2.8,  evEbitda: 13.5, growth: 6,  ebitdaMargin: 21, type: "Take-Private",  confidence: "High",   rationale: "Benefits administration outsourcing; sticky employer relationships.", notes: "$7.50/share. De-SPAC takeout.", sources: [{ label: "Proxy", url: "#" }] },
];
