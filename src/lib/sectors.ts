const sectorByTicker: Record<string, string> = {
  AAPL: "AI compute & software",
  AMD: "Semiconductors & hardware",
  AMAT: "Semiconductors & hardware",
  AMZN: "AI compute & software",
  APLD: "Bitcoin / HPC power",
  ASML: "Semiconductors & hardware",
  AVGO: "Semiconductors & hardware",
  BE: "Energy & power",
  BITF: "Bitcoin / HPC power",
  BTDR: "Bitcoin / HPC power",
  BW: "Energy & power",
  CEG: "Energy & power",
  CIFR: "Bitcoin / HPC power",
  CLSK: "Bitcoin / HPC power",
  COHR: "Optical & datacenter infra",
  CORZ: "Bitcoin / HPC power",
  CRWV: "AI compute & software",
  DELL: "Semiconductors & hardware",
  EQT: "Energy & power",
  GLW: "Optical & datacenter infra",
  GOOG: "AI compute & software",
  GOOGL: "AI compute & software",
  HIVE: "Bitcoin / HPC power",
  HUT: "Bitcoin / HPC power",
  INTC: "Semiconductors & hardware",
  IREN: "Bitcoin / HPC power",
  KRC: "Real estate",
  LBRT: "Energy & power",
  LITE: "Optical & datacenter infra",
  META: "AI compute & software",
  MOD: "Other",
  MRVL: "Semiconductors & hardware",
  MSFT: "AI compute & software",
  MU: "Semiconductors & hardware",
  NVDA: "Semiconductors & hardware",
  ONTO: "Semiconductors & hardware",
  ORCL: "AI compute & software",
  PSIX: "Energy & power",
  PUMP: "Energy & power",
  RIOT: "Bitcoin / HPC power",
  SEI: "Energy & power",
  SHAZ: "AI compute & software",
  SMH: "Semiconductors & hardware",
  SNDK: "Semiconductors & hardware",
  TE: "Energy & power",
  TLN: "Energy & power",
  TSEM: "Semiconductors & hardware",
  TSM: "Semiconductors & hardware",
  VRT: "Optical & datacenter infra",
  VST: "Energy & power",
  WYFI: "AI compute & software"
};

export const tickerByCusip: Record<string, string> = {
  "007903107": "AMD",
  "038169207": "APLD",
  "05614L209": "BW",
  "09173B107": "BITF",
  "093712107": "BE",
  "11135F101": "AVGO",
  "18452B209": "CLSK",
  "21873S108": "CRWV",
  "21874A106": "CORZ",
  "219350105": "GLW",
  "433921103": "HIVE",
  "456788108": "INFY",
  "458140100": "INTC",
  "595112103": "MU",
  "67066G104": "NVDA",
  "68389X105": "ORCL",
  "73933G202": "PSIX",
  "74347M108": "PUMP",
  "767292105": "RIOT",
  "778920306": "SHAZ",
  "80004C200": "SNDK",
  "83418M103": "SEI",
  "874039100": "TSM",
  "92189F676": "SMH",
  "G11448100": "BTDR",
  "G96115103": "WYFI",
  "N07059210": "ASML",
  "Q4982L109": "IREN"
};

export const sectorColors: Record<string, string> = {
  "Bitcoin / HPC power": "#74d68a",
  "Semiconductors & hardware": "#f0c94d",
  "AI compute & software": "#cf6db0",
  "Energy & power": "#ef9350",
  "Optical & datacenter infra": "#7bb7ff",
  "Real estate": "#b98b74",
  Other: "#8b929c"
};

export function sectorFor(ticker?: string, issuer = "") {
  if (ticker && sectorByTicker[ticker.toUpperCase()]) {
    return sectorByTicker[ticker.toUpperCase()];
  }

  const name = issuer.toUpperCase();
  if (/(SEMICONDUCTOR|NVIDIA|BROADCOM|MICRON|INTEL|ASML|VANECK ETF)/.test(name)) {
    return "Semiconductors & hardware";
  }
  if (/(COREWEAVE|ORACLE|WHITEFIBER|SHARONAI|MICROSOFT|ALPHABET|AMAZON)/.test(name)) {
    return "AI compute & software";
  }
  if (/(ENERGY|POWER|VISTRA|BLOOM|TALEN|CONSTELLATION|PROPETRO|BABCOCK)/.test(name)) {
    return "Energy & power";
  }
  if (/(LUMENTUM|CORNING|COHERENT|VERTIV)/.test(name)) {
    return "Optical & datacenter infra";
  }
  if (/(BIT|RIOT|HIVE|IREN|CLEANSPARK|CORE SCIENTIFIC|APPLIED DIGITAL)/.test(name)) {
    return "Bitcoin / HPC power";
  }
  return "Other";
}
