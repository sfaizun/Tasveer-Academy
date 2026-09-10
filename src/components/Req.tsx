/** Small coral asterisk appended to a field label to mark it as required. */
export default function Req() {
  return (
    <span aria-hidden="true" style={{ color: "var(--coral)" }}>
      {" "}
      *
    </span>
  );
}
