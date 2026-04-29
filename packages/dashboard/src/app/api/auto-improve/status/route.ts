import { NextResponse } from "next/server";
import { callGatewayRpc, getGatewayErrorStatus } from "@/lib/gateway-rpc-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const payload = await callGatewayRpc(request, "auto-improve.status");
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "gateway rpc failed" },
      { status: getGatewayErrorStatus(err) },
    );
  }
}
