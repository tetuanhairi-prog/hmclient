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
