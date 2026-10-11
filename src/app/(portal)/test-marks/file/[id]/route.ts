import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Opens a test mark's attachment. Row level security decides access: admin, the student's
 * teacher for that subject, and the student (or guardian). The signed link lasts 2 minutes. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("test_mark").select("attachment_path").eq("id", id).maybeSingle();
  const notFound = () => new NextResponse("Attachment not found or you don't have access to it.", { status: 404 });
  if (!data?.attachment_path) return notFound();
  const { data: signed, error } = await supabase.storage.from("test-mark-attachments").createSignedUrl(data.attachment_path, 120);
  if (error || !signed?.signedUrl) return notFound();
  return NextResponse.redirect(signed.signedUrl);
}
