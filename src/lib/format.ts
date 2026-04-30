export function formatDhs(n: number) {
  return `${n.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} DHS`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  periscolaire: "Périscolaire",
  laep: "LAEP",
  pmi: "PMI / Pesée",
  allaitement: "Allaitement",
  perinatal: "Périnatal",
  naissance: "Préparation naissance",
  soin: "Soins & Rituels",
  accouchement: "Accouchement",
  atelier: "Ateliers",
  cafe: "Café & Boissons",
  food: "Food Healthy",
};

export const CATEGORY_ORDER = [
  "cafe",
  "food",
  "periscolaire",
  "laep",
  "pmi",
  "allaitement",
  "perinatal",
  "naissance",
  "soin",
  "accouchement",
  "atelier",
];
