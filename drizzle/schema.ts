import { mysqlTable, mysqlSchema, AnyMySqlColumn, bigint, varchar, mysqlEnum } from "drizzle-orm/mysql-core"
import { sql } from "drizzle-orm"

export const users = mysqlTable("users", {
	id: bigint({ mode: "number", unsigned: true }).autoincrement().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	username: varchar({ length: 255 }).notNull(),
	email: varchar({ length: 255 }).notNull(),
	password: varchar({ length: 255 }).notNull(),
	refreshToken: varchar("refresh_token", { length: 255 }),
	status: mysqlEnum(['ACTIVE','LOCKED']).default('ACTIVE'),
});
