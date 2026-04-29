import { NextResponse } from "next/server";
import { callGatewayRpc, getGatewayErrorStatus } from "@/lib/gateway-rpc-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawLimit = Number(searchParams.get("limit") ?? "200");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 200;
  try {
    const payload = await callGatewayRpc(request, "orchestrate.logs", { limit });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "gateway rpc failed" },
      { status: getGatewayErrorStatus(err) },
    );
  }
}
