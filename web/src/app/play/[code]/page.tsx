import { HostSession } from "@/components/HostSession";

export default async function PlayPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <HostSession code={code.toUpperCase()} />;
}
