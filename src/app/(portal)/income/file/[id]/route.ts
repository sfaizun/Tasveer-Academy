import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Opens an income entry's attachment (admin only, through row level security). The signed
 * link is short lived and made fresh on every click. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("office_income")
    .select("attachment_path")
    .eq("id", id)
    .maybeSingle();
  if (!data?.attachment_path) {
    return new NextResponse("Attachment not found or you don't have access to it.", { status: 404 });
  }
  const { data: signed, error } = await supabase.storage
    .from("income-attachments")
    .createSignedUrl(data.attachment_path, 120);
  if (error || !signed?.signedUrl) {
    return new NextResponse("Attachment not found or you don't have access to it.", { status: 404 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
