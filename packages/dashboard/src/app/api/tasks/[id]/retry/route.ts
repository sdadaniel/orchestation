import { NextRequest, NextResponse } from "next/server";
import { callGatewayRpc, getGatewayErrorStatus } from "@/lib/gateway-rpc-server";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const payload = await callGatewayRpc(req, "task.retry", { taskId: id });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "gateway rpc failed" },
      { status: getGatewayErrorStatus(err, 409) },
    );
  }
}
