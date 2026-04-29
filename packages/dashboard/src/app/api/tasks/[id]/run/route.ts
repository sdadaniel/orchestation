import { NextRequest, NextResponse } from "next/server";
import { callGatewayRpc, getGatewayErrorStatus } from "@/lib/gateway-rpc-server";

export const dynamic = "force-dynamic";

/** POST - start running a single task */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const payload = await callGatewayRpc(req, "task.run", { taskId: id });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "gateway rpc failed" },
      { status: getGatewayErrorStatus(err, 409) },
    );
  }
}

/** GET - get run status for a single task */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const payload = await callGatewayRpc(req, "task.status", { taskId: id });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "gateway rpc failed" },
      { status: getGatewayErrorStatus(err, 400) },
    );
  }
}

/** DELETE - stop a running task */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const payload = await callGatewayRpc(req, "task.stop", { taskId: id });
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { error: (err as { message?: string }).message ?? "gateway rpc failed" },
      { status: getGatewayErrorStatus(err, 409) },
    );
  }
}
