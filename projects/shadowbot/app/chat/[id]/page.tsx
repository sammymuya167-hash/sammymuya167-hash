import ShadowBot from "../../shadowbot";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ShadowBot initialBotId={id} />;
}
