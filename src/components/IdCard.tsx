import QRCode from "qrcode";
import { code128Path } from "@/lib/barcode";
import { fmtDate } from "@/lib/format";

export type IdCardData = {
  academy: { name: string; address: string; phone: string };
  links: { portal: string; facebook: string; instagram: string };
  student: {
    name: string; regNo: string; programme: string; subjects: string; admittedOn: string | null;
    phone: string | null; school: string | null; address: string | null;
  };
  guardian: { name: string; relation: string | null; phone: string | null } | null;
  issueNo: number;
};

const LOGO = "/logo.png";

async function qr(url: string) {
  return QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#1d1b1aff", light: "#ffffff00" } });
}

const host = (u: string) => u.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
const handle = (u: string) => "@" + (host(u).split("/")[1] ?? host(u));

/** The student ID card, front and back, drawn at 400 x 634 px (portrait CR80, the bank-card size).
 * Print scales each side to exactly 54 x 85.6 mm (globals.css, .idc). */
export default async function IdCard({ d }: { d: IdCardData }) {
  const bar = code128Path(d.student.regNo);
  const codes = [
    { label: "Portal app", url: d.links.portal, sub: host(d.links.portal) },
    { label: "Facebook", url: d.links.facebook, sub: host(d.links.facebook).split("/")[1] || host(d.links.facebook) },
    { label: "Instagram", url: d.links.instagram, sub: handle(d.links.instagram) },
  ].filter((c) => c.url);
  const svgs = await Promise.all(codes.map((c) => qr(c.url)));
  const s = d.student;

  return (
    <div className="idc-pair">
      <div className="idc-box">
        <div className="idc" aria-label="ID card front">
          <div className="idc-head">
            <div className="idc-brand">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={LOGO} alt="" className="idc-logo" />
              <div>
                <div className="idc-name">{d.academy.name.toUpperCase()}</div>
                <div className="idc-tag">IGCSE &amp; IAL · CLASS 1 TO 8</div>
              </div>
            </div>
            <div className="idc-addr">{d.academy.address}<br />{d.academy.phone}</div>
          </div>
          <div className="idc-mid">
            <div className="idc-kicker">STUDENT ID CARD</div>
            <div className="idc-student">{s.name}</div>
            <div className="idc-prog">{[s.programme, s.subjects].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="idc-facts">
            <div><div className="idc-k">STUDENT ID</div><div className="idc-v idc-mono">{s.regNo}</div></div>
            <div><div className="idc-k">ADMITTED</div><div className="idc-v">{s.admittedOn ? fmtDate(s.admittedOn) : "-"}</div></div>
            <div><div className="idc-k">MOBILE</div><div className="idc-v">{s.phone || "-"}</div></div>
            <div><div className="idc-k">SCHOOL</div><div className="idc-v">{s.school || "-"}</div></div>
          </div>
          <div className="idc-bar">
            <svg width="260" height="54" viewBox={`0 0 ${bar.width} 1`} preserveAspectRatio="none" role="img" aria-label={`Barcode of student ID ${s.regNo}`} shapeRendering="crispEdges">
              <path d={bar.d} fill="#1d1b1a" />
            </svg>
            <div className="idc-mono idc-barno">{s.regNo}{d.issueNo > 1 ? ` · card ${d.issueNo}` : ""}</div>
          </div>
          <div className="idc-foot" />
        </div>
      </div>

      <div className="idc-box">
        <div className="idc" aria-label="ID card back">
          <div className="idc-head2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={LOGO} alt="" className="idc-logo2" />
            <div className="idc-name2">{d.academy.name.toUpperCase()}</div>
            <div className="idc-mono idc-id2">{s.regNo}</div>
          </div>
          <div className="idc-sec">
            <div className="idc-kicker">GUARDIAN</div>
            <div className="idc-rows">
              <div><span className="idc-k">NAME</span><b>{d.guardian?.name ?? "-"}</b></div>
              <div><span className="idc-k">RELATION</span><span>{d.guardian?.relation ? d.guardian.relation.charAt(0).toUpperCase() + d.guardian.relation.slice(1) : "-"}</span></div>
              <div><span className="idc-k">PHONE</span><span>{d.guardian?.phone || "-"}</span></div>
            </div>
            <div className="idc-kicker" style={{ marginTop: 4 }}>STUDENT ADDRESS</div>
            <div className="idc-saddr">{s.address || "-"}</div>
          </div>
          {codes.length > 0 && (
            <div className="idc-codes">
              <div className="idc-kicker" style={{ textAlign: "center" }}>SCAN TO CONNECT</div>
              <div className="idc-qrs" style={{ gridTemplateColumns: `repeat(${codes.length}, minmax(0, 1fr))` }}>
                {codes.map((c, i) => (
                  <div key={c.label} className="idc-qr">
                    <div className="idc-qrbox" role="img" aria-label={`QR code: ${c.label}`} dangerouslySetInnerHTML={{ __html: svgs[i] }} />
                    <div className="idc-qrl">{c.label}</div>
                    <div className="idc-qrs2">{c.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="idc-return">
            <b>If found, please return to {d.academy.name}</b>
            <span>{d.academy.address} · {d.academy.phone}</span>
            <span className="idc-small">This card belongs to {d.academy.name} and is not transferable.</span>
          </div>
          <div className="idc-foot" />
        </div>
      </div>
    </div>
  );
}
