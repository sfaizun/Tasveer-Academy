/** Tasveer Academy's circular brand mark — replaces the old coral "TA" placeholder. */
export default function Logo({ size = 32 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo.png"
      alt="Tasveer Academy"
      width={size}
      height={size}
      style={{
        width: size, height: size, flex: `0 0 ${size}px`,
        borderRadius: "50%", objectFit: "cover",
        border: "1px solid var(--line)",
      }}
    />
  );
}
