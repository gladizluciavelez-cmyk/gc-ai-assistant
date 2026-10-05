import { prisma } from "@/lib/prisma";

// Kept separate from org.ts so auth.ts can use it without an import cycle.
/** Creates a new organization with this user as its owner. */
export async function createSoloOrg(userId: string, name?: string | null, email?: string | null) {
  const org = await prisma.organization.create({
    data: { name: name ? `${name}'s company` : email ?? "My company" },
  });
  await prisma.user.update({ where: { id: userId }, data: { orgId: org.id, role: "OWNER" } });
  return org.id;
}
