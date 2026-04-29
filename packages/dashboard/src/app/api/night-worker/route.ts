import { NextRequest, NextResponse } from "next/server";
import { callGatewayRpc, getGatewayErrorStatus } from "@/lib/gateway-rpc-server";

export const dynamic = "force-dynamic";

/** GET — 상태 + 로그 반환 */
export async function GET(request: Request) {
  try {
    const payload = await callGatewayRpc(request, "night-worker.status");
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "gateway rpc failed" },
      { status: getGatewayErrorStatus(err) },
    );
  }
}

/** POST — Night Worker 시작 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { until, budget, maxTasks, types, instructions } = body;
  try {
    const payload = await callGatewayRpc(req, "night-worker.run", {
      until,
      budget: budget || null,
      maxTasks,
      types: types || undefined,
      instructions,
    });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "gateway rpc failed" },
      { status: getGatewayErrorStatus(err) },
    );
  }
}

/** DELETE — Night Worker 중지 */
export async function DELETE(request: Request) {
  try {
    const payload = await callGatewayRpc(request, "night-worker.stop");
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "gateway rpc failed" },
      { status: getGatewayErrorStatus(err) },
    );
  }
}
