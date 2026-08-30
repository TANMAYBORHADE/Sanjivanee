const bcrypt = require("bcryptjs");
const { prisma } = require("../prisma/client");

async function main() {
  const passwordHash = await bcrypt.hash("changeThisAdminPassword123", 10);
  const admin = await prisma.user.create({
    data: { name: "Admin", email: "admin@sanjeevani.local", role: "ADMIN", passwordHash, isVerified: true },
  });
  console.log("Admin created:", admin.email);
}

main().catch(console.error).finally(() => prisma.$disconnect());

