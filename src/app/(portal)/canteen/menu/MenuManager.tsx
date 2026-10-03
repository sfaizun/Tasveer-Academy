"use client";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Req from "@/components/Req";
import { taka, fmtDateTime } from "@/lib/format";
import { photoUrl, type CanteenCategory, type CanteenItem } from "@/lib/canteen";
import { saveCategory, saveItem, setItemArchived, setItemStock } from "./actions";

export type PriceRow = { item_id: string; sell_price: number; cost_price: number | null; effective_from: string };

const inputStyle: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "9px 11px",
  fontSize: 13, background: "var(--paper)", color: "var(--ink)",
  fontFamily: "inherit", width: "100%",
};

function margin(sell: number | null, cost: number | null) {
  if (sell === null || cost === null || Number(sell) <= 0) return null;
  return Math.round(((Number(sell) - Number(cost)) / Number(sell)) * 100);
}

/** Phone photos are often several MB; shrink to at most 900 px on the long side as a JPEG
 * before upload so the menu loads quickly. Falls back to the original if the browser
 * can't read the image (the server still enforces type and the 3 MB limit). */
async function shrinkPhoto(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 900 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

function Thumb({ path, name }: { path: string | null; name: string }) {
  const url = photoUrl(path);
  // eslint-disable-next-line @next/next/no-img-element
  return url ? <img className="cthumb" src={url} alt={name} /> : <span className="cthumb empty">No photo</span>;
}

function ItemForm({
  item,
  categories,
  history,
  isAdmin,
  onDone,
}: {
  item: CanteenItem | null;
  categories: CanteenCategory[];
  history: PriceRow[];
  isAdmin: boolean;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(saveItem, null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl(item?.photo_path));
  const [shrinking, setShrinking] = useState(false);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [sell, setSell] = useState(item?.sell_price != null ? String(Number(item.sell_price)) : "");
  const [cost, setCost] = useState(item?.cost_price != null ? String(Number(item.cost_price)) : "");

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  const choosable = categories.filter((c) => c.active || c.id === item?.category_id);
  const m = margin(sell === "" ? null : Number(sell), cost === "" ? null : Number(cost));

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const original = input.files?.[0];
    if (!original) return;
    setShrinking(true);
    const small = await shrinkPhoto(original);
    const dt = new DataTransfer();
    dt.items.add(small);
    input.files = dt.files;
    setPreview(URL.createObjectURL(small));
    setRemovePhoto(false);
    setShrinking(false);
  }

  return (
    <form action={action} style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
      {item && <input type="hidden" name="id" value={item.id} />}

      <div className="cphoto">
        {preview && !removePhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="Item photo" />
        ) : (
          <span>No photo yet</span>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <label className="btn ghost" style={{ fontSize: 12, padding: "7px 11px", cursor: "pointer" }}>
          {preview && !removePhoto ? "Change photo" : "Add a photo"}
          <input
            ref={fileRef}
            type="file"
            name="photo"
            accept="image/jpeg,image/png,image/webp"
            onChange={onPhoto}
            style={{ display: "none" }}
          />
        </label>
        {item?.photo_path && (
          <label className="sub" style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input
              type="checkbox"
              name="remove_photo"
              checked={removePhoto}
              onChange={(e) => {
                setRemovePhoto(e.target.checked);
                if (e.target.checked && fileRef.current) fileRef.current.value = "";
              }}
            />
            Remove photo
          </label>
        )}
        {shrinking && <span className="sub">Preparing photo…</span>}
      </div>
      {!removePhoto && (
        <input
          style={inputStyle}
          type="url"
          name="photo_url"
          inputMode="url"
          aria-label="Photo link"
          placeholder="Or paste an image link, e.g. from a shop's product page (https://…)"
        />
      )}

      <div className="field">
        <label className="lbl" htmlFor="ci-name">Name<Req /></label>
        <input id="ci-name" style={inputStyle} name="name" required defaultValue={item?.name ?? ""} placeholder="e.g. Chicken roll" />
      </div>
      <div className="field">
        <label className="lbl" htmlFor="ci-cat">Category<Req /></label>
        <select id="ci-cat" style={inputStyle} name="category_id" required defaultValue={item?.category_id ?? ""}>
          <option value="" disabled>Choose…</option>
          {choosable.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div className="field">
          <label className="lbl" htmlFor="ci-sell">Selling price (৳)<Req /></label>
          <input id="ci-sell" style={inputStyle} type="number" name="sell_price" min="0" step="0.01" inputMode="decimal" required value={sell} onChange={(e) => setSell(e.target.value)} />
        </div>
        <div className="field">
          <label className="lbl" htmlFor="ci-cost">Cost price (৳)</label>
          <input id="ci-cost" style={inputStyle} type="number" name="cost_price" min="0" step="0.01" inputMode="decimal" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="What it costs to make or buy" />
        </div>
      </div>
      {isAdmin && m !== null && (
        <div className="sub" style={{ color: m >= 0 ? "var(--ok)" : "var(--crit)" }}>
          Margin {m}% · {taka(Number(sell) - Number(cost))} profit each
        </div>
      )}
      <div className="field">
        <label className="lbl" htmlFor="ci-desc">Description</label>
        <textarea id="ci-desc" style={{ ...inputStyle, minHeight: 56, resize: "vertical" }} name="description" defaultValue={item?.description ?? ""} placeholder="Optional, e.g. with mint chutney" />
      </div>
      <div className="field">
        <label className="lbl" htmlFor="ci-tags">Tags</label>
        <input id="ci-tags" style={inputStyle} name="tags" defaultValue={(item?.tags ?? []).join(", ")} placeholder="e.g. Veg, Spicy (separate with commas)" />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <label className="sub" style={{ display: "flex", gap: 7, alignItems: "flex-start", lineHeight: 1.35 }}>
            <input type="checkbox" name="track_stock" defaultChecked={item?.track_stock ?? true} style={{ marginTop: 2 }} />
            <span>Count stock daily (untick for made-to-order items like tea, which never run out)</span>
          </label>
          <label className="sub" style={{ display: "flex", gap: 7, alignItems: "flex-start", lineHeight: 1.35 }}>
            <input type="checkbox" name="is_packaged" defaultChecked={item?.is_packaged ?? false} style={{ marginTop: 2 }} />
            <span>Packaged item (water, juice…): unsold stock carries over to the next day</span>
          </label>
        </div>
        <div className="field">
          <label className="lbl" htmlFor="ci-batch">Made in batches of</label>
          <input id="ci-batch" style={inputStyle} type="number" name="batch_size" min="1" step="1" defaultValue={item?.batch_size ?? 1} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn" type="submit" disabled={pending || shrinking}>
          {pending ? "Saving…" : item ? "Save changes" : "Add to menu"}
        </button>
        <button className="btn ghost" type="button" onClick={onDone}>Cancel</button>
        {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      </div>

      {item && history.length > 0 && (
        <div style={{ borderTop: "1px solid var(--line2)", paddingTop: 12 }}>
          <div className="lbl" style={{ marginBottom: 6 }}>Price history</div>
          <table className="ctable">
            <tbody>
              {history.map((h, i) => (
                <tr key={h.effective_from + i}>
                  <td className="sub">{fmtDateTime(h.effective_from)}</td>
                  <td className="n mono">{taka(h.sell_price)}</td>
                  <td className="n mono sub">{h.cost_price != null ? `cost ${taka(h.cost_price)}` : "no cost"}</td>
                  <td className="sub">{i === 0 ? "current" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </form>
  );
}

function CategoryRow({ cat, count }: { cat: CanteenCategory; count: number }) {
  const [state, action, pending] = useActionState(saveCategory, null);
  return (
    <form action={action} className="catrow">
      <input type="hidden" name="id" value={cat.id} />
      <input style={inputStyle} name="name" defaultValue={cat.name} aria-label="Category name" required />
      <input style={{ ...inputStyle, width: 70 }} type="number" name="sort" defaultValue={cat.sort} aria-label="Order" title="Order on the menu" />
      <label className="sub" style={{ display: "flex", gap: 6, alignItems: "center", whiteSpace: "nowrap" }}>
        <input type="checkbox" name="active" defaultChecked={cat.active} /> In use
      </label>
      <span className="sub" style={{ whiteSpace: "nowrap" }}>{count} item{count === 1 ? "" : "s"}</span>
      <button className="btn ghost" type="submit" disabled={pending} style={{ fontSize: 12, padding: "6px 10px" }}>
        {pending ? "Saving…" : "Save"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
      {state?.ok && <span className="sub" style={{ color: "var(--ok)" }}>Saved.</span>}
    </form>
  );
}

function NewCategory() {
  const [state, action, pending] = useActionState(saveCategory, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={action} className="catrow">
      <input style={inputStyle} name="name" placeholder="New category, e.g. Desserts" aria-label="New category name" required />
      <input style={{ ...inputStyle, width: 70 }} type="number" name="sort" placeholder="Order" aria-label="Order" />
      <button className="btn" type="submit" disabled={pending} style={{ fontSize: 12, padding: "7px 11px" }}>
        {pending ? "Adding…" : "+ Add category"}
      </button>
      {state?.error && <span className="sub" style={{ color: "var(--crit)" }}>{state.error}</span>}
    </form>
  );
}

export default function MenuManager({
  categories,
  items,
  prices,
  isAdmin,
}: {
  categories: CanteenCategory[];
  items: CanteenItem[];
  prices: PriceRow[];
  isAdmin: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null); // item id, "new", or null
  const [showCats, setShowCats] = useState(false);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const catName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const catOrder = useMemo(() => new Map(categories.map((c, i) => [c.id, i])), [categories]);
  const countByCat = useMemo(() => {
    const m = new Map<string, number>();
    items.filter((i) => !i.archived).forEach((i) => m.set(i.category_id, (m.get(i.category_id) ?? 0) + 1));
    return m;
  }, [items]);
  const archivedCount = items.filter((i) => i.archived).length;

  const shown = items
    .filter((i) => (showArchived ? i.archived : !i.archived))
    .filter((i) => cat === "all" || i.category_id === cat)
    .filter((i) => !q.trim() || i.name.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (catOrder.get(a.category_id) ?? 99) - (catOrder.get(b.category_id) ?? 99) || a.name.localeCompare(b.name));

  const editingItem = editing && editing !== "new" ? items.find((i) => i.id === editing) ?? null : null;
  const history = editingItem ? prices.filter((p) => p.item_id === editingItem.id) : [];
  const close = () => setEditing(null);
  const colCount = isAdmin ? 8 : 7;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {showCats && (
        <div className="panel">
          <div className="phead">
            <div className="ptitle">Categories</div>
            <div className="sub">Order sets where each category appears on the menu and sell screen</div>
            <div className="spacer" />
            <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setShowCats(false)}>Close</button>
          </div>
          <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            {categories.map((c) => (
              <CategoryRow key={c.id} cat={c} count={countByCat.get(c.id) ?? 0} />
            ))}
            <NewCategory />
          </div>
        </div>
      )}

      <div className="canteen-split" data-open={editing ? "1" : "0"}>
        <div className="panel">
          <div className="phead" style={{ flexWrap: "wrap", rowGap: 10 }}>
            <input
              style={{ ...inputStyle, width: 200 }}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search items"
              aria-label="Search items"
            />
            <div className="fchips" role="group" aria-label="Filter by category">
              <button type="button" className={cat === "all" ? "fchip on" : "fchip"} onClick={() => setCat("all")}>All</button>
              {categories.filter((c) => c.active).map((c) => (
                <button key={c.id} type="button" className={cat === c.id ? "fchip on" : "fchip"} onClick={() => setCat(c.id)}>
                  {c.name}
                </button>
              ))}
            </div>
            <div className="spacer" />
            <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "7px 11px" }} onClick={() => setShowCats((v) => !v)}>
              Categories
            </button>
            <button className="btn" type="button" style={{ fontSize: 12, padding: "7px 12px" }} onClick={() => setEditing("new")}>
              + Add item
            </button>
          </div>
          <div className="tblwrap">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Item</th>
                  <th>Category</th>
                  <th className="n">Price</th>
                  <th className="n">Cost</th>
                  {isAdmin && <th className="n">Margin</th>}
                  <th>Available</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((i) => {
                  const m = margin(i.sell_price, i.cost_price);
                  return (
                    <tr key={i.id} className={editing === i.id ? "crow-on" : undefined}>
                      <td style={{ width: 56 }}><Thumb path={i.photo_path} name={i.name} /></td>
                      <td>
                        <b style={{ color: "var(--ink)" }}>{i.name}</b>
                        {(i.tags.length > 0 || i.is_packaged || !i.track_stock) && (
                          <div className="sub" style={{ fontSize: 11.5 }}>
                            {[i.is_packaged ? "Packaged" : null, i.track_stock ? null : "Made to order", ...i.tags].filter(Boolean).join(" · ")}
                          </div>
                        )}
                      </td>
                      <td className="sub">{catName.get(i.category_id) ?? "—"}</td>
                      <td className="n mono">{i.sell_price != null ? taka(i.sell_price) : "—"}</td>
                      <td className="n mono sub">{i.cost_price != null ? taka(i.cost_price) : "—"}</td>
                      {isAdmin && <td className="n mono sub">{m !== null ? `${m}%` : "—"}</td>}
                      <td>
                        {i.archived ? (
                          <span className="st due"><span className="dot" />Archived</span>
                        ) : (
                          <form action={setItemStock}>
                            <input type="hidden" name="id" value={i.id} />
                            <input type="hidden" name="out_of_stock" value={i.out_of_stock ? "false" : "true"} />
                            <button
                              type="submit"
                              className={i.out_of_stock ? "cswitch" : "cswitch on"}
                              aria-pressed={!i.out_of_stock}
                              title={i.out_of_stock ? "Mark back in stock" : "Mark out of stock"}
                            >
                              <i />{i.out_of_stock ? "Out of stock" : "In stock"}
                            </button>
                          </form>
                        )}
                      </td>
                      <td className="n" style={{ whiteSpace: "nowrap" }}>
                        {!i.archived && (
                          <button className="btn ghost" type="button" style={{ fontSize: 12, padding: "6px 10px" }} onClick={() => setEditing(i.id)}>
                            Edit
                          </button>
                        )}{" "}
                        <form action={setItemArchived} style={{ display: "inline" }}>
                          <input type="hidden" name="id" value={i.id} />
                          <input type="hidden" name="archived" value={i.archived ? "false" : "true"} />
                          <button className="btn ghost" type="submit" style={{ fontSize: 12, padding: "6px 10px" }}>
                            {i.archived ? "Restore" : "Archive"}
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={colCount} className="sub" style={{ padding: 18 }}>
                      {showArchived
                        ? "No archived items."
                        : items.filter((i) => !i.archived).length === 0
                          ? "The menu is empty. Use “+ Add item” to add the first one."
                          : "No items match this search or category."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--line2)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="linkbtn" onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? "Back to the menu" : `Show archived items (${archivedCount})`}
            </button>
            <span className="sub">Archiving takes an item off the menu but keeps its history; nothing is ever deleted.</span>
          </div>
        </div>

        {editing && (
          <div className="panel">
            <div className="phead">
              <div className="ptitle">{editingItem ? `Edit ${editingItem.name}` : "Add item"}</div>
            </div>
            <ItemForm
              key={editing}
              item={editingItem}
              categories={categories}
              history={history}
              isAdmin={isAdmin}
              onDone={close}
            />
          </div>
        )}
      </div>
    </div>
  );
}
