import Constants from "expo-constants";

const baseUrl: string =
  (Constants.expoConfig?.extra?.apiUrl as string) ??
  process.env.EXPO_PUBLIC_API_URL ??
  "http://localhost:4200/";

const API = baseUrl.replace(/\/$/, "") + "/api";

export type Case = {
  id: number;
  nama: string;
  kes: string;
  totalFee: number;
  bayaranTerakhir: number;
  tarikh: string;
  bakiSebelum: number;
  bakiFeeTerkini: number;
  bakiMileage: number;
  createdAt: string;
};

export type Payment = {
  id: number;
  caseId: number;
  date: string;
  amount: number;
  method: string;
  createdAt: string;
};

export type Stats = {
  totalKes: number;
  totalFee: number;
  totalBakiTerkini: number;
  totalMileage: number;
};

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function del(path: string): Promise<void> {
  await fetch(`${API}${path}`, { method: "DELETE" });
}

export const apiClient = {
  getStats: () => get<Stats>("/stats"),
  getCases: () => get<{ cases: Case[] }>("/cases").then((d) => d.cases),
  getChart: () => get<{ chart: { name: string; baki: number }[] }>("/chart").then((d) => d.chart),
  createCase: (data: Omit<Case, "id" | "createdAt">) => post<{ case: Case }>("/cases", data).then((d) => d.case),
  updateCase: (id: number, data: Partial<Case>) => put<{ case: Case }>(`/cases/${id}`, data).then((d) => d.case),
  deleteCase: (id: number) => del(`/cases/${id}`),
  bulkDelete: (ids: number[]) => post("/cases/bulk-delete", { ids }),
  getPayments: (caseId: number) =>
    get<{ payments: Payment[] }>(`/cases/${caseId}/payments`).then((d) => d.payments),
  addPayment: (caseId: number, data: { amount: number; date: string; method: string }) =>
    post<{ payment: Payment; case: Case }>(`/cases/${caseId}/payments`, data),
  deletePayment: (paymentId: number) => del(`/payments/${paymentId}`),
  seed: () => post("/seed", {}),
};

export const formatRM = (n: number) =>
  new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
    minimumFractionDigits: 2,
  }).format(n);
