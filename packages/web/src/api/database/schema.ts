import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const cases = sqliteTable("cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nama: text("nama").notNull(),
  kes: text("kes").notNull(),
  totalFee: real("total_fee").notNull(),
  bayaranTerakhir: real("bayaran_terakhir").notNull().default(0),
  tarikh: text("tarikh").notNull(),
  bakiSebelum: real("baki_sebelum").notNull().default(0),
  bakiFeeTerkini: real("baki_fee_terkini").notNull().default(0),
  bakiMileage: real("baki_mileage").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const payments = sqliteTable("payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id")
    .notNull()
    .references(() => cases.id, { onDelete: "cascade" }),
  date: text("date").notNull(),
  amount: real("amount").notNull(),
  method: text("method").notNull().default("Transfer"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const receipts = sqliteTable("receipts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  tarikh: text("tarikh").notNull(),
  tarikhDisplay: text("tarikh_display").notNull(),
  kategori: text("kategori").notNull().default("DOKUMEN"),
  nama: text("nama").notNull(),
  alamat: text("alamat").notNull().default(""),
  items: text("items").notNull().default("[]"), // JSON string
  jumlah: real("jumlah").notNull().default(0),
  bakiTerdahulu: real("baki_terdahulu").notNull().default(0),
  bakiTerkini: real("baki_terkini").notNull().default(0),
  butiran: text("butiran").notNull().default(""),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
