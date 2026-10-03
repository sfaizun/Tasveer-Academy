"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { CANTEEN_BUCKET } from "@/lib/canteen";

type State = { error?: string; ok?: boolean; savedId?: string } | null;

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Downloads a photo from a web link (e.g. a shop's product image) so it can be stored like
 * an uploaded one. Only public http(s) addresses; must be a JPG, PNG or WebP under 3 MB. */
async function photoFromLink(raw: string): Promise<File | string> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "That photo link isn't a valid web address.";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "The photo link must start with https://.";
  if (/^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|\[)/i.test(u.hostname)) {
    return "That photo link can't be used.";
  }
  try {
    const res = await fetch(u, {
      signal: AbortSignal.timeout(15000),
      redirect: "follow",
      headers: { Accept: "image/jpeg,image/png,image/webp,image/*;q=0.8", "User-Agent": "Mozilla/5.0 (TasveerAcademyPortal)" },
    });
    if (!res.ok) return `Couldn't download the photo from that link (error ${res.status}).`;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!PHOTO_TYPES.includes(type)) return "That link isn't a JPG, PNG or WebP image.";
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_PHOTO_BYTES) return "The photo at that link is larger than 3 MB.";
    if (buf.byteLength === 0) return "The photo link returned an empty file.";
    const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
    return new File([buf], `photo.${ext}`, { type });
  } catch {
    return "Couldn't download the photo from that link. Check the link and try again.";
  }
}

function revalidate() {
  revalidatePath("/canteen");
  revalidatePath("/canteen/menu");
}

function money(raw: FormDataEntryValue | null): number | null | "bad" {
  const v = String(raw ?? "").trim();
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0) return "bad";
  return Math.round(n * 100) / 100;
}

/** Adds or edits a menu item. A price change is saved as a new dated price, so earlier
 * prices stay in history and past sales keep the price they were sold at. */
export async function saveItem(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const category_id = String(formData.get("category_id") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const tags = String(formData.get("tags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
  const is_packaged = formData.get("is_packaged") === "on";
  const track_stock = formData.get("track_stock") === "on";
  const batchRaw = String(formData.get("batch_size") ?? "").trim();
  const batch_size = batchRaw ? Math.floor(Number(batchRaw)) : 1;
  const sell = money(formData.get("sell_price"));
  const cost = money(formData.get("cost_price"));
  const photo = formData.get("photo");
  const removePhoto = formData.get("remove_photo") === "on";
  const photoLink = String(formData.get("photo_url") ?? "").trim();

  if (!name) return { error: "Enter the item's name." };
  if (!category_id) return { error: "Choose a category." };
  if (sell === null) return { error: "Enter the selling price." };
  if (sell === "bad") return { error: "Enter a valid selling price." };
  if (cost === "bad") return { error: "Enter a valid cost price, or leave it blank." };
  if (!Number.isFinite(batch_size) || batch_size < 1) return { error: "Batch size must be 1 or more." };

  let file = photo instanceof File && photo.size > 0 ? photo : null;
  if (!file && photoLink && !removePhoto) {
    const got = await photoFromLink(photoLink);
    if (typeof got === "string") return { error: got };
    file = got;
  }
  if (file) {
    if (!PHOTO_TYPES.includes(file.type)) return { error: "The photo must be a JPG, PNG or WebP image." };
    if (file.size > MAX_PHOTO_BYTES) return { error: "The photo is larger than 3 MB. Please use a smaller one." };
  }

  const supabase = await createClient();
  const fields = { name, category_id, description: description || null, tags, is_packaged, track_stock, batch_size };

  let itemId = id;
  let oldPhoto: string | null = null;

  if (itemId) {
    const { data: current } = await supabase
      .from("canteen_item_current")
      .select("photo_path, sell_price, cost_price")
      .eq("id", itemId)
      .maybeSingle();
    if (!current) return { error: "That item no longer exists." };
    oldPhoto = current.photo_path;

    const { error } = await supabase
      .from("canteen_item")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", itemId);
    if (error) return { error: friendly(error) };

    const priceChanged =
      Number(current.sell_price ?? -1) !== sell ||
      (current.cost_price === null ? null : Number(current.cost_price)) !== cost;
    if (priceChanged) {
      const { error: pErr } = await supabase
        .from("canteen_item_price")
        .insert({ item_id: itemId, sell_price: sell, cost_price: cost });
      if (pErr) return { error: "The item was saved but the new price wasn't: " + pErr.message };
    }
  } else {
    const { data: created, error } = await supabase.from("canteen_item").insert(fields).select("id").single();
    if (error || !created) return { error: friendly(error) };
    itemId = created.id as string;

    const { error: pErr } = await supabase
      .from("canteen_item_price")
      .insert({ item_id: itemId, sell_price: sell, cost_price: cost });
    if (pErr) return { error: "The item was added but its price wasn't saved: " + pErr.message };
  }

  if (file) {
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${itemId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from(CANTEEN_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (upErr) {
      revalidate();
      return { error: "The item was saved but the photo didn't upload: " + upErr.message, savedId: itemId };
    }
    await supabase.from("canteen_item").update({ photo_path: path }).eq("id", itemId);
    if (oldPhoto) await supabase.storage.from(CANTEEN_BUCKET).remove([oldPhoto]);
  } else if (removePhoto && oldPhoto) {
    await supabase.from("canteen_item").update({ photo_path: null }).eq("id", itemId);
    await supabase.storage.from(CANTEEN_BUCKET).remove([oldPhoto]);
  }

  revalidate();
  return { ok: true, savedId: itemId };
}

function friendly(error: { code?: string; message?: string } | null): string {
  if (error?.code === "23505") return "An item with this name is already on the menu.";
  return "Could not save the item: " + (error?.message ?? "unknown error");
}

export async function setItemStock(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const out = formData.get("out_of_stock") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("canteen_item").update({ out_of_stock: out, updated_at: new Date().toISOString() }).eq("id", id);
  revalidate();
}

export async function setItemArchived(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const archived = formData.get("archived") === "true";
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("canteen_item").update({ archived, updated_at: new Date().toISOString() }).eq("id", id);
  revalidate();
}

export async function saveCategory(_prev: State, formData: FormData): Promise<State> {
  const id = String(formData.get("id") ?? "").trim() || null;
  const name = String(formData.get("name") ?? "").trim();
  const sortRaw = String(formData.get("sort") ?? "").trim();
  const sort = sortRaw ? Math.floor(Number(sortRaw)) : 0;
  const active = id ? formData.get("active") === "on" : true;

  if (!name) return { error: "Enter a category name." };
  if (!Number.isFinite(sort)) return { error: "Order must be a number." };

  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("canteen_category").update({ name, sort, active }).eq("id", id)
    : await supabase.from("canteen_category").insert({ name, sort });
  if (error) {
    return { error: error.code === "23505" ? "A category with this name already exists." : "Could not save: " + error.message };
  }
  revalidate();
  return { ok: true };
}
