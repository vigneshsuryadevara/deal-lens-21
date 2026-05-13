export type BuyerType = "Strategic" | "Sponsor";
export type Buyer = {
  id: string;
  name: string;
  type: BuyerType;
  initials: string;
  sectorFit: number; // 0-100
  appetite: number; // 0-100
  pastDeals: { target: string; year: number; size: number }[];
  rationale: string;
  aum?: string;
  hq: string;
};

export const BUYERS: Buyer[] = [
  { id: "b1", name: "Thoma Bravo", type: "Sponsor", initials: "TB", sectorFit: 96, appetite: 92, hq: "Chicago", aum: "$160B AUM", rationale: "Most active enterprise software sponsor; proven thesis around recurring revenue and margin expansion.", pastDeals: [{ target: "Anaplan", year: 2022, size: 10700e6 }, { target: "Coupa", year: 2022, size: 8000e6 }, { target: "Darktrace", year: 2024, size: 5300e6 }] },
  { id: "b2", name: "Vista Equity Partners", type: "Sponsor", initials: "VE", sectorFit: 94, appetite: 88, hq: "Austin", aum: "$100B AUM", rationale: "Vertical and horizontal software specialist; deep operating playbook.", pastDeals: [{ target: "Avalara", year: 2022, size: 8400e6 }, { target: "KnowBe4", year: 2023, size: 4600e6 }, { target: "Model N", year: 2024, size: 1250e6 }] },
  { id: "b3", name: "Silver Lake", type: "Sponsor", initials: "SL", sectorFit: 88, appetite: 76, hq: "Menlo Park", aum: "$102B AUM", rationale: "Tech-focused mega-fund; comfortable with large-cap take-privates.", pastDeals: [{ target: "Qualtrics", year: 2023, size: 12500e6 }, { target: "Software AG", year: 2023, size: 2500e6 }] },
  { id: "b4", name: "Hellman & Friedman", type: "Sponsor", initials: "HF", sectorFit: 82, appetite: 71, hq: "San Francisco", aum: "$120B AUM", rationale: "Focused, concentrated portfolio; software exposure increasing.", pastDeals: [{ target: "Zendesk", year: 2022, size: 10200e6 }] },
  { id: "b5", name: "Permira", type: "Sponsor", initials: "PM", sectorFit: 84, appetite: 78, hq: "London", aum: "$80B AUM", rationale: "Transatlantic software specialist; recent Squarespace acquisition signals appetite.", pastDeals: [{ target: "Squarespace", year: 2024, size: 6900e6 }, { target: "Zendesk", year: 2022, size: 10200e6 }] },
  { id: "b6", name: "Blackstone", type: "Sponsor", initials: "BX", sectorFit: 78, appetite: 84, hq: "New York", aum: "$1.1T AUM", rationale: "Largest sponsor globally; selective in software but capable of mega-deals.", pastDeals: [{ target: "Cvent", year: 2023, size: 4600e6 }, { target: "Smartsheet", year: 2024, size: 8400e6 }] },
  { id: "b7", name: "KKR", type: "Sponsor", initials: "KK", sectorFit: 80, appetite: 81, hq: "New York", aum: "$600B AUM", rationale: "Tech & Services group active in vertical software.", pastDeals: [{ target: "Instructure", year: 2024, size: 4800e6 }] },
  { id: "b8", name: "Bain Capital", type: "Sponsor", initials: "BC", sectorFit: 79, appetite: 74, hq: "Boston", aum: "$185B AUM", rationale: "Sector specialist team; consistent deployment across vertical SaaS.", pastDeals: [{ target: "PowerSchool", year: 2024, size: 5600e6 }] },
  { id: "b9", name: "Advent International", type: "Sponsor", initials: "AD", sectorFit: 72, appetite: 68, hq: "Boston", aum: "$95B AUM", rationale: "Selective in software; Nuvei demonstrates payments appetite.", pastDeals: [{ target: "Nuvei", year: 2024, size: 6300e6 }] },
  { id: "b10", name: "Clearlake Capital", type: "Sponsor", initials: "CL", sectorFit: 86, appetite: 79, hq: "Santa Monica", aum: "$85B AUM", rationale: "Operationally focused; comfortable with complex carve-outs.", pastDeals: [{ target: "Alteryx", year: 2023, size: 4400e6 }] },
  { id: "b11", name: "Francisco Partners", type: "Sponsor", initials: "FP", sectorFit: 90, appetite: 83, hq: "San Francisco", aum: "$45B AUM", rationale: "Pure-play technology investor; strong middle and upper-middle market track record.", pastDeals: [{ target: "New Relic", year: 2023, size: 6500e6 }] },
  { id: "b12", name: "TPG Capital", type: "Sponsor", initials: "TP", sectorFit: 76, appetite: 72, hq: "Fort Worth", aum: "$220B AUM", rationale: "Tech, Media & Telecom group; co-invest model with Francisco on New Relic.", pastDeals: [{ target: "New Relic", year: 2023, size: 6500e6 }] },
  { id: "b13", name: "Microsoft", type: "Strategic", initials: "MS", sectorFit: 92, appetite: 65, hq: "Redmond", rationale: "Active across productivity, AI, and security; selective on size post-Activision.", pastDeals: [{ target: "Activision", year: 2023, size: 68700e6 }, { target: "Nuance", year: 2022, size: 19700e6 }] },
  { id: "b14", name: "Salesforce", type: "Strategic", initials: "SF", sectorFit: 88, appetite: 55, hq: "San Francisco", rationale: "M&A discipline tightened post-Slack; bolt-ons preferred.", pastDeals: [{ target: "Slack", year: 2021, size: 27700e6 }, { target: "Tableau", year: 2019, size: 15700e6 }] },
  { id: "b15", name: "Oracle", type: "Strategic", initials: "OR", sectorFit: 84, appetite: 70, hq: "Austin", rationale: "Vertical software roll-up via Cerner; healthcare and ERP focus.", pastDeals: [{ target: "Cerner", year: 2022, size: 28300e6 }] },
  { id: "b16", name: "Cisco Systems", type: "Strategic", initials: "CS", sectorFit: 80, appetite: 73, hq: "San Jose", rationale: "Splunk closed; remains active in security and observability.", pastDeals: [{ target: "Splunk", year: 2024, size: 28000e6 }] },
  { id: "b17", name: "Adobe", type: "Strategic", initials: "AD", sectorFit: 78, appetite: 48, hq: "San Jose", rationale: "Figma terminated; selective in creative and digital experience.", pastDeals: [{ target: "Workfront", year: 2020, size: 1500e6 }] },
  { id: "b18", name: "ServiceNow", type: "Strategic", initials: "SN", sectorFit: 82, appetite: 62, hq: "Santa Clara", rationale: "Tuck-in acquirer expanding workflow platform.", pastDeals: [{ target: "Element AI", year: 2020, size: 230e6 }] },
  { id: "b19", name: "Siemens", type: "Strategic", initials: "SI", sectorFit: 70, appetite: 75, hq: "Munich", rationale: "Industrial software consolidation; Altair signals continued appetite.", pastDeals: [{ target: "Altair Engineering", year: 2024, size: 10600e6 }] },
  { id: "b20", name: "Synopsys", type: "Strategic", initials: "SY", sectorFit: 66, appetite: 60, hq: "Sunnyvale", rationale: "EDA + simulation convergence; mid-digestion of Ansys.", pastDeals: [{ target: "Ansys", year: 2024, size: 35000e6 }] },
];
