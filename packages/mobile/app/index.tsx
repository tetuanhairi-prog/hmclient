import React, { useState, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, ActivityIndicator, RefreshControl, Alert,
  Modal, KeyboardAvoidingView, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, formatRM, Case, Payment } from "../lib/api";

// ─────────────── Colors ───────────────
const C = {
  bg: "#f4f4f5",
  white: "#ffffff",
  sidebar: "#18181b",
  primary: "#2563eb",
  success: "#059669",
  danger: "#dc2626",
  warn: "#d97706",
  text: "#18181b",
  textSub: "#71717a",
  border: "#e4e4e7",
  card: "#ffffff",
  blue50: "#eff6ff",
  blue100: "#dbeafe",
  green50: "#f0fdf4",
  red50: "#fef2f2",
  amber50: "#fffbeb",
};

type Tab = "dashboard" | "records" | "reports";

// ─────────────── Main ───────────────
export default function Index() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [search, setSearch] = useState("");
  const [filterKes, setFilterKes] = useState("Semua");
  const [isNewOpen, setIsNewOpen] = useState(false);
  const [paymentCase, setPaymentCase] = useState<Case | null>(null);
  const [editingCase, setEditingCase] = useState<Case | null>(null);
  const [historyCase, setHistoryCase] = useState<Case | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const casesQ = useQuery({
    queryKey: ["cases"],
    queryFn: apiClient.getCases,
  });
  const statsQ = useQuery({
    queryKey: ["stats"],
    queryFn: apiClient.getStats,
  });
  const chartQ = useQuery({
    queryKey: ["chart"],
    queryFn: apiClient.getChart,
  });

  // Auto-seed — only after confirmed fetch (not just empty state during loading)
  useEffect(() => {
    if (casesQ.isFetched && casesQ.data && casesQ.data.length === 0) {
      apiClient.seed().then(() => {
        qc.invalidateQueries({ queryKey: ["cases"] });
        qc.invalidateQueries({ queryKey: ["stats"] });
        qc.invalidateQueries({ queryKey: ["chart"] });
      });
    }
  }, [casesQ.isFetched, casesQ.data]);

  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["cases"] });
    qc.invalidateQueries({ queryKey: ["stats"] });
    qc.invalidateQueries({ queryKey: ["chart"] });
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        qc.refetchQueries({ queryKey: ["cases"] }),
        qc.refetchQueries({ queryKey: ["stats"] }),
        qc.refetchQueries({ queryKey: ["chart"] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const cases = casesQ.data || [];
  const stats = statsQ.data || { totalKes: 0, totalFee: 0, totalBakiTerkini: 0, totalMileage: 0 };
  const chart = (chartQ.data || []).filter((x) => x.baki > 0);

  const uniqueKes = useMemo(
    () => ["Semua", ...Array.from(new Set(cases.map((c) => c.kes)))],
    [cases]
  );

  const filtered = useMemo(
    () =>
      cases.filter((c) => {
        const ms = c.nama.toLowerCase().includes(search.toLowerCase());
        const mk = filterKes === "Semua" || c.kes === filterKes;
        return ms && mk;
      }),
    [cases, search, filterKes]
  );

  const createCase = useMutation({
    mutationFn: (data: any) => apiClient.createCase(data),
    onSuccess: refreshAll,
  });

  const updateCase = useMutation({
    mutationFn: ({ id, ...data }: any) => apiClient.updateCase(id, data),
    onSuccess: refreshAll,
  });

  const deleteCase = useMutation({
    mutationFn: (id: number) => apiClient.deleteCase(id),
    onSuccess: refreshAll,
  });

  const addPayment = useMutation({
    mutationFn: ({ caseId, ...data }: any) => apiClient.addPayment(caseId, data),
    onSuccess: refreshAll,
  });

  const handleDelete = (rec: Case) => {
    Alert.alert("Padam Rekod", `Padam rekod ${rec.nama}?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Padam",
        style: "destructive",
        onPress: () => deleteCase.mutate(rec.id),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>
            HM Client<Text style={{ color: C.primary }}> Lawyer</Text>
          </Text>
          <Text style={styles.headerSub}>Sistem Pengurusan Kes</Text>
        </View>
        {tab === "records" && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setIsNewOpen(true)}>
            <Text style={styles.addBtnText}>+ Baru</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, tab === "dashboard" && styles.tabItemActive]}
          onPress={() => setTab("dashboard")}
        >
          <Text style={[styles.tabText, tab === "dashboard" && styles.tabTextActive]}>
            Dashboard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === "records" && styles.tabItemActive]}
          onPress={() => setTab("records")}
        >
          <Text style={[styles.tabText, tab === "records" && styles.tabTextActive]}>
            Rekod ({cases.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, tab === "reports" && styles.tabItemActive]}
          onPress={() => setTab("reports")}
        >
          <Text style={[styles.tabText, tab === "reports" && styles.tabTextActive]}>
            Laporan
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {tab === "dashboard" && (
          <DashboardTab stats={stats} chart={chart} cases={cases} />
        )}
        {tab === "records" && (
          <RecordsTab
            filtered={filtered}
            cases={cases}
            search={search}
            setSearch={setSearch}
            filterKes={filterKes}
            setFilterKes={setFilterKes}
            uniqueKes={uniqueKes}
            isLoading={casesQ.isLoading}
            onPay={setPaymentCase}
            onHistory={setHistoryCase}
            onEdit={setEditingCase}
            onDelete={handleDelete}
          />
        )}
        {tab === "reports" && (
          <ReportsTab cases={cases} stats={stats} isLoading={casesQ.isLoading} />
        )}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* Modals */}
      {isNewOpen && (
        <NewRecordModal
          onClose={() => setIsNewOpen(false)}
          onCreate={(data) => { createCase.mutate(data); setIsNewOpen(false); }}
        />
      )}
      {paymentCase && (
        <PaymentModal
          caseData={paymentCase}
          onClose={() => setPaymentCase(null)}
          onPay={(data) => { addPayment.mutate(data); setPaymentCase(null); }}
        />
      )}
      {editingCase && (
        <EditModal
          caseData={editingCase}
          onClose={() => setEditingCase(null)}
          onSave={(data) => { updateCase.mutate(data); setEditingCase(null); }}
        />
      )}
      {historyCase && (
        <PaymentHistoryModal
          caseData={historyCase}
          onClose={() => setHistoryCase(null)}
        />
      )}
    </SafeAreaView>
  );
}

// ─────────────── Dashboard Tab ───────────────
function DashboardTab({ stats, chart, cases }: any) {
  const topBaki = [...cases].sort((a: Case, b: Case) => b.bakiFeeTerkini - a.bakiFeeTerkini).slice(0, 5);
  const recentCases = [...cases].sort((a: Case, b: Case) =>
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  ).slice(0, 5);

  const totalCollected = cases.reduce((sum: number, c: Case) => sum + (c.totalFee - c.bakiFeeTerkini), 0);
  const collectionRate = stats.totalFee > 0 ? Math.round((totalCollected / stats.totalFee) * 100) : 0;

  return (
    <View style={styles.tabContent}>
      {/* Stat cards */}
      <View style={styles.statGrid}>
        <StatCard label="Jumlah Kes" value={String(stats.totalKes)} color={C.primary} />
        <StatCard label="Total Fee" value={formatRM(stats.totalFee)} color={C.success} />
        <StatCard label="Baki Terkini" value={formatRM(stats.totalBakiTerkini)} color={C.danger} />
        <StatCard label="Baki Mileage" value={formatRM(stats.totalMileage)} color={C.warn} />
      </View>

      {/* Collection rate */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Kadar Kutipan Keseluruhan</Text>
        <View style={styles.progressRow}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${collectionRate}%` as any }]} />
          </View>
          <Text style={styles.progressLabel}>{collectionRate}%</Text>
        </View>
        <View style={styles.progressMeta}>
          <Text style={styles.progressMetaText}>
            Dikutip: <Text style={{ color: C.success, fontWeight: "700" }}>{formatRM(totalCollected)}</Text>
          </Text>
          <Text style={styles.progressMetaText}>
            Baki: <Text style={{ color: C.danger, fontWeight: "700" }}>{formatRM(stats.totalBakiTerkini)}</Text>
          </Text>
        </View>
      </View>

      {/* Chart section */}
      {chart.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Baki ikut Kategori Kes</Text>
          {chart.map((d: any) => (
            <View key={d.name} style={styles.chartRow}>
              <Text style={styles.chartLabel} numberOfLines={1}>{d.name}</Text>
              <View style={styles.chartBarWrap}>
                <View
                  style={[
                    styles.chartBar,
                    { width: `${Math.min(100, (d.baki / (chart[0]?.baki || 1)) * 100)}%` as any },
                  ]}
                />
              </View>
              <Text style={styles.chartVal}>{formatRM(d.baki)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Top 5 outstanding */}
      {topBaki.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Top 5 Baki Tertinggi</Text>
          {topBaki.map((c: Case, i: number) => (
            <View key={c.id} style={[styles.topRow, i < topBaki.length - 1 && styles.borderBottom]}>
              <View style={styles.topRank}><Text style={styles.topRankText}>{i + 1}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.topName}>{c.nama}</Text>
                <Text style={styles.topKes}>{c.kes}</Text>
              </View>
              <Text style={styles.topBaki}>{formatRM(c.bakiFeeTerkini)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Recent cases */}
      {recentCases.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Kes Terkini</Text>
          {recentCases.map((c: Case, i: number) => (
            <View key={c.id} style={[styles.topRow, i < recentCases.length - 1 && styles.borderBottom]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.topName}>{c.nama}</Text>
                <Text style={styles.topKes}>{c.kes} · {c.tarikh}</Text>
              </View>
              <Text style={[styles.topBaki, { color: c.bakiFeeTerkini > 0 ? C.danger : C.success }]}>
                {c.bakiFeeTerkini > 0 ? formatRM(c.bakiFeeTerkini) : "Selesai"}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─────────────── Records Tab ───────────────
function RecordsTab({ filtered, cases, search, setSearch, filterKes, setFilterKes, uniqueKes, isLoading, onPay, onHistory, onEdit, onDelete }: any) {
  return (
    <View style={styles.tabContent}>
      {/* Search */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Cari nama pelanggan..."
          placeholderTextColor={C.textSub}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {uniqueKes.map((k: string) => (
          <TouchableOpacity
            key={k}
            style={[styles.chip, filterKes === k && styles.chipActive]}
            onPress={() => setFilterKes(k)}
          >
            <Text style={[styles.chipText, filterKes === k && styles.chipTextActive]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <Text style={styles.countText}>{filtered.length} rekod</Text>

      {isLoading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyText}>Tiada rekod dijumpai</Text>
      ) : (
        filtered.map((rec: Case) => (
          <CaseCard
            key={rec.id}
            rec={rec}
            onPay={onPay}
            onHistory={onHistory}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))
      )}
    </View>
  );
}

// ─────────────── Reports Tab ───────────────
function ReportsTab({ cases, stats, isLoading }: { cases: Case[]; stats: any; isLoading: boolean }) {
  const reportData = useMemo(() => {
    if (!cases.length) return { byKes: [], selesai: 0, belumSelesai: 0, tinggi: [], sederhana: [] };

    // Group by kes type
    const groups: Record<string, { totalFee: number; baki: number; count: number }> = {};
    for (const c of cases) {
      if (!groups[c.kes]) groups[c.kes] = { totalFee: 0, baki: 0, count: 0 };
      groups[c.kes].totalFee += c.totalFee;
      groups[c.kes].baki += c.bakiFeeTerkini;
      groups[c.kes].count += 1;
    }
    const byKes = Object.entries(groups)
      .map(([kes, d]) => ({
        kes,
        count: d.count,
        totalFee: d.totalFee,
        baki: d.baki,
        collected: d.totalFee - d.baki,
        rate: d.totalFee > 0 ? Math.round(((d.totalFee - d.baki) / d.totalFee) * 100) : 0,
      }))
      .sort((a, b) => b.baki - a.baki);

    const selesai = cases.filter((c) => c.bakiFeeTerkini === 0).length;
    const belumSelesai = cases.filter((c) => c.bakiFeeTerkini > 0).length;
    const tinggi = cases.filter((c) => c.bakiFeeTerkini >= 3000).sort((a, b) => b.bakiFeeTerkini - a.bakiFeeTerkini);
    const sederhana = cases.filter((c) => c.bakiFeeTerkini > 0 && c.bakiFeeTerkini < 3000).sort((a, b) => b.bakiFeeTerkini - a.bakiFeeTerkini);

    return { byKes, selesai, belumSelesai, tinggi, sederhana };
  }, [cases]);

  if (isLoading) return <ActivityIndicator color={C.primary} style={{ marginTop: 60 }} />;

  const totalCollected = stats.totalFee - stats.totalBakiTerkini;

  return (
    <View style={styles.tabContent}>

      {/* Summary cards */}
      <View style={styles.statGrid}>
        <StatCard label="Sudah Selesai" value={String(reportData.selesai)} color={C.success} />
        <StatCard label="Belum Selesai" value={String(reportData.belumSelesai)} color={C.danger} />
        <StatCard label="Jumlah Dikutip" value={formatRM(totalCollected)} color={C.primary} />
        <StatCard label="Jumlah Baki" value={formatRM(stats.totalBakiTerkini)} color={C.warn} />
      </View>

      {/* Baki tinggi (≥ RM3,000) */}
      {reportData.tinggi.length > 0 && (
        <View style={[styles.card, styles.cardRed]}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.dot, { backgroundColor: C.danger }]} />
            <Text style={[styles.sectionTitle, { color: C.danger }]}>
              Baki Tinggi (≥ RM3,000) · {reportData.tinggi.length} kes
            </Text>
          </View>
          {reportData.tinggi.map((c, i) => (
            <View key={c.id} style={[styles.reportRow, i < reportData.tinggi.length - 1 && styles.borderBottom]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportName}>{c.nama}</Text>
                <Text style={styles.reportKes}>{c.kes}</Text>
              </View>
              <Text style={[styles.reportAmt, { color: C.danger }]}>{formatRM(c.bakiFeeTerkini)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Baki sederhana (< RM3,000 & > 0) */}
      {reportData.sederhana.length > 0 && (
        <View style={[styles.card, styles.cardAmber]}>
          <View style={styles.cardTitleRow}>
            <View style={[styles.dot, { backgroundColor: C.warn }]} />
            <Text style={[styles.sectionTitle, { color: C.warn }]}>
              Baki Sederhana (&lt; RM3,000) · {reportData.sederhana.length} kes
            </Text>
          </View>
          {reportData.sederhana.map((c, i) => (
            <View key={c.id} style={[styles.reportRow, i < reportData.sederhana.length - 1 && styles.borderBottom]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportName}>{c.nama}</Text>
                <Text style={styles.reportKes}>{c.kes}</Text>
              </View>
              <Text style={[styles.reportAmt, { color: C.warn }]}>{formatRM(c.bakiFeeTerkini)}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Per-kes breakdown */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ringkasan ikut Kategori Kes</Text>
        {reportData.byKes.map((d, i) => (
          <View key={d.kes} style={[styles.kesBreakdownRow, i < reportData.byKes.length - 1 && styles.borderBottom]}>
            <View style={{ marginBottom: 6 }}>
              <Text style={styles.kesBreakdownTitle}>{d.kes}</Text>
              <Text style={styles.kesBreakdownCount}>{d.count} kes</Text>
            </View>
            <View style={styles.kesBreakdownBar}>
              <View style={[styles.kesBarFill, { width: `${d.rate}%` as any }]} />
            </View>
            <View style={styles.kesBreakdownAmts}>
              <Text style={styles.kesAmtLabel}>
                Fee: <Text style={styles.kesAmtVal}>{formatRM(d.totalFee)}</Text>
              </Text>
              <Text style={styles.kesAmtLabel}>
                Dikutip: <Text style={[styles.kesAmtVal, { color: C.success }]}>{formatRM(d.collected)}</Text>
              </Text>
              <Text style={styles.kesAmtLabel}>
                Baki: <Text style={[styles.kesAmtVal, { color: C.danger }]}>{formatRM(d.baki)}</Text>
              </Text>
            </View>
            <Text style={styles.kesRate}>{d.rate}% dikutip</Text>
          </View>
        ))}

        {/* Totals footer */}
        <View style={[styles.totalsRow]}>
          <Text style={styles.totalsLabel}>JUMLAH KESELURUHAN</Text>
          <View style={styles.totalsAmts}>
            <Text style={styles.totalsItem}>
              Fee: <Text style={{ fontWeight: "800" }}>{formatRM(stats.totalFee)}</Text>
            </Text>
            <Text style={[styles.totalsItem, { color: C.success }]}>
              Dikutip: <Text style={{ fontWeight: "800" }}>{formatRM(totalCollected)}</Text>
            </Text>
            <Text style={[styles.totalsItem, { color: C.danger }]}>
              Baki: <Text style={{ fontWeight: "800" }}>{formatRM(stats.totalBakiTerkini)}</Text>
            </Text>
          </View>
        </View>
      </View>

      {/* All cases detail list */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Senarai Semua Kes ({cases.length})</Text>
        {cases
          .slice()
          .sort((a: Case, b: Case) => b.bakiFeeTerkini - a.bakiFeeTerkini)
          .map((c: Case, i: number) => (
            <View key={c.id} style={[styles.reportRow, i < cases.length - 1 && styles.borderBottom]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportName}>{c.nama}</Text>
                <Text style={styles.reportKes}>{c.kes} · Fee: {formatRM(c.totalFee)}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[
                  styles.reportAmt,
                  { color: c.bakiFeeTerkini === 0 ? C.success : C.danger }
                ]}>
                  {c.bakiFeeTerkini === 0 ? "Selesai" : formatRM(c.bakiFeeTerkini)}
                </Text>
                {c.bakiMileage > 0 && (
                  <Text style={{ fontSize: 10, color: C.warn }}>+{formatRM(c.bakiMileage)} mileage</Text>
                )}
              </View>
            </View>
          ))}
      </View>

    </View>
  );
}

// ─────────────── CaseCard ───────────────
function CaseCard({ rec, onPay, onHistory, onEdit, onDelete }: any) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity style={styles.caseCard} onPress={() => setExpanded(!expanded)} activeOpacity={0.8}>
      <View style={styles.caseCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.caseName}>{rec.nama}</Text>
          <View style={styles.kesBadgeWrap}>
            <Text style={styles.kesBadge}>{rec.kes}</Text>
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.bakiLabel}>Baki</Text>
          <Text style={styles.bakiAmount}>{formatRM(rec.bakiFeeTerkini)}</Text>
        </View>
      </View>

      {expanded && (
        <View style={styles.caseExpanded}>
          <Row label="Total Fee" value={formatRM(rec.totalFee)} />
          <Row label="Bayaran Terakhir" value={formatRM(rec.bayaranTerakhir)} color={C.success} />
          <Row label="Baki Sebelum" value={formatRM(rec.bakiSebelum)} />
          {rec.bakiMileage > 0 && <Row label="Baki Mileage" value={formatRM(rec.bakiMileage)} color={C.warn} />}
          <Row label="Tarikh" value={rec.tarikh} />

          <View style={styles.actionRow}>
            <ActionBtn label="Bayar" color={C.success} onPress={() => onPay(rec)} />
            <ActionBtn label="Sejarah" color={C.primary} onPress={() => onHistory(rec)} />
            <ActionBtn label="Edit" color={C.warn} onPress={() => onEdit(rec)} />
            <ActionBtn label="Padam" color={C.danger} onPress={() => onDelete(rec)} />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

function ActionBtn({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={[styles.actionBtn, { backgroundColor: color }]} onPress={onPress}>
      <Text style={styles.actionBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

// ─────────────── StatCard ───────────────
function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

// ─────────────── Modal base ───────────────
function ModalBase({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <Modal visible transparent animationType="slide">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {children}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, ...props }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput style={styles.fieldInput} placeholderTextColor={C.textSub} {...props} />
    </View>
  );
}

// ─────────────── NewRecordModal ───────────────
function NewRecordModal({ onClose, onCreate }: { onClose: () => void; onCreate: (d: any) => void }) {
  const today = new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "2-digit" }).replace(/\//g, "/");
  const [form, setForm] = useState({ nama: "", kes: "", tarikh: today, totalFee: "", bakiMileage: "0" });

  const handleSubmit = () => {
    if (!form.nama || !form.totalFee) return Alert.alert("Sila isi nama dan total fee");
    const totalFee = parseFloat(form.totalFee);
    onCreate({ nama: form.nama, kes: form.kes || "Umum", tarikh: form.tarikh, totalFee, bakiSebelum: totalFee, bakiFeeTerkini: totalFee, bakiMileage: parseFloat(form.bakiMileage) || 0, bayaranTerakhir: 0 });
  };

  return (
    <ModalBase title="Rekod Baru" onClose={onClose}>
      <Field label="Nama Pelanggan *" value={form.nama} onChangeText={(v: string) => setForm({ ...form, nama: v })} placeholder="cth: Ahmad bin Yusof" />
      <Field label="Kategori Kes" value={form.kes} onChangeText={(v: string) => setForm({ ...form, kes: v })} placeholder="cth: Fasakh, Hadhanah" />
      <Field label="Tarikh" value={form.tarikh} onChangeText={(v: string) => setForm({ ...form, tarikh: v })} placeholder="dd/mm/yy" />
      <Field label="Total Fee (RM) *" value={form.totalFee} onChangeText={(v: string) => setForm({ ...form, totalFee: v })} placeholder="0.00" keyboardType="numeric" />
      <Field label="Baki Mileage (RM)" value={form.bakiMileage} onChangeText={(v: string) => setForm({ ...form, bakiMileage: v })} placeholder="0.00" keyboardType="numeric" />
      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: C.primary }]} onPress={handleSubmit}>
        <Text style={styles.submitBtnText}>Simpan Rekod</Text>
      </TouchableOpacity>
    </ModalBase>
  );
}

// ─────────────── PaymentModal ───────────────
function PaymentModal({ caseData, onClose, onPay }: { caseData: Case; onClose: () => void; onPay: (d: any) => void }) {
  const today = new Date().toLocaleDateString("en-MY", { day: "2-digit", month: "2-digit", year: "2-digit" });
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState("Transfer");

  const handleSubmit = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return Alert.alert("Sila masukkan jumlah yang sah");
    if (amt > caseData.bakiFeeTerkini) return Alert.alert("Jumlah melebihi baki semasa");
    onPay({ caseId: caseData.id, amount: amt, date, method });
  };

  const methods = ["Transfer", "Tunai", "Cek"];

  return (
    <ModalBase title={`Bayaran: ${caseData.nama}`} onClose={onClose}>
      <View style={styles.bakiInfo}>
        <Text style={styles.bakiInfoLabel}>Baki Semasa</Text>
        <Text style={styles.bakiInfoVal}>{formatRM(caseData.bakiFeeTerkini)}</Text>
      </View>
      <Field label="Jumlah Bayaran (RM) *" value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="numeric" />
      <Field label="Tarikh" value={date} onChangeText={setDate} placeholder="dd/mm/yy" />
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Kaedah Bayaran</Text>
        <View style={styles.methodRow}>
          {methods.map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.methodChip, method === m && styles.methodChipActive]}
              onPress={() => setMethod(m)}
            >
              <Text style={[styles.methodChipText, method === m && styles.methodChipTextActive]}>{m}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: C.success }]} onPress={handleSubmit}>
        <Text style={styles.submitBtnText}>Simpan Bayaran</Text>
      </TouchableOpacity>
    </ModalBase>
  );
}

// ─────────────── EditModal ───────────────
function EditModal({ caseData, onClose, onSave }: { caseData: Case; onClose: () => void; onSave: (d: any) => void }) {
  const [form, setForm] = useState({ ...caseData });

  return (
    <ModalBase title={`Edit: ${caseData.nama}`} onClose={onClose}>
      <Field label="Nama" value={form.nama} onChangeText={(v: string) => setForm({ ...form, nama: v })} />
      <Field label="Kes" value={form.kes} onChangeText={(v: string) => setForm({ ...form, kes: v })} />
      <Field label="Total Fee (RM)" value={String(form.totalFee)} onChangeText={(v: string) => setForm({ ...form, totalFee: parseFloat(v) || 0 })} keyboardType="numeric" />
      <Field label="Tarikh" value={form.tarikh} onChangeText={(v: string) => setForm({ ...form, tarikh: v })} />
      <Field label="Baki Fee Terkini (RM)" value={String(form.bakiFeeTerkini)} onChangeText={(v: string) => setForm({ ...form, bakiFeeTerkini: parseFloat(v) || 0 })} keyboardType="numeric" />
      <Field label="Baki Mileage (RM)" value={String(form.bakiMileage)} onChangeText={(v: string) => setForm({ ...form, bakiMileage: parseFloat(v) || 0 })} keyboardType="numeric" />
      <TouchableOpacity style={[styles.submitBtn, { backgroundColor: C.warn }]} onPress={() => onSave(form)}>
        <Text style={styles.submitBtnText}>Kemaskini</Text>
      </TouchableOpacity>
    </ModalBase>
  );
}

// ─────────────── PaymentHistoryModal ───────────────
function PaymentHistoryModal({ caseData, onClose }: { caseData: Case; onClose: () => void }) {
  const qc = useQueryClient();
  const paymentsQ = useQuery<Payment[]>({
    queryKey: ["payments", caseData.id],
    queryFn: () => apiClient.getPayments(caseData.id),
  });
  const payments = paymentsQ.data || [];
  const total = payments.reduce((s, p) => s + p.amount, 0);

  const deletePayment = useMutation({
    mutationFn: (paymentId: number) => apiClient.deletePayment(paymentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments", caseData.id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const handleDeletePayment = (p: Payment) => {
    Alert.alert("Padam Bayaran", `Padam bayaran ${formatRM(p.amount)} pada ${p.date}?`, [
      { text: "Batal", style: "cancel" },
      {
        text: "Padam",
        style: "destructive",
        onPress: () => deletePayment.mutate(p.id),
      },
    ]);
  };

  return (
    <ModalBase title={`Sejarah: ${caseData.nama}`} onClose={onClose}>
      <View style={styles.bakiInfo}>
        <Text style={styles.bakiInfoLabel}>Baki Terkini</Text>
        <Text style={[styles.bakiInfoVal, { color: C.danger }]}>{formatRM(caseData.bakiFeeTerkini)}</Text>
      </View>
      {total > 0 && (
        <View style={[styles.bakiInfo, { backgroundColor: C.green50, marginBottom: 12 }]}>
          <Text style={styles.bakiInfoLabel}>Jumlah Dibayar</Text>
          <Text style={[styles.bakiInfoVal, { color: C.success }]}>{formatRM(total)}</Text>
        </View>
      )}
      {paymentsQ.isLoading ? (
        <ActivityIndicator color={C.primary} style={{ marginTop: 20 }} />
      ) : payments.length === 0 ? (
        <Text style={styles.emptyText}>Tiada sejarah bayaran</Text>
      ) : (
        payments.map((p) => (
          <View key={p.id} style={styles.paymentRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.paymentDate}>{p.date}</Text>
              <Text style={styles.paymentMethod}>{p.method}</Text>
            </View>
            <Text style={styles.paymentAmount}>{formatRM(p.amount)}</Text>
            <TouchableOpacity
              onPress={() => handleDeletePayment(p)}
              style={styles.paymentDeleteBtn}
            >
              <Text style={styles.paymentDeleteText}>✕</Text>
            </TouchableOpacity>
          </View>
        ))
      )}
    </ModalBase>
  );
}

// ─────────────── Styles ───────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.sidebar, paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  headerSub: { color: "#71717a", fontSize: 10, marginTop: 1 },
  addBtn: { backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  tabBar: { flexDirection: "row", backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border },
  tabItem: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabItemActive: { borderBottomColor: C.primary },
  tabText: { fontSize: 12, color: C.textSub, fontWeight: "600" },
  tabTextActive: { color: C.primary },
  scroll: { flex: 1 },
  tabContent: { padding: 12, gap: 10 },

  // Stat cards
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flex: 1, minWidth: "45%", backgroundColor: C.white,
    borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border,
  },
  statLabel: { fontSize: 11, color: C.textSub, marginBottom: 4, fontWeight: "500" },
  statValue: { fontSize: 17, fontWeight: "800" },

  // Collection progress
  progressRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  progressBar: { flex: 1, height: 8, backgroundColor: "#f4f4f5", borderRadius: 4, overflow: "hidden" },
  progressFill: { height: 8, backgroundColor: C.success, borderRadius: 4 },
  progressLabel: { fontSize: 14, fontWeight: "800", color: C.success, minWidth: 40, textAlign: "right" },
  progressMeta: { flexDirection: "row", justifyContent: "space-between" },
  progressMetaText: { fontSize: 11, color: C.textSub },

  // Chart
  card: { backgroundColor: C.white, borderRadius: 10, padding: 14, borderWidth: 1, borderColor: C.border },
  cardRed: { borderColor: "#fca5a5", backgroundColor: "#fff5f5" },
  cardAmber: { borderColor: "#fcd34d", backgroundColor: "#fffbeb" },
  cardTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: C.text, marginBottom: 12 },
  chartRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  chartLabel: { width: 90, fontSize: 11, color: C.textSub },
  chartBarWrap: { flex: 1, height: 6, backgroundColor: "#f4f4f5", borderRadius: 3, overflow: "hidden" },
  chartBar: { height: 6, backgroundColor: C.primary, borderRadius: 3 },
  chartVal: { fontSize: 11, fontWeight: "700", color: C.text, textAlign: "right", width: 70 },

  // Top records
  topRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  borderBottom: { borderBottomWidth: 1, borderBottomColor: C.border },
  topRank: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.blue50, alignItems: "center", justifyContent: "center" },
  topRankText: { fontSize: 11, fontWeight: "700", color: C.primary },
  topName: { fontSize: 13, fontWeight: "600", color: C.text },
  topKes: { fontSize: 11, color: C.textSub },
  topBaki: { fontSize: 13, fontWeight: "700", color: C.danger },

  // Records tab
  searchRow: { marginBottom: 6 },
  searchInput: {
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border,
    borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, color: C.text,
  },
  filterScroll: { marginBottom: 6 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.border, marginRight: 6,
  },
  chipActive: { backgroundColor: C.primary, borderColor: C.primary },
  chipText: { fontSize: 12, color: C.textSub, fontWeight: "500" },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  countText: { fontSize: 11, color: C.textSub, marginBottom: 4 },
  emptyText: { textAlign: "center", color: C.textSub, marginTop: 40, fontSize: 14 },

  // Case card
  caseCard: {
    backgroundColor: C.white, borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: C.border, marginBottom: 8,
  },
  caseCardHeader: { flexDirection: "row", alignItems: "flex-start" },
  caseName: { fontSize: 15, fontWeight: "700", color: C.text },
  kesBadgeWrap: { marginTop: 4 },
  kesBadge: {
    fontSize: 10, fontWeight: "700", color: C.primary,
    backgroundColor: C.blue50, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4,
    alignSelf: "flex-start",
  },
  bakiLabel: { fontSize: 10, color: C.textSub },
  bakiAmount: { fontSize: 16, fontWeight: "800", color: C.danger, marginTop: 2 },
  caseExpanded: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  detailRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  detailLabel: { fontSize: 12, color: C.textSub },
  detailValue: { fontSize: 12, fontWeight: "600", color: C.text },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 7 },
  actionBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Reports tab
  reportRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 8 },
  reportName: { fontSize: 13, fontWeight: "600", color: C.text },
  reportKes: { fontSize: 11, color: C.textSub, marginTop: 1 },
  reportAmt: { fontSize: 13, fontWeight: "700" },
  kesBreakdownRow: { paddingVertical: 12 },
  kesBreakdownTitle: { fontSize: 13, fontWeight: "700", color: C.text },
  kesBreakdownCount: { fontSize: 11, color: C.textSub },
  kesBreakdownBar: { height: 5, backgroundColor: "#f4f4f5", borderRadius: 3, overflow: "hidden", marginVertical: 6 },
  kesBarFill: { height: 5, backgroundColor: C.primary, borderRadius: 3 },
  kesBreakdownAmts: { flexDirection: "row", justifyContent: "space-between", marginTop: 2 },
  kesAmtLabel: { fontSize: 11, color: C.textSub },
  kesAmtVal: { fontWeight: "600", color: C.text },
  kesRate: { fontSize: 11, fontWeight: "700", color: C.primary, marginTop: 4 },
  totalsRow: {
    marginTop: 12, paddingTop: 12, borderTopWidth: 2, borderTopColor: C.border,
  },
  totalsLabel: { fontSize: 11, fontWeight: "800", color: C.textSub, letterSpacing: 0.5, marginBottom: 6 },
  totalsAmts: { flexDirection: "row", justifyContent: "space-between" },
  totalsItem: { fontSize: 12, color: C.text },

  // Modals
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet: {
    backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 16, fontWeight: "700", color: C.text },
  modalClose: { padding: 4 },
  modalCloseText: { fontSize: 16, color: C.textSub },
  modalBody: { padding: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: C.textSub, marginBottom: 6 },
  fieldInput: {
    borderWidth: 1, borderColor: C.border, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white,
  },
  submitBtn: { borderRadius: 10, paddingVertical: 14, alignItems: "center", marginTop: 8 },
  submitBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Payment
  bakiInfo: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: C.blue50, borderRadius: 8, padding: 12, marginBottom: 14,
  },
  bakiInfoLabel: { fontSize: 12, color: C.textSub },
  bakiInfoVal: { fontSize: 16, fontWeight: "800", color: C.primary },
  methodRow: { flexDirection: "row", gap: 8 },
  methodChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: C.white },
  methodChipActive: { backgroundColor: C.primary, borderColor: C.primary },
  methodChipText: { fontSize: 13, color: C.textSub, fontWeight: "600" },
  methodChipTextActive: { color: "#fff" },

  // Payment history
  paymentRow: {
    flexDirection: "row", alignItems: "center", paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  paymentDate: { fontSize: 13, fontWeight: "600", color: C.text },
  paymentMethod: { fontSize: 11, color: C.textSub, marginTop: 2 },
  paymentAmount: { fontSize: 14, fontWeight: "700", color: C.success, marginRight: 8 },
  paymentDeleteBtn: {
    width: 24, height: 24, borderRadius: 12, backgroundColor: "#fef2f2",
    alignItems: "center", justifyContent: "center",
  },
  paymentDeleteText: { fontSize: 11, color: C.danger, fontWeight: "700" },
});
