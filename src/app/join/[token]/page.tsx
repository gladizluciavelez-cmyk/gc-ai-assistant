import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SignInButton } from "@/components/AuthButton";
import { JoinTeamButton } from "@/components/JoinTeamButton";

export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: { token: string } }) {
  const invite = await prisma.invite.findUnique({
    where: { token: params.token },
    include: { org: { select: { name: true } } },
  });
  const valid = invite && !invite.acceptedAt && invite.expiresAt > new Date();
  const session = await getServerSession(authOptions);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
        {!valid ? (
          <>
            <h1 className="text-xl font-semibold">This invite can&apos;t be used</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              It may have expired, been revoked, or already been accepted. Ask the person who invited
              you to send a new link.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Join {invite.org.name}</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              You&apos;ve been invited to share this company&apos;s bids, projects and inbox.
              {invite.email && ` This invite is for ${invite.email}.`}
            </p>
            <div className="mt-6">
              {session?.user ? (
                <JoinTeamButton token={params.token} orgName={invite.org.name} />
              ) : (
                <SignInButton callbackUrl={`/join/${params.token}`} />
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
