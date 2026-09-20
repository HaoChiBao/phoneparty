import { ControllerPad } from "@/components/ControllerPad";

export default async function ControllerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ControllerPad code={code.toUpperCase()} />;
}
