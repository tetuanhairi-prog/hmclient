import React, { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Search, Users, FileText, CreditCard, Wallet, MapPin, Filter,
  X, TrendingUp, Trash2, Upload, Plus, BarChart2, AlertCircle,
  CheckCircle, Clock, Edit, History, DollarSign, Receipt, Printer, Download,
} from "lucide-react";
import jsPDF from "jspdf";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const API = "/api";

type Case = {
  id: number; nama: string; kes: string; totalFee: number;
  bayaranTerakhir: number; tarikh: string; bakiSebelum: number;
  bakiFeeTerkini: number; bakiMileage: number; createdAt: string;
};
type Payment = {
  id: number; caseId: number; date: string; amount: number;
  method: string; createdAt: string;
};
type ReceiptItem = { perkara: string; harga: number };
type Receipt = {
  id: number; tarikh: string; tarikhDisplay: string; kategori: string;
  nama: string; alamat: string; items: string; jumlah: number;
  bakiTerdahulu: number; bakiTerkini: number; butiran: string; createdAt: string;
};

const formatRM = (n: number) =>
  new Intl.NumberFormat("en-MY", { style: "currency", currency: "MYR", minimumFractionDigits: 2 }).format(n);

const PIE_COLORS = ["#2563eb", "#059669", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#c2410c", "#0f766e"];

export default function Index() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"dashboard" | "records" | "reports" | "resit">("dashboard");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterKes, setFilterKes] = useState("Semua");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [paymentCase, setPaymentCase] = useState<Case | null>(null);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [deletingCase, setDeletingCase] = useState<Case | null>(null);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [isNewOpen, setIsNewOpen] = useState(false);
  const seededRef = useRef(false);
  const [paymentHistoryCase, setPaymentHistoryCase] = useState<Case | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const casesQ = useQuery<Case[]>({
    queryKey: ["cases"],
    queryFn: async () => {
      const r = await fetch(`${API}/cases`);
      const d = await r.json();
      return d.cases;
    },
  });

  const statsQ = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const r = await fetch(`${API}/stats`);
      return r.json();
    },
  });

  const chartQ = useQuery({
    queryKey: ["chart"],
    queryFn: async () => {
      const r = await fetch(`${API}/chart`);
      const d = await r.json();
      return d.chart as { name: string; baki: number }[];
    },
  });

  useEffect(() => {
    // Only seed once on first load — never re-seed after user deletes records
    if (casesQ.isFetched && casesQ.data && casesQ.data.length === 0 && !seededRef.current) {
      seededRef.current = true;
      fetch(`${API}/seed`, { method: "POST" }).then(() => {
        qc.invalidateQueries({ queryKey: ["cases"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
        qc.invalidateQueries({ queryKey: ["chart"] });
      });
    }
    if (casesQ.isFetched && casesQ.data && casesQ.data.length > 0) {
      seededRef.current = true; // data exists, mark seed as done
    }
  }, [casesQ.isFetched, casesQ.data]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["cases"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["chart"] });
  };

  const createCase = useMutation({
    mutationFn: async (data: any) => {
      const r = await fetch(`${API}/cases`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: refreshAll,
  });

  const updateCase = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const r = await fetch(`${API}/cases/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: refreshAll,
  });

  const deleteCase = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API}/cases/${id}`, { method: "DELETE" });
    },
    onSuccess: refreshAll,
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: number[]) => {
      await fetch(`${API}/cases/bulk-delete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    },
    onSuccess: () => { refreshAll(); setSelectedIds([]); },
  });

  const addPayment = useMutation({
    mutationFn: async ({ caseId, ...data }: any) => {
      const r = await fetch(`${API}/cases/${caseId}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: refreshAll,
  });

  const cases = casesQ.data || [];
  const uniqueKes = useMemo(() => ["Semua", ...Array.from(new Set(cases.map((c) => c.kes)))], [cases]);

  const filtered = useMemo(
    () =>
      cases.filter((c) => {
        const matchSearch = c.nama.toLowerCase().includes(searchTerm.toLowerCase());
        const matchKes = filterKes === "Semua" || c.kes.toLowerCase() === filterKes.toLowerCase();
        return matchSearch && matchKes;
      }),
    [cases, searchTerm, filterKes]
  );

  const stats = statsQ.data || { totalKes: 0, totalFee: 0, totalBakiTerkini: 0, totalMileage: 0 };
  const chartData = (chartQ.data || []).filter((x) => x.baki > 0);

  const handleExport = () => {
    const headers = ["ID", "Nama", "Kes", "Total Fee", "Bayaran Terakhir", "Tarikh", "Baki Sebelum", "Baki Terkini", "Baki Mileage"];
    const csv = [
      headers.join(","),
      ...filtered.map((r) =>
        [r.id, `"${r.nama}"`, `"${r.kes}"`, r.totalFee, r.bayaranTerakhir, r.tarikh, r.bakiSebelum, r.bakiFeeTerkini, r.bakiMileage].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Rekod_Pelanggan_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = String(ev.target?.result || "");
      const lines = text.split("\n");
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const vals = line.split(/(?!\B"[^"]*),(?![^"]*"\B)/).map((v) => v.replace(/^"|"$/g, "").trim());
        if (vals.length < 4) continue;
        const totalFee = parseFloat(vals[3]) || 0;
        createCase.mutate({
          nama: vals[1] || "Tanpa Nama",
          kes: vals[2] || "Umum",
          totalFee,
          tarikh: vals[8] || new Date().toLocaleDateString("ms-MY"),
          bakiSebelum: parseFloat(vals[4]) || totalFee,
          bakiFeeTerkini: parseFloat(vals[6]) || totalFee,
          bakiMileage: parseFloat(vals[7]) || 0,
        });
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const NAV = [
    { id: "dashboard", label: "Papan Pemuka", icon: <BarChart2 size={15} /> },
    { id: "records",   label: "Rekod Pelanggan", icon: <FileText size={15} /> },
    { id: "reports",   label: "Laporan", icon: <TrendingUp size={15} /> },
    { id: "resit",     label: "Sistem Resit", icon: <Receipt size={15} /> },
  ] as const;

  return (
    <div className="bg-zinc-50 text-zinc-900 font-sans min-h-screen w-full flex flex-col md:flex-row overflow-hidden">
      {/* ── Sidebar ── */}
      <aside className="w-full md:w-56 bg-zinc-900 text-zinc-400 flex md:flex-col border-r border-zinc-800 shrink-0">
        <div className="hidden md:block p-6 border-b border-zinc-800">
          <div className="text-white font-bold tracking-tight text-lg">
            HM Client<span className="text-blue-500"> Lawyer</span>
          </div>
          <div className="text-[10px] uppercase tracking-widest opacity-50 mt-0.5">Sistem Pengurusan</div>
        </div>
        <nav className="flex md:flex-col gap-1 p-3 md:p-4 w-full">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setActiveTab(n.id)}
              className={`px-3 py-2.5 rounded text-sm flex items-center gap-2.5 transition-colors w-full text-left ${
                activeTab === n.id
                  ? "bg-blue-600 text-white"
                  : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {n.icon}
              <span className="truncate">{n.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* ── Top bar ── */}
        <header className="min-h-14 bg-white border-b border-zinc-200 flex flex-wrap items-center justify-between gap-2 px-4 md:px-6 py-3 shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-zinc-700">
              {activeTab === "dashboard" ? "Papan Pemuka" : activeTab === "records" ? "Rekod Pelanggan" : activeTab === "reports" ? "Laporan Kewangan" : "Sistem Resit"}
            </h1>
            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded uppercase border border-blue-100">Live</span>
          </div>
          {activeTab === "records" && (
            <div className="flex flex-wrap gap-2">
              <button onClick={handleExport} className="px-3 py-1.5 text-xs border border-zinc-300 rounded hover:bg-zinc-50 transition-colors flex items-center gap-1">
                <Upload size={13} className="rotate-180" />Eksport CSV
              </button>
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImport} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-xs border border-zinc-300 rounded flex items-center gap-1 hover:bg-zinc-50 transition-colors">
                <Upload size={13} />Import CSV
              </button>
              <button onClick={() => setIsNewOpen(true)} className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded flex items-center gap-1 hover:bg-blue-700 transition-colors">
                <Plus size={13} />Rekod Baru
              </button>
            </div>
          )}
        </header>

        {/* ── Tab content ── */}
        <div className="flex-1 overflow-auto">
          {activeTab === "dashboard" && (
            <DashboardTab stats={stats} chartData={chartData} cases={cases} isLoading={casesQ.isLoading} />
          )}
          {activeTab === "records" && (
            <RecordsTab
              cases={cases}
              filtered={filtered}
              uniqueKes={uniqueKes}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filterKes={filterKes}
              setFilterKes={setFilterKes}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              isLoading={casesQ.isLoading}
              onNew={() => setIsNewOpen(true)}
              onPay={setPaymentCase}
              onHistory={setPaymentHistoryCase}
              onEdit={setEditingCase}
              onDelete={setDeletingCase}
              onBulkDelete={() => setIsDeletingSelected(true)}
            />
          )}
          {activeTab === "reports" && (
            <ReportsTab cases={cases} stats={stats} chartData={chartData} isLoading={casesQ.isLoading} />
          )}
          {activeTab === "resit" && <ResitTab />}
        </div>
      </main>

      {/* ── Modals ── */}
      {isNewOpen && <NewRecordModal onClose={() => setIsNewOpen(false)} onCreate={(data) => { createCase.mutate(data); setIsNewOpen(false); }} />}
      {paymentCase && <PaymentModal caseData={paymentCase} onClose={() => setPaymentCase(null)} onPay={(data) => { addPayment.mutate(data); setPaymentCase(null); }} />}
      {editingCase && <EditModal caseData={editingCase} onClose={() => setEditingCase(null)} onSave={(data) => { updateCase.mutate(data); setEditingCase(null); }} />}
      {deletingCase && (
        <ConfirmModal
          title={`Padam rekod ${deletingCase.nama}?`}
          desc="Tindakan ini tidak boleh dibatalkan."
          onClose={() => setDeletingCase(null)}
          onConfirm={() => { deleteCase.mutate(deletingCase.id); setDeletingCase(null); }}
        />
      )}
      {isDeletingSelected && (
        <ConfirmModal
          title={`Padam ${selectedIds.length} rekod terpilih?`}
          desc="Semua rekod yang dipilih akan dipadamkan."
          onClose={() => setIsDeletingSelected(false)}
          onConfirm={() => { bulkDelete.mutate(selectedIds); setIsDeletingSelected(false); }}
        />
      )}
      {paymentHistoryCase && <PaymentHistoryModal caseData={paymentHistoryCase} onClose={() => setPaymentHistoryCase(null)} />}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   PAPAN PEMUKA — overview, stats, chart, top records
══════════════════════════════════════════════════ */
function DashboardTab({ stats, chartData, cases, isLoading }: {
  stats: any; chartData: { name: string; baki: number }[]; cases: Case[]; isLoading: boolean;
}) {
  const totalDibayar = cases.reduce((s, c) => s + (c.totalFee - c.bakiFeeTerkini), 0);
  const pctKutip = stats.totalFee > 0 ? ((totalDibayar / stats.totalFee) * 100).toFixed(1) : "0.0";
  const kesSelesai = cases.filter((c) => c.bakiFeeTerkini === 0).length;
  const kesBelumSelesai = cases.filter((c) => c.bakiFeeTerkini > 0).length;

  // Top 5 baki tertinggi
  const top5 = [...cases].sort((a, b) => b.bakiFeeTerkini - a.bakiFeeTerkini).slice(0, 5);

  // Recent 5 by createdAt
  const recent5 = [...cases]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Jumlah Kes Aktif" value={String(stats.totalKes)} icon={<Users size={16} />} color="blue" />
        <StatCard label="Jumlah Total Fee" value={formatRM(stats.totalFee)} icon={<Wallet size={16} />} color="indigo" />
        <StatCard label="Baki Belum Kutip" value={formatRM(stats.totalBakiTerkini)} icon={<AlertCircle size={16} />} color="red" />
        <StatCard label="Sudah Dibayar" value={formatRM(totalDibayar)} icon={<CheckCircle size={16} />} color="green" />
      </div>

      {/* Progress + Mileage */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-zinc-700">Peratusan Kutipan Fee</span>
            <span className="text-xl font-bold text-blue-600">{pctKutip}%</span>
          </div>
          <div className="w-full bg-zinc-100 rounded-full h-3 mb-4">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all"
              style={{ width: `${Math.min(100, parseFloat(pctKutip))}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-emerald-50 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Kes Selesai</div>
              <div className="text-xl font-bold text-emerald-600">{kesSelesai}</div>
            </div>
            <div className="bg-red-50 rounded-lg p-3">
              <div className="text-xs text-zinc-500 mb-1">Belum Selesai</div>
              <div className="text-xl font-bold text-red-600">{kesBelumSelesai}</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-zinc-700">Baki Mileage</span>
            <span className="text-xl font-bold text-amber-600">{formatRM(stats.totalMileage)}</span>
          </div>
          <div className="space-y-2 mt-4">
            {cases.filter((c) => c.bakiMileage > 0).slice(0, 4).map((c) => (
              <div key={c.id} className="flex justify-between items-center text-sm">
                <div>
                  <span className="font-medium text-zinc-800">{c.nama}</span>
                  <span className="text-zinc-400 text-xs ml-2">{c.kes}</span>
                </div>
                <span className="font-mono font-semibold text-amber-600">{formatRM(c.bakiMileage)}</span>
              </div>
            ))}
            {cases.filter((c) => c.bakiMileage > 0).length === 0 && (
              <p className="text-zinc-400 text-sm">Tiada baki mileage</p>
            )}
          </div>
        </div>
      </div>

      {/* Chart + Top 5 */}
      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className="text-blue-600" />
            <span className="text-sm font-semibold text-zinc-700">Baki Fee Tertunggak ikut Kategori Kes</span>
          </div>
          {isLoading ? (
            <div className="h-52 flex items-center justify-center text-zinc-400 text-sm">Memuatkan...</div>
          ) : chartData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-zinc-400 text-sm">Tiada data</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `RM${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => [formatRM(v), "Baki"]} />
                  <Bar dataKey="baki" fill="#2563eb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={15} className="text-red-500" />
            <span className="text-sm font-semibold text-zinc-700">Top 5 Baki Tertinggi</span>
          </div>
          <div className="space-y-3">
            {top5.map((c, i) => (
              <div key={c.id} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-zinc-100 text-zinc-500 text-xs font-bold flex items-center justify-center shrink-0">
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-zinc-800 truncate">{c.nama}</div>
                  <div className="text-[11px] text-zinc-400">{c.kes}</div>
                </div>
                <span className="text-sm font-bold text-red-600 shrink-0">{formatRM(c.bakiFeeTerkini)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent cases */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100 flex items-center gap-2">
          <Clock size={14} className="text-zinc-500" />
          <span className="text-sm font-semibold text-zinc-700">Rekod Terbaru Ditambah</span>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-zinc-50">
            <tr className="text-[11px] text-zinc-500 uppercase">
              <th className="px-5 py-2.5 text-left">Nama</th>
              <th className="px-5 py-2.5 text-left">Kes</th>
              <th className="px-5 py-2.5 text-right">Total Fee</th>
              <th className="px-5 py-2.5 text-right">Baki Terkini</th>
              <th className="px-5 py-2.5 text-center">Tarikh</th>
            </tr>
          </thead>
          <tbody>
            {recent5.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                <td className="px-5 py-2.5 font-medium text-zinc-800">{r.nama}</td>
                <td className="px-5 py-2.5">
                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100">{r.kes}</span>
                </td>
                <td className="px-5 py-2.5 text-right font-mono">{formatRM(r.totalFee)}</td>
                <td className="px-5 py-2.5 text-right font-mono font-bold text-red-600">{formatRM(r.bakiFeeTerkini)}</td>
                <td className="px-5 py-2.5 text-center text-zinc-500">{r.tarikh}</td>
              </tr>
            ))}
            {isLoading && (
              <tr><td colSpan={5} className="px-5 py-6 text-center text-zinc-400">Memuatkan...</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   REKOD PELANGGAN — full table + CRUD
══════════════════════════════════════════════════ */
function RecordsTab({
  cases, filtered, uniqueKes, searchTerm, setSearchTerm, filterKes, setFilterKes,
  selectedIds, setSelectedIds, isLoading, onNew, onPay, onHistory, onEdit, onDelete, onBulkDelete,
}: any) {
  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-zinc-200 rounded-lg p-4 shadow-sm flex flex-wrap gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-2.5 text-zinc-400" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm border border-zinc-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              placeholder="Cari nama pelanggan..."
            />
          </div>
          <div className="relative">
            <Filter size={13} className="absolute left-3 top-2.5 text-zinc-400" />
            <select
              value={filterKes}
              onChange={(e) => setFilterKes(e.target.value)}
              className="pl-8 pr-8 py-2 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            >
              {uniqueKes.map((k: string) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <span className="text-xs text-zinc-400 px-2">{filtered.length} rekod</span>
        </div>
        {selectedIds.length > 0 && (
          <button
            onClick={onBulkDelete}
            className="px-3 py-2 text-xs bg-red-600 text-white rounded-lg flex items-center gap-1.5 hover:bg-red-700 transition-colors"
          >
            <Trash2 size={13} />Padam {selectedIds.length} terpilih
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="sticky top-0 bg-zinc-50 z-10 border-b border-zinc-200">
              <tr className="text-[11px] text-zinc-500 uppercase tracking-wide">
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={filtered.length > 0 && selectedIds.length === filtered.length}
                    onChange={(e) => setSelectedIds(e.target.checked ? filtered.map((r: Case) => r.id) : [])}
                  />
                </th>
                <th className="px-4 py-3">Nama</th>
                <th className="px-4 py-3">Kategori Kes</th>
                <th className="px-4 py-3 text-right">Total Fee</th>
                <th className="px-4 py-3 text-right">Bayaran Terakhir</th>
                <th className="px-4 py-3 text-right">Baki Sebelum</th>
                <th className="px-4 py-3 text-right">Baki Terkini</th>
                <th className="px-4 py-3 text-right">Baki Mileage</th>
                <th className="px-4 py-3 text-center">Tarikh</th>
                <th className="px-4 py-3 text-center">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rec: Case) => (
                <tr key={rec.id} className="border-t border-zinc-100 hover:bg-zinc-50 transition-colors">
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(rec.id)}
                      onChange={(e) =>
                        setSelectedIds((prev: number[]) =>
                          e.target.checked ? [...prev, rec.id] : prev.filter((id: number) => id !== rec.id)
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-zinc-800">{rec.nama}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100/60 uppercase">
                      {rec.kes}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-700">{formatRM(rec.totalFee)}</td>
                  <td className="px-4 py-3 text-right font-mono text-emerald-600 font-semibold">{formatRM(rec.bayaranTerakhir)}</td>
                  <td className="px-4 py-3 text-right font-mono text-zinc-500">{formatRM(rec.bakiSebelum)}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-red-600">{formatRM(rec.bakiFeeTerkini)}</td>
                  <td className="px-4 py-3 text-right font-mono text-amber-600">
                    {rec.bakiMileage > 0 ? formatRM(rec.bakiMileage) : <span className="text-zinc-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-500">{rec.tarikh}</td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <ActionIcon title="Rekod Bayaran" color="hover:text-emerald-600" onClick={() => onPay(rec)}>
                        <DollarSign size={14} />
                      </ActionIcon>
                      <ActionIcon title="Sejarah Bayaran" color="hover:text-blue-600" onClick={() => onHistory(rec)}>
                        <History size={14} />
                      </ActionIcon>
                      <ActionIcon title="Edit Rekod" color="hover:text-amber-600" onClick={() => onEdit(rec)}>
                        <Edit size={14} />
                      </ActionIcon>
                      <ActionIcon title="Padam Rekod" color="hover:text-red-600" onClick={() => onDelete(rec)}>
                        <Trash2 size={14} />
                      </ActionIcon>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-zinc-400">
                    {isLoading ? "Memuatkan rekod..." : "Tiada rekod dijumpai"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════
   LAPORAN — analytics, breakdown, summary
══════════════════════════════════════════════════ */
function ReportsTab({ cases, stats, chartData, isLoading }: {
  cases: Case[]; stats: any; chartData: { name: string; baki: number }[]; isLoading: boolean;
}) {
  // Per-kes breakdown
  const byKes = useMemo(() => {
    const map: Record<string, { totalFee: number; dibayar: number; baki: number; count: number }> = {};
    cases.forEach((c) => {
      if (!map[c.kes]) map[c.kes] = { totalFee: 0, dibayar: 0, baki: 0, count: 0 };
      map[c.kes].totalFee += c.totalFee;
      map[c.kes].dibayar += c.totalFee - c.bakiFeeTerkini;
      map[c.kes].baki += c.bakiFeeTerkini;
      map[c.kes].count += 1;
    });
    return Object.entries(map)
      .map(([kes, v]) => ({ kes, ...v, pct: v.totalFee > 0 ? ((v.dibayar / v.totalFee) * 100).toFixed(1) : "0.0" }))
      .sort((a, b) => b.baki - a.baki);
  }, [cases]);

  // Pie data
  const pieData = byKes.map((k) => ({ name: k.kes, value: k.baki })).filter((x) => x.value > 0);

  // Summary totals
  const totalDibayar = cases.reduce((s, c) => s + (c.totalFee - c.bakiFeeTerkini), 0);
  const pctKutip = stats.totalFee > 0 ? ((totalDibayar / stats.totalFee) * 100).toFixed(1) : "0.0";
  const kesSelesai = cases.filter((c) => c.bakiFeeTerkini === 0).length;

  // Method breakdown (from stats — we use fee totals as proxy)
  const highBaki = cases.filter((c) => c.bakiFeeTerkini > 3000);
  const medBaki = cases.filter((c) => c.bakiFeeTerkini > 0 && c.bakiFeeTerkini <= 3000);
  const selesai = cases.filter((c) => c.bakiFeeTerkini === 0);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Summary row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Jumlah Kes" value={String(stats.totalKes)} sub="rekod aktif" color="blue" />
        <SummaryCard label="Total Fee" value={formatRM(stats.totalFee)} sub="keseluruhan" color="indigo" />
        <SummaryCard label="Sudah Dibayar" value={formatRM(totalDibayar)} sub={`${pctKutip}% dikutip`} color="green" />
        <SummaryCard label="Masih Tertunggak" value={formatRM(stats.totalBakiTerkini)} sub={`${cases.length - kesSelesai} kes aktif`} color="red" />
      </div>

      {/* Pie + Bar side by side */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={15} className="text-blue-600" />
            <span className="text-sm font-semibold text-zinc-700">Agihan Baki Tertunggak ikut Kes</span>
          </div>
          {pieData.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-zinc-400 text-sm">Tiada baki tertunggak</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatRM(v)} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-white border border-zinc-200 rounded-lg p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <BarChart2 size={15} className="text-blue-600" />
            <span className="text-sm font-semibold text-zinc-700">Perbandingan Fee vs Baki ikut Kes</span>
          </div>
          {byKes.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-zinc-400 text-sm">Tiada data</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byKes} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="kes" tick={{ fontSize: 10 }} />
                  <YAxis tickFormatter={(v) => `RM${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: number) => formatRM(v)} />
                  <Bar dataKey="totalFee" name="Total Fee" fill="#93c5fd" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="baki" name="Baki" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Status breakdown */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatusGroup title="Baki Tinggi (> RM3,000)" cases={highBaki} color="red" />
        <StatusGroup title="Baki Sederhana (≤ RM3,000)" cases={medBaki} color="amber" />
        <StatusGroup title="Selesai Dibayar" cases={selesai} color="green" />
      </div>

      {/* Per-kes breakdown table */}
      <div className="bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-zinc-100">
          <span className="text-sm font-semibold text-zinc-700">Ringkasan Kewangan ikut Kategori Kes</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr className="text-[11px] text-zinc-500 uppercase tracking-wide">
                <th className="px-5 py-3 text-left">Kategori Kes</th>
                <th className="px-5 py-3 text-center">Bil. Kes</th>
                <th className="px-5 py-3 text-right">Total Fee</th>
                <th className="px-5 py-3 text-right">Sudah Dibayar</th>
                <th className="px-5 py-3 text-right">Baki Tertunggak</th>
                <th className="px-5 py-3 text-center">% Kutipan</th>
              </tr>
            </thead>
            <tbody>
              {byKes.map((row) => (
                <tr key={row.kes} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="px-5 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded border border-blue-100 uppercase">{row.kes}</span>
                  </td>
                  <td className="px-5 py-3 text-center font-semibold text-zinc-700">{row.count}</td>
                  <td className="px-5 py-3 text-right font-mono text-zinc-700">{formatRM(row.totalFee)}</td>
                  <td className="px-5 py-3 text-right font-mono text-emerald-600 font-semibold">{formatRM(row.dibayar)}</td>
                  <td className="px-5 py-3 text-right font-mono font-bold text-red-600">{formatRM(row.baki)}</td>
                  <td className="px-5 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-16 bg-zinc-100 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${Math.min(100, parseFloat(row.pct))}%` }} />
                      </div>
                      <span className="font-semibold text-zinc-700">{row.pct}%</span>
                    </div>
                  </td>
                </tr>
              ))}
              {byKes.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-zinc-400">{isLoading ? "Memuatkan..." : "Tiada data"}</td></tr>
              )}
            </tbody>
            {byKes.length > 0 && (
              <tfoot className="bg-zinc-50 border-t-2 border-zinc-200">
                <tr className="font-bold">
                  <td className="px-5 py-3 text-zinc-700">JUMLAH</td>
                  <td className="px-5 py-3 text-center text-zinc-700">{stats.totalKes}</td>
                  <td className="px-5 py-3 text-right font-mono text-zinc-800">{formatRM(stats.totalFee)}</td>
                  <td className="px-5 py-3 text-right font-mono text-emerald-600">{formatRM(totalDibayar)}</td>
                  <td className="px-5 py-3 text-right font-mono text-red-600">{formatRM(stats.totalBakiTerkini)}</td>
                  <td className="px-5 py-3 text-center text-zinc-700">{pctKutip}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ── */
function StatusGroup({ title, cases, color }: { title: string; cases: Case[]; color: "red" | "amber" | "green" }) {
  const cls = {
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
    green: "border-green-200 bg-green-50",
  }[color];
  const titleCls = {
    red: "text-red-700",
    amber: "text-amber-700",
    green: "text-green-700",
  }[color];
  const valueCls = {
    red: "text-red-600",
    amber: "text-amber-600",
    green: "text-green-600",
  }[color];

  return (
    <div className={`border rounded-lg p-4 ${cls}`}>
      <div className={`text-xs font-bold uppercase tracking-wide mb-3 ${titleCls}`}>{title}</div>
      <div className={`text-2xl font-bold mb-1 ${valueCls}`}>{cases.length} kes</div>
      <div className="space-y-1 max-h-32 overflow-auto">
        {cases.slice(0, 6).map((c) => (
          <div key={c.id} className="flex justify-between text-xs">
            <span className="text-zinc-700 truncate mr-2">{c.nama} <span className="text-zinc-400">({c.kes})</span></span>
            {color !== "green" && <span className={`font-mono font-semibold shrink-0 ${valueCls}`}>{formatRM(c.bakiFeeTerkini)}</span>}
          </div>
        ))}
        {cases.length > 6 && <div className="text-[11px] text-zinc-400">+{cases.length - 6} lagi...</div>}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: string; icon: React.ReactNode; color: string }) {
  const ring = { blue: "bg-blue-50 text-blue-600", indigo: "bg-indigo-50 text-indigo-600", red: "bg-red-50 text-red-600", green: "bg-emerald-50 text-emerald-600" }[color] || "";
  const val = { blue: "text-blue-700", indigo: "text-indigo-700", red: "text-red-600", green: "text-emerald-600" }[color] || "text-zinc-800";
  return (
    <div className="bg-white border border-zinc-200 p-4 rounded-lg shadow-sm">
      <div className="flex justify-between items-start mb-2">
        <div className="text-xs text-zinc-500 font-medium">{label}</div>
        <span className={`p-1.5 rounded-lg ${ring}`}>{icon}</span>
      </div>
      <div className={`text-xl font-bold ${val}`}>{value}</div>
    </div>
  );
}

function SummaryCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  const val = { blue: "text-blue-700", indigo: "text-indigo-700", red: "text-red-600", green: "text-emerald-600" }[color] || "text-zinc-800";
  return (
    <div className="bg-white border border-zinc-200 p-4 rounded-lg shadow-sm">
      <div className="text-xs text-zinc-500 font-medium mb-1">{label}</div>
      <div className={`text-lg font-bold ${val} mb-0.5`}>{value}</div>
      <div className="text-[11px] text-zinc-400">{sub}</div>
    </div>
  );
}

function ActionIcon({ title, color, onClick, children }: { title: string; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={`p-1.5 rounded text-zinc-400 transition-colors ${color} hover:bg-zinc-100`}
    >
      {children}
    </button>
  );
}

/* ── Overlay/Modals ── */
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl border border-zinc-200 w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({ title, desc, onClose, onConfirm }: { title: string; desc: string; onClose: () => void; onConfirm: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="p-5 border-b bg-zinc-50 flex items-start gap-3">
        <AlertCircle size={18} className="text-red-500 shrink-0 mt-0.5" />
        <div>
          <div className="font-semibold text-zinc-800">{title}</div>
          <div className="text-xs text-zinc-500 mt-0.5">{desc}</div>
        </div>
      </div>
      <div className="p-4 flex gap-2 justify-end">
        <button className="px-4 py-2 border border-zinc-300 rounded-lg text-sm hover:bg-zinc-50 transition-colors" onClick={onClose}>Batal</button>
        <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors" onClick={onConfirm}>Ya, Padam</button>
      </div>
    </Overlay>
  );
}

function NewRecordModal({ onClose, onCreate }: { onClose: () => void; onCreate: (data: any) => void }) {
  const [form, setForm] = useState({ nama: "", kes: "", tarikh: new Date().toISOString().split("T")[0], totalFee: "", bakiMileage: "0" });
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nama || !form.totalFee) return;
    const totalFee = parseFloat(form.totalFee);
    onCreate({ nama: form.nama, kes: form.kes || "Umum", tarikh: form.tarikh, totalFee, bakiSebelum: totalFee, bakiFeeTerkini: totalFee, bakiMileage: parseFloat(form.bakiMileage) || 0, bayaranTerakhir: 0 });
  };
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b bg-zinc-50">
        <strong className="text-zinc-800">Rekod Pelanggan Baru</strong>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition-colors"><X size={18} /></button>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <FormField label="Nama Pelanggan *">
          <input required value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} placeholder="cth: Ahmad bin Yusof" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
        </FormField>
        <FormField label="Kategori Kes">
          <input value={form.kes} onChange={(e) => setForm({ ...form, kes: e.target.value })} placeholder="cth: Fasakh, Hadhanah" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
        </FormField>
        <FormField label="Tarikh">
          <input type="date" value={form.tarikh} onChange={(e) => setForm({ ...form, tarikh: e.target.value })} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
        </FormField>
        <FormField label="Total Fee (RM) *">
          <input required type="number" value={form.totalFee} onChange={(e) => setForm({ ...form, totalFee: e.target.value })} placeholder="0.00" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
        </FormField>
        <FormField label="Baki Mileage (RM)">
          <input type="number" value={form.bakiMileage} onChange={(e) => setForm({ ...form, bakiMileage: e.target.value })} placeholder="0.00" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
        </FormField>
        <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
          Simpan Rekod
        </button>
      </form>
    </Overlay>
  );
}

function PaymentModal({ caseData, onClose, onPay }: { caseData: Case; onClose: () => void; onPay: (data: any) => void }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("Transfer");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return setError("Sila masukkan jumlah yang sah");
    if (amt > caseData.bakiFeeTerkini) return setError("Jumlah melebihi baki semasa");
    const dateObj = new Date(date);
    const dateStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}/${dateObj.getFullYear().toString().slice(-2)}`;
    onPay({ caseId: caseData.id, amount: amt, date: dateStr, method });
  };

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b bg-zinc-50">
        <strong className="text-zinc-800">Rekod Bayaran — {caseData.nama}</strong>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
      </div>
      <form onSubmit={handleSubmit} className="p-4 space-y-3">
        <div className="bg-red-50 border border-red-100 rounded-lg p-3 flex justify-between items-center">
          <span className="text-xs text-zinc-500">Baki semasa</span>
          <span className="font-bold text-red-600 text-base">{formatRM(caseData.bakiFeeTerkini)}</span>
        </div>
        <FormField label="Jumlah Bayaran (RM) *">
          <input type="number" required value={amount} onChange={(e) => { setAmount(e.target.value); setError(""); }} placeholder="0.00" className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
        </FormField>
        <FormField label="Tarikh Bayaran">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" />
        </FormField>
        <FormField label="Kaedah Bayaran">
          <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400">
            <option>Transfer</option><option>Tunai</option><option>Cek</option>
          </select>
        </FormField>
        {error && <p className="text-red-600 text-xs bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        <button type="submit" className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors">
          Simpan Bayaran
        </button>
      </form>
    </Overlay>
  );
}

function EditModal({ caseData, onClose, onSave }: { caseData: Case; onClose: () => void; onSave: (data: any) => void }) {
  const [form, setForm] = useState({ ...caseData });
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b bg-zinc-50">
        <strong className="text-zinc-800">Edit — {caseData.nama}</strong>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
      </div>
      <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="p-4 space-y-3">
        <FormField label="Nama"><input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value })} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></FormField>
        <FormField label="Kategori Kes"><input value={form.kes} onChange={(e) => setForm({ ...form, kes: e.target.value })} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></FormField>
        <FormField label="Total Fee (RM)"><input type="number" value={form.totalFee} onChange={(e) => setForm({ ...form, totalFee: parseFloat(e.target.value) || 0 })} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></FormField>
        <FormField label="Tarikh"><input value={form.tarikh} onChange={(e) => setForm({ ...form, tarikh: e.target.value })} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></FormField>
        <FormField label="Baki Fee Terkini (RM)"><input type="number" value={form.bakiFeeTerkini} onChange={(e) => setForm({ ...form, bakiFeeTerkini: parseFloat(e.target.value) || 0 })} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></FormField>
        <FormField label="Baki Mileage (RM)"><input type="number" value={form.bakiMileage} onChange={(e) => setForm({ ...form, bakiMileage: parseFloat(e.target.value) || 0 })} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400" /></FormField>
        <button type="submit" className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">Kemaskini Rekod</button>
      </form>
    </Overlay>
  );
}

function PaymentHistoryModal({ caseData, onClose }: { caseData: Case; onClose: () => void }) {
  const qc = useQueryClient();
  const paymentsQ = useQuery<Payment[]>({
    queryKey: ["payments", caseData.id],
    queryFn: async () => {
      const r = await fetch(`/api/cases/${caseData.id}/payments`);
      const d = await r.json();
      return d.payments;
    },
  });
  const payments = paymentsQ.data || [];
  const total = payments.reduce((s, p) => s + p.amount, 0);

  const deletePayment = useMutation({
    mutationFn: async (paymentId: number) => {
      await fetch(`${API}/payments/${paymentId}`, { method: "DELETE" });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", caseData.id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
      qc.invalidateQueries({ queryKey: ["chart"] });
    },
  });

  const handleDelete = (p: Payment) => {
    if (!confirm(`Padam bayaran ${formatRM(p.amount)} pada ${p.date}?`)) return;
    deletePayment.mutate(p.id);
  };

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between p-4 border-b bg-zinc-50">
        <strong className="text-zinc-800">Sejarah Bayaran — {caseData.nama}</strong>
        <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700"><X size={18} /></button>
      </div>
      <div className="p-4 max-h-96 overflow-auto">
        {payments.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex justify-between items-center mb-3">
            <span className="text-xs text-zinc-500">Jumlah Dibayar</span>
            <span className="font-bold text-emerald-600">{formatRM(total)}</span>
          </div>
        )}
        {paymentsQ.isLoading && <p className="text-zinc-400 text-sm text-center py-4">Memuatkan...</p>}
        {!paymentsQ.isLoading && payments.length === 0 && <p className="text-zinc-400 text-sm text-center py-6">Tiada sejarah bayaran</p>}
        {payments.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[11px] text-zinc-500 uppercase border-b border-zinc-100">
                <th className="text-left py-2">Tarikh</th>
                <th className="text-right py-2">Jumlah</th>
                <th className="text-center py-2">Kaedah</th>
                <th className="text-center py-2">Padam</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-zinc-100 hover:bg-zinc-50">
                  <td className="py-2.5 text-zinc-700">{p.date}</td>
                  <td className="py-2.5 text-right font-mono font-semibold text-emerald-600">{formatRM(p.amount)}</td>
                  <td className="py-2.5 text-center">
                    <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded text-[10px] font-medium">{p.method}</span>
                  </td>
                  <td className="py-2.5 text-center">
                    <button
                      onClick={() => handleDelete(p)}
                      className="p-1 rounded text-zinc-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Padam bayaran ini"
                    >
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Overlay>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1">{label}</label>
      {children}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   SISTEM RESIT — Jana, simpan, cetak & PDF resit
══════════════════════════════════════════════════ */
function ResitTab() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [previewData, setPreviewData] = useState<any>(null);
  const [showForm, setShowForm] = useState(true);

  // Form state
  const [tarikh, setTarikh] = useState(() => new Date().toISOString().split("T")[0]);
  const [kategori, setKategori] = useState("DOKUMEN");
  const [nama, setNama] = useState("");
  const [alamat, setAlamat] = useState("");
  const [items, setItems] = useState<ReceiptItem[]>([{ perkara: "Fee/Deposit", harga: 0 }]);
  const [bakiTerdahulu, setBakiTerdahulu] = useState(0);
  const [butiran, setButiran] = useState("");

  const jumlah = items.reduce((s, i) => s + (i.harga || 0), 0);
  const bakiTerkini = bakiTerdahulu - jumlah;

  const receiptsQ = useQuery<Receipt[]>({
    queryKey: ["receipts"],
    queryFn: async () => {
      const r = await fetch(`${API}/receipts`);
      const d = await r.json();
      return d.receipts;
    },
  });

  const saveReceipt = useMutation({
    mutationFn: async (data: any) => {
      const url = editId ? `${API}/receipts/${editId}` : `${API}/receipts`;
      const method = editId ? "PUT" : "POST";
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      return r.json();
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["receipts"] }); resetForm(); },
  });

  const deleteReceipt = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`${API}/receipts/${id}`, { method: "DELETE" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["receipts"] }),
  });

  function resetForm() {
    setEditId(null);
    setTarikh(new Date().toISOString().split("T")[0]);
    setKategori("DOKUMEN");
    setNama("");
    setAlamat("");
    setItems([{ perkara: "Fee/Deposit", harga: 0 }]);
    setBakiTerdahulu(0);
    setButiran("");
    setPreviewData(null);
  }

  function loadEdit(r: Receipt) {
    setEditId(r.id);
    setTarikh(r.tarikh);
    setKategori(r.kategori);
    setNama(r.nama);
    setAlamat(r.alamat);
    setItems(JSON.parse(r.items || "[]"));
    setBakiTerdahulu(r.bakiTerdahulu);
    setButiran(r.butiran);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function buildData() {
    const d = new Date(tarikh);
    const tarikhDisplay = `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
    return {
      tarikh, tarikhDisplay,
      kategori: kategori.toUpperCase(),
      nama: nama.toUpperCase(),
      alamat: alamat.toUpperCase(),
      items: items.map(i => ({ perkara: i.perkara.toUpperCase(), harga: i.harga })),
      jumlah, bakiTerdahulu, bakiTerkini, butiran: butiran.toUpperCase(),
    };
  }

  function handlePreview() {
    if (!nama.trim()) return alert("Sila masukkan nama pelanggan.");
    setPreviewData(buildData());
  }

  function handleSimpan() {
    if (!nama.trim()) return alert("Sila masukkan nama pelanggan.");
    const data = buildData();
    setPreviewData(data);
    saveReceipt.mutate(data);
  }

  function handleCetak() {
    if (!previewData) { handlePreview(); return; }
    setTimeout(() => window.print(), 200);
  }

  function handlePDF() {
    if (!previewData) { alert("Klik PREVIEW dahulu."); return; }
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a5" });
    const f = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const pw = doc.internal.pageSize.getWidth();
    let y = 15;

    // Header
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("TETUAN HAIRI MUSTAFA & ASSOCIATES", pw / 2, y, { align: "center" }); y += 5;
    doc.setFontSize(8); doc.setFont("helvetica", "italic");
    doc.text("PEGUAM SYARIE * PESURUHJAYA SUMPAH", pw / 2, y, { align: "center" }); y += 4;
    doc.setFont("helvetica", "normal");
    doc.text("LOT 02, BANGUNAN ARKED MARA, 09100 BALING, KEDAH", pw / 2, y, { align: "center" }); y += 4;
    doc.text("TEL: 010-2434143 / 011-56531310 | EMAIL: tetuanhairi@gmail.com", pw / 2, y, { align: "center" }); y += 5;
    doc.setLineWidth(0.5); doc.line(10, y, pw - 10, y); y += 6;

    // Title
    doc.setFontSize(14); doc.setFont("helvetica", "bold");
    doc.text("RESIT", pw / 2, y, { align: "center" }); y += 8;

    // Info
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`PELANGGAN:`, 10, y);
    doc.text(`TARIKH: ${previewData.tarikhDisplay}`, pw - 10, y, { align: "right" }); y += 4;
    if (previewData.kategori) { doc.setFontSize(8); doc.text(`[KATEGORI: ${previewData.kategori}]`, 10, y); y += 4; }
    doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text(previewData.nama, 10, y); y += 4;
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    if (previewData.alamat) { doc.text(previewData.alamat, 10, y); y += 4; }
    y += 3;

    // Table header
    doc.setFillColor(44, 62, 80); doc.rect(10, y, pw - 20, 7, "F");
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("ITEM / PERKARA", 13, y + 5);
    doc.text("JUMLAH (RM)", pw - 13, y + 5, { align: "right" });
    doc.setTextColor(0, 0, 0); y += 7;

    // Table rows
    doc.setFont("helvetica", "normal"); doc.setFontSize(9);
    previewData.items.forEach((item: ReceiptItem, i: number) => {
      if (i % 2 === 0) { doc.setFillColor(245, 246, 250); doc.rect(10, y, pw - 20, 6, "F"); }
      doc.rect(10, y, pw - 20, 6);
      doc.text(item.perkara, 13, y + 4);
      doc.text(f(item.harga), pw - 13, y + 4, { align: "right" });
      y += 6;
    });
    y += 4;

    // Summary
    doc.setLineWidth(0.3); doc.line(pw / 2, y, pw - 10, y); y += 1;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text(`JUMLAH BAYARAN: RM ${f(previewData.jumlah)}`, pw - 10, y + 4, { align: "right" }); y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`BAKI TERDAHULU: RM ${f(previewData.bakiTerdahulu)}`, pw - 10, y + 4, { align: "right" }); y += 6;
    doc.setLineWidth(0.5); doc.line(pw / 2, y, pw - 10, y); y += 1;
    doc.setFont("helvetica", "bold");
    doc.text(`BAKI TERKINI: RM ${f(previewData.bakiTerkini)}`, pw - 10, y + 5, { align: "right" }); y += 8;

    if (previewData.butiran) {
      doc.setFont("helvetica", "normal"); doc.setFontSize(8);
      doc.text(`BUTIRAN KES: ${previewData.butiran}`, 10, y); y += 6;
    }

    // Signature
    y += 10;
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    doc.text("HAIRI MUSTAFA & ASSOCIATES", pw - 10, y, { align: "right" }); y += 4;
    doc.setFont("helvetica", "normal"); doc.setFontSize(8);
    doc.text("Peguam Syarie & Pesuruhjaya Sumpah", pw - 10, y, { align: "right" });

    // Footer
    const fh = doc.internal.pageSize.getHeight() - 10;
    doc.setFontSize(8); doc.setFont("helvetica", "italic"); doc.setTextColor(120, 120, 120);
    doc.line(10, fh - 5, pw - 10, fh - 5);
    doc.text("Resit ini dijana oleh komputer, terima kasih atas urusan anda", pw / 2, fh, { align: "center" });

    doc.save(`Resit_${previewData.nama}_${previewData.tarikhDisplay}.pdf`);
  }

  const receipts = receiptsQ.data || [];
  const filtered = receipts.filter(r => r.nama.toLowerCase().includes(search.toLowerCase()));
  const f = (n: number) => n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Toggle form/list on mobile */}
      <div className="flex gap-2 md:hidden">
        <button onClick={() => setShowForm(true)} className={`flex-1 py-2 text-xs rounded font-semibold ${showForm ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600"}`}>Jana Resit</button>
        <button onClick={() => setShowForm(false)} className={`flex-1 py-2 text-xs rounded font-semibold ${!showForm ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-600"}`}>Senarai Rekod</button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── FORM ── */}
        <div className={`lg:w-80 xl:w-96 shrink-0 bg-white rounded-xl border border-zinc-200 shadow-sm ${!showForm ? "hidden md:block" : ""}`}>
          <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
            <h2 className="font-semibold text-zinc-800 text-sm">{editId ? "Kemaskini Resit" : "Jana Resit Baru"}</h2>
            {editId && <button onClick={resetForm} className="text-xs text-zinc-400 hover:text-zinc-600"><X size={14} /></button>}
          </div>
          <div className="p-5 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Tarikh</label>
              <input type="date" value={tarikh} onChange={e => setTarikh(e.target.value)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Kategori</label>
              <input list="kategoriList" value={kategori} onChange={e => setKategori(e.target.value)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" />
              <datalist id="kategoriList">
                <option value="DOKUMEN" /><option value="LAWYER" /><option value="PJS" />
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Nama Pelanggan *</label>
              <input value={nama} onChange={e => setNama(e.target.value)} placeholder="Nama penuh..." className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Alamat</label>
              <textarea value={alamat} onChange={e => setAlamat(e.target.value)} rows={2} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Perkara / Item</label>
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <input value={item.perkara} onChange={e => { const n = [...items]; n[idx].perkara = e.target.value; setItems(n); }} placeholder="Butiran..." className="flex-[3] border border-zinc-200 rounded px-2 py-1.5 text-xs" />
                    <input type="number" step="0.01" value={item.harga || ""} onChange={e => { const n = [...items]; n[idx].harga = parseFloat(e.target.value) || 0; setItems(n); }} placeholder="RM" className="flex-1 border border-zinc-200 rounded px-2 py-1.5 text-xs" />
                    <button onClick={() => items.length > 1 && setItems(items.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600"><X size={13} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => setItems([...items, { perkara: "", harga: 0 }])} className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium">+ Tambah Perkara</button>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Jumlah Keseluruhan (RM)</label>
              <input readOnly value={f(jumlah)} className="w-full border border-zinc-100 bg-zinc-50 rounded-lg px-3 py-2 text-sm font-bold text-blue-700" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Baki Terdahulu (RM)</label>
              <input type="number" step="0.01" value={bakiTerdahulu || ""} onChange={e => setBakiTerdahulu(parseFloat(e.target.value) || 0)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Baki Terkini (RM)</label>
              <input readOnly value={f(bakiTerkini)} className="w-full border border-zinc-100 bg-zinc-50 rounded-lg px-3 py-2 text-sm font-bold text-emerald-700" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1">Butiran Kes (U.P)</label>
              <input value={butiran} onChange={e => setButiran(e.target.value)} className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={handlePreview} className="flex-1 py-2 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-semibold hover:bg-blue-100">Preview</button>
              <button onClick={handleSimpan} disabled={saveReceipt.isPending} className="flex-1 py-2 text-xs bg-zinc-800 text-white rounded-lg font-semibold hover:bg-zinc-700 disabled:opacity-50">
                {saveReceipt.isPending ? "Menyimpan..." : editId ? "Kemaskini" : "Simpan"}
              </button>
            </div>
            {previewData && (
              <div className="flex gap-2">
                <button onClick={handleCetak} className="flex-1 py-2 text-xs bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 flex items-center justify-center gap-1"><Printer size={12} />Cetak</button>
                <button onClick={handlePDF} className="flex-1 py-2 text-xs bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 flex items-center justify-center gap-1"><Download size={12} />PDF</button>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Preview + List ── */}
        <div className={`flex-1 space-y-6 ${showForm ? "hidden md:block" : ""} lg:block`}>
          {/* Receipt Preview */}
          {previewData && (
            <div id="receiptPrintArea" className="bg-white rounded-xl border border-zinc-200 shadow-sm p-6 max-w-2xl">
              {/* Print header */}
              <div className="flex items-start gap-3 border-b-2 border-black pb-3 mb-4">
                <img src="https://arleta.site/interactivelink/2510/logo.png" alt="Logo" className="h-16 w-auto" onError={e => (e.currentTarget.style.display = "none")} />
                <div>
                  <h1 className="font-bold uppercase text-base">TETUAN HAIRI MUSTAFA & ASSOCIATES</h1>
                  <p className="text-[11px] font-bold italic">PEGUAM SYARIE * PESURUHJAYA SUMPAH</p>
                  <p className="text-[10px]">LOT 02, BANGUNAN ARKED MARA, 09100 BALING, KEDAH</p>
                  <p className="text-[10px]">TEL: 010-2434143 / 011-56531310 | EMAIL: tetuanhairi@gmail.com</p>
                </div>
              </div>
              <div className="flex justify-between text-xs mb-3">
                <div>
                  <strong>PELANGGAN:</strong><br />
                  <span className="text-[10px] text-zinc-500">[KATEGORI: {previewData.kategori}]</span><br />
                  <span className="font-bold text-sm">{previewData.nama}</span><br />
                  <span className="whitespace-pre-line text-zinc-600">{previewData.alamat}</span>
                </div>
                <div className="text-right"><strong>TARIKH:</strong> {previewData.tarikhDisplay}</div>
              </div>
              <div className="text-center font-bold text-base underline mb-4">RESIT</div>
              <table className="w-full border-collapse text-xs mb-4">
                <thead>
                  <tr className="bg-zinc-800 text-white">
                    <th className="border border-zinc-700 px-3 py-2 text-left">ITEM / PERKARA</th>
                    <th className="border border-zinc-700 px-3 py-2 text-right w-28">JUMLAH (RM)</th>
                  </tr>
                </thead>
                <tbody>
                  {previewData.items.map((item: ReceiptItem, i: number) => (
                    <tr key={i} className={i % 2 === 0 ? "bg-zinc-50" : ""}>
                      <td className="border border-zinc-200 px-3 py-2">{item.perkara}</td>
                      <td className="border border-zinc-200 px-3 py-2 text-right">{f(item.harga)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex justify-between text-xs font-semibold">
                <div>{previewData.butiran && <p>BUTIRAN KES: <span className="underline">{previewData.butiran}</span></p>}</div>
                <div className="text-right space-y-1">
                  <p>JUMLAH BAYARAN: RM {f(previewData.jumlah)}</p>
                  <p>BAKI TERDAHULU: RM {f(previewData.bakiTerdahulu)}</p>
                  <p className="border-t border-black pt-1">BAKI TERKINI: RM {f(previewData.bakiTerkini)}</p>
                </div>
              </div>
              <div className="flex justify-end mt-8">
                <div className="text-center w-52">
                  <img src="https://arleta.site/interactivelink/2510/cop-bulat.png" alt="Cop" className="h-20 w-auto mx-auto mb-1" onError={e => (e.currentTarget.style.display = "none")} />
                  <p className="text-xs font-bold">HAIRI MUSTAFA & ASSOCIATES</p>
                  <p className="text-[10px]">Peguam Syarie & Pesuruhjaya Sumpah</p>
                </div>
              </div>
              <div className="mt-6 pt-3 border-t border-dashed border-zinc-300 text-center text-[10px] italic text-zinc-400">
                Resit ini dijana oleh komputer, terima kasih atas urusan anda
              </div>
            </div>
          )}

          {/* Receipts List */}
          <div className="bg-white rounded-xl border border-zinc-200 shadow-sm">
            <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-semibold text-sm text-zinc-800">Senarai Rekod Resit ({receipts.length})</h3>
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama..." className="pl-8 pr-3 py-1.5 border border-zinc-200 rounded-lg text-xs w-44" />
              </div>
            </div>
            {receiptsQ.isLoading ? (
              <div className="p-8 text-center text-xs text-zinc-400">Memuatkan...</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400">Tiada rekod resit</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="border-b border-zinc-100 bg-zinc-50 text-zinc-500">
                    <th className="px-4 py-2.5 text-left font-medium">Tarikh</th>
                    <th className="px-4 py-2.5 text-left font-medium">Nama Pelanggan</th>
                    <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Perkara</th>
                    <th className="px-4 py-2.5 text-right font-medium">Bayaran (RM)</th>
                    <th className="px-4 py-2.5 text-right font-medium hidden sm:table-cell">Baki Terkini (RM)</th>
                    <th className="px-4 py-2.5 text-center font-medium">Tindakan</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(r => {
                      const its: ReceiptItem[] = JSON.parse(r.items || "[]");
                      return (
                        <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                          <td className="px-4 py-2.5 text-zinc-500">{r.tarikhDisplay}</td>
                          <td className="px-4 py-2.5 font-medium text-zinc-800">{r.nama}</td>
                          <td className="px-4 py-2.5 text-zinc-500 hidden sm:table-cell">{its.map(i => i.perkara).join(", ")}</td>
                          <td className="px-4 py-2.5 text-right font-medium text-blue-700">{f(r.jumlah)}</td>
                          <td className={`px-4 py-2.5 text-right font-medium hidden sm:table-cell ${r.bakiTerkini < 0 ? "text-red-600" : r.bakiTerkini === 0 ? "text-emerald-600" : "text-amber-600"}`}>{f(r.bakiTerkini)}</td>
                          <td className="px-4 py-2.5">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => loadEdit(r)} title="Edit" className="p-1 rounded hover:bg-amber-50 text-amber-500 hover:text-amber-700"><Edit size={12} /></button>
                              <button onClick={() => { if (confirm(`Padam resit ${r.nama}?`)) deleteReceipt.mutate(r.id); }} title="Padam" className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600"><Trash2 size={12} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Print-only styles */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #receiptPrintArea { display: block !important; position: fixed; top: 0; left: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
