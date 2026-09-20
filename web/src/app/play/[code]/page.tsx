import { HostSession } from "@/components/HostSession";

export default async function PlayPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ g?: string }>;
}) {
  const { code } = await params;
  const { g } = await searchParams;
  return <HostSession code={code.toUpperCase()} initialGameId={g} />;
}
