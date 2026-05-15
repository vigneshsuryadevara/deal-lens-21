export interface AnalysisInputs {
  company: string;
  sector: string;
  geography: string;
  revenue: number;       // $M
  ebitda: number;        // $M
  growth: number;        // %
  ebitdaMargin: number;  // %
  netDebt: number;       // $M — negative = net cash
  dealType: string;
  context: string;
}

export interface LiveStats {
  medianEvEbitda: number;
  medianEvRevenue: number;
  p25EvEbitda: number;
  p75EvEbitda: number;
  p25EvRevenue: number;
  p75EvRevenue: number;
}

export interface LiveValuationMethod {
  label: string;
  low: number;
  high: number;
  base: number;
}

export interface LiveMarketObservation {
  label: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
}

export interface LiveAssumption {
  id: string;
  category: string;
  label: string;
  value: number;
  unit: string;
  note: string;
}

export interface LiveBridgeRow {
  label: string;
  value: number;
}

export interface LiveAnalysisResult {
  company: string;
  sector: string;
  geography: string;
  asOf: string;
  stats: LiveStats;
  valuationMethods: LiveValuationMethod[];
  commentary: string[];
  marketObservations: LiveMarketObservation[];
  relevantCompIds: string[];
  topBuyerIds: string[];
  assumptions: LiveAssumption[];
  bridge: LiveBridgeRow[];
  analystNote: string;
  dataNote: string;
}
