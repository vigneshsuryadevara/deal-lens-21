/**
 * Financials engine: DCF, LBO, and valuation methodology calculations.
 * All dollar values in absolute USD (not $M).
 */

export interface DcfInputs {
  revenue: number;        // $M
  ebitda: number;         // $M
  growth: number;         // %
  ebitdaMargin: number;   // %
  netDebt: number;        // $M
  wacc?: number;          // % default 10
  terminalGrowth?: number; // % default 2.5
  projectionYears?: number; // default 5
}

export interface DcfResult {
  enterpriseValue: number;
  equityValue: number;
  impliedMultiple: number;
  projectedFcf: number[];
  terminalValue: number;
  pvOfFcf: number;
  pvOfTerminal: number;
  assumptions: {
    wacc: number;
    terminalGrowth: number;
    years: number;
    exitCapex: number;
    exitTaxRate: number;
  };
}

export function runDcf(inputs: DcfInputs): DcfResult {
  const wacc = (inputs.wacc ?? 10) / 100;
  const tg = (inputs.terminalGrowth ?? 2.5) / 100;
  const years = inputs.projectionYears ?? 5;
  const taxRate = 0.25;
  const capexPct = 0.05; // 5% of revenue

  // Project revenue and FCF
  const revenues: number[] = [];
  const ebitdas: number[] = [];
  const fcfs: number[] = [];

  let rev = inputs.revenue;
  // Growth decays from current rate toward 8% terminal
  const growthDecay = (inputs.growth / 100 - 0.08) / years;

  for (let i = 1; i <= years; i++) {
    const g = Math.max(0.08, inputs.growth / 100 - growthDecay * i);
    rev = rev * (1 + g);
    const ebitda = rev * (inputs.ebitdaMargin / 100);
    const ebit = ebitda * 0.8; // rough D&A
    const nopat = ebit * (1 - taxRate);
    const capex = rev * capexPct;
    const da = ebitda * 0.2;
    const fcf = nopat + da - capex;

    revenues.push(rev);
    ebitdas.push(ebitda);
    fcfs.push(fcf);
  }

  // Terminal value (Gordon Growth Model)
  const terminalFcf = fcfs[fcfs.length - 1]! * (1 + tg);
  const terminalValue = terminalFcf / (wacc - tg);

  // PV calculations (all in $M)
  const pvFcf = fcfs.reduce((sum, fcf, i) => sum + fcf / Math.pow(1 + wacc, i + 1), 0);
  const pvTerminal = terminalValue / Math.pow(1 + wacc, years);

  const ev = (pvFcf + pvTerminal) * 1e6;
  const equity = ev - inputs.netDebt * 1e6;

  return {
    enterpriseValue: Math.round(ev),
    equityValue: Math.round(equity),
    impliedMultiple: inputs.ebitda > 0 ? ev / (inputs.ebitda * 1e6) : 0,
    projectedFcf: fcfs.map((f) => Math.round(f * 1e6)),
    terminalValue: Math.round(pvTerminal * 1e6),
    pvOfFcf: Math.round(pvFcf * 1e6),
    pvOfTerminal: Math.round(pvTerminal * 1e6),
    assumptions: {
      wacc: wacc * 100,
      terminalGrowth: tg * 100,
      years,
      exitCapex: capexPct * 100,
      exitTaxRate: taxRate * 100,
    },
  };
}

export interface LboInputs {
  revenue: number;        // $M
  ebitda: number;         // $M
  growth: number;         // %
  ebitdaMargin: number;   // %
  netDebt: number;        // $M
  targetIrr?: number;     // % default 20
  holdPeriod?: number;    // years default 5
  entryLeverage?: number; // x EBITDA default 6
  exitMultipleTurn?: number; // adjustment default 0
}

export interface LboResult {
  entryEv: number;
  equityContribution: number;
  exitEv: number;
  exitEquity: number;
  moic: number;
  impliedIrr: number;
  debtFinanced: number;
  assumptions: {
    entryMultiple: number;
    exitMultiple: number;
    leverage: number;
    irr: number;
    holdPeriod: number;
  };
}

export function runLbo(inputs: LboInputs): LboResult {
  const targetIrr = (inputs.targetIrr ?? 20) / 100;
  const holdPeriod = inputs.holdPeriod ?? 5;
  const leverage = inputs.entryLeverage ?? 6; // x EBITDA

  // Max entry EV based on target IRR using reverse solve
  // At 20% IRR over 5 years, entry equity = exit equity / (1+IRR)^hold
  // Exit EBITDA (projected)
  let exitEbitda = inputs.ebitda;
  for (let i = 0; i < holdPeriod; i++) {
    const g = Math.max(0.05, (inputs.growth / 100) * Math.pow(0.85, i));
    exitEbitda = exitEbitda * (1 + g);
  }

  const exitMultiple = Math.max(8, inputs.ebitda > 0 ? 
    (inputs.ebitda < 50 ? 10 : inputs.ebitda < 150 ? 12 : 14) : 10
  ) + (inputs.exitMultipleTurn ?? 0);

  const exitEv = exitEbitda * exitMultiple * 1e6;
  const entryDebt = inputs.ebitda * leverage * 1e6;

  // Debt paydown over hold period (rough amortization)
  const annualFcf = inputs.ebitda * 0.6 * 1e6; // 60% FCF conversion
  const debtPaydown = Math.min(annualFcf * holdPeriod * 0.7, entryDebt * 0.6);
  const exitDebt = Math.max(entryDebt - debtPaydown, entryDebt * 0.3);

  const exitEquity = Math.max(0, exitEv - exitDebt);

  // Solve for entry equity at target IRR
  const entryEquity = exitEquity / Math.pow(1 + targetIrr, holdPeriod);
  const entryEv = entryEquity + entryDebt;

  const moic = entryEquity > 0 ? exitEquity / entryEquity : 0;
  const impliedIrr = entryEquity > 0 ? Math.pow(moic, 1 / holdPeriod) - 1 : 0;

  const entryMultiple = inputs.ebitda > 0 ? entryEv / (inputs.ebitda * 1e6) : 0;

  return {
    entryEv: Math.round(entryEv),
    equityContribution: Math.round(entryEquity),
    exitEv: Math.round(exitEv),
    exitEquity: Math.round(exitEquity),
    moic: Math.round(moic * 10) / 10,
    impliedIrr: Math.round(impliedIrr * 1000) / 10,
    debtFinanced: Math.round(entryDebt),
    assumptions: {
      entryMultiple: Math.round(entryMultiple * 10) / 10,
      exitMultiple,
      leverage,
      irr: targetIrr * 100,
      holdPeriod,
    },
  };
}

export interface FootballFieldMethod {
  label: string;
  low: number;
  high: number;
  base: number;
  methodology: string;
}

export function buildFootballField(
  revenue: number,
  ebitda: number,
  netDebt: number,
  stats: { medianEvEbitda: number; medianEvRevenue: number; p25EvEbitda: number; p75EvEbitda: number; p25EvRevenue: number; p75EvRevenue: number },
  dcf?: DcfResult,
  lbo?: LboResult,
): FootballFieldMethod[] {
  const rev = revenue * 1e6;
  const eb = ebitda * 1e6;

  const methods: FootballFieldMethod[] = [
    {
      label: "Precedent Transactions (EV/EBITDA)",
      low: stats.p25EvEbitda * eb,
      high: stats.p75EvEbitda * eb,
      base: stats.medianEvEbitda * eb,
      methodology: "Median EV/EBITDA applied to LTM EBITDA from selected precedent transactions",
    },
    {
      label: "Precedent Transactions (EV/Revenue)",
      low: stats.p25EvRevenue * rev,
      high: stats.p75EvRevenue * rev,
      base: stats.medianEvRevenue * rev,
      methodology: "Median EV/Revenue applied to LTM Revenue; typically secondary reference",
    },
    {
      label: "Trading Comparables",
      low: stats.p25EvEbitda * 0.85 * eb,
      high: stats.p75EvEbitda * 0.85 * eb,
      base: stats.medianEvEbitda * 0.85 * eb,
      methodology: "Public market comps at 15% discount to M&A multiples reflecting illiquidity and control premium",
    },
    {
      label: "Discounted Cash Flow",
      low: dcf ? dcf.enterpriseValue * 0.85 : stats.medianEvEbitda * 0.9 * eb,
      high: dcf ? dcf.enterpriseValue * 1.15 : stats.medianEvEbitda * 1.2 * eb,
      base: dcf ? dcf.enterpriseValue : stats.medianEvEbitda * 1.05 * eb,
      methodology: "5-year DCF at 10% WACC, 2.5% terminal growth; sensitivity ±15% on exit assumptions",
    },
    {
      label: "LBO (Sponsor — 20% IRR)",
      low: lbo ? lbo.entryEv * 0.90 : stats.medianEvEbitda * 0.72 * eb,
      high: lbo ? lbo.entryEv * 1.08 : stats.medianEvEbitda * 0.95 * eb,
      base: lbo ? lbo.entryEv : stats.medianEvEbitda * 0.83 * eb,
      methodology: "Maximum entry EV for financial sponsor at 20% IRR threshold, 5-year hold, 6x leverage",
    },
    {
      label: "52-Week Trading Range",
      low: stats.p25EvEbitda * 0.78 * eb,
      high: stats.p75EvEbitda * 0.95 * eb,
      base: stats.medianEvEbitda * 0.88 * eb,
      methodology: "Historical trading range provides reference point; adjusted for market conditions",
    },
  ];

  return methods;
}
