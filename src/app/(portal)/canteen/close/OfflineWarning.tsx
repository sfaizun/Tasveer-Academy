"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { taka } from "@/lib/format";
import { QUEUE_EVENT, readQueue, type QueuedSale } from "../sell/offlineQueue";

/** On the laptop that sells, warn before closing while offline sales haven't reached the database. */
export default function OfflineWarning() {
  const [queue, setQueue] = useState<QueuedSale[]>([]);
  useEffect(() => {
    const load = () => setQueue(readQueue());
    load();
    window.addEventListener(QUEUE_EVENT, load);
    window.addEventListener("storage", load);
    return () => {
      window.removeEventListener(QUEUE_EVENT, load);
      window.removeEventListener("storage", load);
    };
  }, []);
  if (queue.length === 0) return null;
  return (
    <div className="panel" style={{ padding: "12px 16px", borderColor: "var(--crit)", background: "var(--crit-soft)" }}>
      <b style={{ color: "var(--ink)" }}>
        {queue.length} sale{queue.length === 1 ? "" : "s"} ({taka(queue.reduce((a, q) => a + q.total, 0))}) made offline on this laptop
        {queue.length === 1 ? " hasn't" : " haven't"} been sent yet.
      </b>{" "}
      <span className="sub">
        Open the <Link href="/canteen/sell">Sell</Link> page while connected so they&apos;re sent, before counting the cash and closing.
      </span>
    </div>
  );
}
