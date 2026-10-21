import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Opens one homework file. Row level security decides access: the student (and guardians), the
 * subject teacher and admins with Homework. The link lasts 2 minutes. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("homework_file").select("path, name").eq("id", id).maybeSingle();
  const notFound = () => new NextResponse("File not found or you don't have access to it.", { status: 404 });
  if (!data?.path) return notFound();
  const download = req.nextUrl.searchParams.get("download") === "1" ? data.name : undefined;
  const { data: signed, error } = await supabase.storage.from("homework-files").createSignedUrl(data.path, 120, download ? { download } : undefined);
  if (error || !signed?.signedUrl) return notFound();
  return NextResponse.redirect(signed.signedUrl);
}
