import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
import bcrypt from "bcryptjs";
import { db } from "../src/lib/db";
import { users } from "../src/lib/schema";
import { eq, isNull } from "drizzle-orm";

const DEFAULT_PASSWORD = "tst1234!";

const USER_UPDATES: Record<string, { email: string; role: string }> = {
  김상담: { email: "kim@tst-crm.com", role: "COUNSELOR" },
  박원장: { email: "park@tst-crm.com", role: "HOSPITAL_STAFF" },
  이매니저: { email: "lee@tst-crm.com", role: "COUNSELOR" },
};

async function seedUsers() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  const allUsers = await db.select().from(users);

  for (const user of allUsers) {
    const update = USER_UPDATES[user.name];
    if (!update) continue;

    await db
      .update(users)
      .set({
        email: user.email || update.email,
        passwordHash: user.passwordHash || passwordHash,
        role: update.role,
        status: "ACTIVE",
        forcePasswordChange: 1,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    console.log(`✓ ${user.name} → ${user.email || update.email} (${update.role}, forcePasswordChange=1)`);
  }

  console.log(`\n임시 비밀번호: ${DEFAULT_PASSWORD}`);
  console.log("첫 로그인 시 비밀번호 변경이 강제됩니다.");
  process.exit(0);
}

seedUsers().catch((e) => {
  console.error(e);
  process.exit(1);
});
