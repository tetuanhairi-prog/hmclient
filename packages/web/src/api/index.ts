import { Hono } from "hono";
import { cors } from "hono/cors";
import { db } from "./database";
import * as schema from "./database/schema";
import { eq, inArray, sql, desc } from "drizzle-orm";

const app = new Hono()
  .basePath("api")
  .use(cors({ origin: "*" }))

  .get("/health", (c) => c.json({ status: "ok" }, 200))

  // ── Stats ──
  .get("/stats", async (c) => {
    const all = await db.select().from(schema.cases);
    const totalKes = all.length;
    const totalFee = all.reduce((s, r) => s + r.totalFee, 0);
    const totalBakiTerkini = all.reduce((s, r) => s + r.bakiFeeTerkini, 0);
    const totalMileage = all.reduce((s, r) => s + r.bakiMileage, 0);
    return c.json({ totalKes, totalFee, totalBakiTerkini, totalMileage }, 200);
  })

  // ── Cases CRUD ──
  .get("/cases", async (c) => {
    const rows = await db.select().from(schema.cases);
    return c.json({ cases: rows }, 200);
  })

  .post("/cases", async (c) => {
    const body = await c.req.json();
    const [row] = await db
      .insert(schema.cases)
      .values({
        nama: body.nama,
        kes: body.kes || "Umum",
        totalFee: body.totalFee,
        bayaranTerakhir: body.bayaranTerakhir ?? 0,
        tarikh: body.tarikh,
        bakiSebelum: body.bakiSebelum ?? body.totalFee,
        bakiFeeTerkini: body.bakiFeeTerkini ?? body.totalFee,
        bakiMileage: body.bakiMileage ?? 0,
      })
      .returning();
    return c.json({ case: row }, 201);
  })

  .put("/cases/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const [row] = await db
      .update(schema.cases)
      .set({
        nama: body.nama,
        kes: body.kes,
        totalFee: body.totalFee,
        bayaranTerakhir: body.bayaranTerakhir,
        tarikh: body.tarikh,
        bakiSebelum: body.bakiSebelum,
        bakiFeeTerkini: body.bakiFeeTerkini,
        bakiMileage: body.bakiMileage,
      })
      .where(eq(schema.cases.id, id))
      .returning();
    return c.json({ case: row }, 200);
  })

  .delete("/cases/:id", async (c) => {
    const id = Number(c.req.param("id"));
    await db.delete(schema.payments).where(eq(schema.payments.caseId, id));
    await db.delete(schema.cases).where(eq(schema.cases.id, id));
    return c.json({ success: true }, 200);
  })

  .post("/cases/bulk-delete", async (c) => {
    const { ids } = await c.req.json();
    if (!ids || !Array.isArray(ids) || ids.length === 0)
      return c.json({ success: false }, 400);
    const numIds = ids.map(Number);
    await db.delete(schema.payments).where(inArray(schema.payments.caseId, numIds));
    await db.delete(schema.cases).where(inArray(schema.cases.id, numIds));
    return c.json({ success: true }, 200);
  })

  // ── Payments ──
  .get("/cases/:id/payments", async (c) => {
    const caseId = Number(c.req.param("id"));
    const rows = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.caseId, caseId));
    return c.json({ payments: rows }, 200);
  })

  .post("/cases/:id/payments", async (c) => {
    const caseId = Number(c.req.param("id"));
    const body = await c.req.json();
    const amount = body.amount;
    const method = body.method || "Transfer";
    const date = body.date;

    // Get current case
    const [caseRow] = await db
      .select()
      .from(schema.cases)
      .where(eq(schema.cases.id, caseId));
    if (!caseRow) return c.json({ error: "Case not found" }, 404);

    const newBaki = Math.max(0, caseRow.bakiFeeTerkini - amount);

    // Insert payment
    const [payment] = await db
      .insert(schema.payments)
      .values({ caseId, date, amount, method })
      .returning();

    // Update case
    const [updated] = await db
      .update(schema.cases)
      .set({
        bayaranTerakhir: amount,
        bakiSebelum: caseRow.bakiFeeTerkini,
        bakiFeeTerkini: newBaki,
        tarikh: date,
      })
      .where(eq(schema.cases.id, caseId))
      .returning();

    return c.json({ payment, case: updated }, 201);
  })

  .delete("/payments/:id", async (c) => {
    const paymentId = Number(c.req.param("id"));

    // Get payment first to reverse
    const [payment] = await db
      .select()
      .from(schema.payments)
      .where(eq(schema.payments.id, paymentId));
    if (!payment) return c.json({ error: "Payment not found" }, 404);

    // Reverse the balance
    const [caseRow] = await db
      .select()
      .from(schema.cases)
      .where(eq(schema.cases.id, payment.caseId));
    if (caseRow) {
      await db
        .update(schema.cases)
        .set({ bakiFeeTerkini: caseRow.bakiFeeTerkini + payment.amount })
        .where(eq(schema.cases.id, payment.caseId));
    }

    await db.delete(schema.payments).where(eq(schema.payments.id, paymentId));
    return c.json({ success: true }, 200);
  })

  // ── Chart data ──
  .get("/chart", async (c) => {
    const all = await db.select().from(schema.cases);
    const totals: Record<string, number> = {};
    all.forEach((r) => {
      totals[r.kes] = (totals[r.kes] || 0) + r.bakiFeeTerkini;
    });
    const data = Object.entries(totals)
      .map(([name, baki]) => ({ name, baki }))
      .filter((x) => x.baki > 0)
      .sort((a, b) => b.baki - a.baki);
    return c.json({ chart: data }, 200);
  })

  // ── Seed ──
  .post("/seed", async (c) => {
    const existing = await db.select().from(schema.cases);
    if (existing.length > 0)
      return c.json({ message: "Already seeded" }, 200);

    const seedData = [
      { nama: "Amira", kes: "N.Anak", totalFee: 2500, bayaranTerakhir: 200, tarikh: "17/3/26", bakiSebelum: 970, bakiFeeTerkini: 770, bakiMileage: 0 },
      { nama: "Amir", kes: "Faraid Pusaka", totalFee: 4000, bayaranTerakhir: 800, tarikh: "8/4/2026", bakiSebelum: 2300, bakiFeeTerkini: 1500, bakiMileage: 0 },
      { nama: "Hajar", kes: "Fasakh", totalFee: 4000, bayaranTerakhir: 0, tarikh: "4/5/2026", bakiSebelum: 1700, bakiFeeTerkini: 1700, bakiMileage: 600 },
      { nama: "Hajar", kes: "Rayuan", totalFee: 500, bayaranTerakhir: 0, tarikh: "4/6/2026", bakiSebelum: 500, bakiFeeTerkini: 500, bakiMileage: 300 },
      { nama: "Izwany", kes: "Takliq", totalFee: 3000, bayaranTerakhir: 150, tarikh: "10/3/2026", bakiSebelum: 900, bakiFeeTerkini: 750, bakiMileage: 0 },
      { nama: "Musliha", kes: "HDP", totalFee: 6000, bayaranTerakhir: 300, tarikh: "2/12/2025", bakiSebelum: 500, bakiFeeTerkini: 200, bakiMileage: 0 },
      { nama: "Rashidi", kes: "N.Anak", totalFee: 4500, bayaranTerakhir: 300, tarikh: "2/2/2026", bakiSebelum: 1900, bakiFeeTerkini: 1900, bakiMileage: 0 },
      { nama: "S.Amberi", kes: "Hadhanah", totalFee: 4500, bayaranTerakhir: 250, tarikh: "25/4/26", bakiSebelum: 1000, bakiFeeTerkini: 750, bakiMileage: 0 },
      { nama: "Syafawani", kes: "Fasakh", totalFee: 3500, bayaranTerakhir: 100, tarikh: "2/4/2025", bakiSebelum: 1970, bakiFeeTerkini: 1750, bakiMileage: 0 },
      { nama: "Yazid", kes: "Fasakh", totalFee: 1500, bayaranTerakhir: 100, tarikh: "11/5/2025", bakiSebelum: 750, bakiFeeTerkini: 650, bakiMileage: 0 },
      { nama: "Zainab", kes: "Takliq", totalFee: 3200, bayaranTerakhir: 100, tarikh: "12/1/2026", bakiSebelum: 3200, bakiFeeTerkini: 300, bakiMileage: 50 },
      { nama: "Zulhazlin", kes: "H.Sepencarian", totalFee: 5000, bayaranTerakhir: 850, tarikh: "4/8/2025", bakiSebelum: 3500, bakiFeeTerkini: 2650, bakiMileage: 0 },
      { nama: "Zulhazlin", kes: "Rayuan", totalFee: 15000, bayaranTerakhir: 15000, tarikh: "4/7/2026", bakiSebelum: 15000, bakiFeeTerkini: 15000, bakiMileage: 2600 },
      { nama: "Zul Azrin", kes: "Pusaka", totalFee: 3000, bayaranTerakhir: 300, tarikh: "4/7/2026", bakiSebelum: 1100, bakiFeeTerkini: 800, bakiMileage: 0 },
      { nama: "Nor Riza", kes: "Fasakh", totalFee: 3500, bayaranTerakhir: 200, tarikh: "26/2/26", bakiSebelum: 1500, bakiFeeTerkini: 1300, bakiMileage: 0 },
      { nama: "Hayati", kes: "Hadhanah", totalFee: 4500, bayaranTerakhir: 300, tarikh: "15/2/26", bakiSebelum: 3700, bakiFeeTerkini: 3400, bakiMileage: 0 },
      { nama: "Aswad", kes: "Nafkah Anak", totalFee: 3500, bayaranTerakhir: 300, tarikh: "24/4/26", bakiSebelum: 2800, bakiFeeTerkini: 2200, bakiMileage: 0 },
      { nama: "Rusnani", kes: "Peng. Hibah", totalFee: 4800, bayaranTerakhir: 400, tarikh: "18/1/26", bakiSebelum: 4000, bakiFeeTerkini: 3600, bakiMileage: 0 },
      { nama: "Abu Hassan", kes: "Peng. Hibah", totalFee: 6000, bayaranTerakhir: 1000, tarikh: "4/3/2026", bakiSebelum: 6000, bakiFeeTerkini: 5000, bakiMileage: 0 },
      { nama: "Fatmah", kes: "Fasakh", totalFee: 3500, bayaranTerakhir: 500, tarikh: "26/2/26", bakiSebelum: 3500, bakiFeeTerkini: 3100, bakiMileage: 0 },
      { nama: "Kamal", kes: "Pusaka", totalFee: 4000, bayaranTerakhir: 350, tarikh: "29/4/26", bakiSebelum: 2750, bakiFeeTerkini: 2400, bakiMileage: 0 },
      { nama: "Noriaidawaty", kes: "Fasakh", totalFee: 3500, bayaranTerakhir: 500, tarikh: "13/4/26", bakiSebelum: 3500, bakiFeeTerkini: 3000, bakiMileage: 0 },
      { nama: "Ro'ain", kes: "Fasakh", totalFee: 2500, bayaranTerakhir: 500, tarikh: "4/5/2026", bakiSebelum: 2500, bakiFeeTerkini: 2000, bakiMileage: 0 },
      { nama: "Rusnani", kes: "H.Sepencarian", totalFee: 5000, bayaranTerakhir: 0, tarikh: "4/5/2026", bakiSebelum: 5000, bakiFeeTerkini: 5000, bakiMileage: 0 },
      { nama: "Safwan", kes: "Fasakh", totalFee: 4500, bayaranTerakhir: 0, tarikh: "4/5/2026", bakiSebelum: 4500, bakiFeeTerkini: 4500, bakiMileage: 0 },
      { nama: "Suraya", kes: "U.P.N. Anak", totalFee: 2500, bayaranTerakhir: 600, tarikh: "15/4/26", bakiSebelum: 2500, bakiFeeTerkini: 1900, bakiMileage: 0 },
    ];

    for (const d of seedData) {
      await db.insert(schema.cases).values(d);
    }

    return c.json({ message: "Seeded", count: seedData.length }, 201);
  })

  // ── Receipts ──
  .get("/receipts", async (c) => {
    const rows = await db.select().from(schema.receipts).orderBy(desc(schema.receipts.id));
    return c.json({ receipts: rows }, 200);
  })

  .post("/receipts", async (c) => {
    const body = await c.req.json();
    const [row] = await db
      .insert(schema.receipts)
      .values({
        tarikh: body.tarikh,
        tarikhDisplay: body.tarikhDisplay,
        kategori: body.kategori || "DOKUMEN",
        nama: body.nama,
        alamat: body.alamat || "",
        items: JSON.stringify(body.items || []),
        jumlah: body.jumlah,
        bakiTerdahulu: body.bakiTerdahulu || 0,
        bakiTerkini: body.bakiTerkini || 0,
        butiran: body.butiran || "",
      })
      .returning();
    return c.json({ receipt: row }, 201);
  })

  .put("/receipts/:id", async (c) => {
    const id = Number(c.req.param("id"));
    const body = await c.req.json();
    const [row] = await db
      .update(schema.receipts)
      .set({
        tarikh: body.tarikh,
        tarikhDisplay: body.tarikhDisplay,
        kategori: body.kategori,
        nama: body.nama,
        alamat: body.alamat,
        items: JSON.stringify(body.items || []),
        jumlah: body.jumlah,
        bakiTerdahulu: body.bakiTerdahulu,
        bakiTerkini: body.bakiTerkini,
        butiran: body.butiran,
      })
      .where(eq(schema.receipts.id, id))
      .returning();
    return c.json({ receipt: row }, 200);
  })

  .delete("/receipts/:id", async (c) => {
    const id = Number(c.req.param("id"));
    await db.delete(schema.receipts).where(eq(schema.receipts.id, id));
    return c.json({ success: true }, 200);
  });

export type AppType = typeof app;
export default app;
