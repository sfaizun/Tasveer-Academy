import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Opens an expense's attachment. The expense lookup and the storage read both go through
 * row level security, so admin can open any file and a teacher only files on their own
 * expenses. The signed link is short lived and made fresh on every click. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense")
    .select("attachment_path, attachment_name")
    .eq("id", id)
    .maybeSingle();
  if (!data?.attachment_path) {
    return new NextResponse("Attachment not found or you don't have access to it.", { status: 404 });
  }
  const { data: signed, error } = await supabase.storage
    .from("expense-attachments")
    .createSignedUrl(data.attachment_path, 120);
  if (error || !signed?.signedUrl) {
    return new NextResponse("Attachment not found or you don't have access to it.", { status: 404 });
  }
  return NextResponse.redirect(signed.signedUrl);
}
