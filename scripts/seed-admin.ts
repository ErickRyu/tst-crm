import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config(); // fallback to .env
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { users } from "../src/lib/schema";
import { eq } from "drizzle-orm";

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  // Check if user exists
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    // Update existing
    await db
      .update(users)
      .set({
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        isActive: 1,
        forcePasswordChange: 0,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existing.id));
    console.log(`Updated admin user: ${email} (id=${existing.id})`);
  } else {
    // Create new
    const [created] = await db
      .insert(users)
      .values({
        name: "관리자",
        email,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        isActive: 1,
        forcePasswordChange: 0,
      })
      .returning();
    console.log(`Created admin user: ${email} (id=${created.id})`);
  }

  console.log("Seed complete!");
  process.exit(0);
}

seedAdmin().catch((e) => {
  console.error(e);
  process.exit(1);
});
