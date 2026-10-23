/**
 * КвизЧе wordmark — "Квиз" in ink with ЧЕ on a teal tile, a nod to the ЗборЧе
 * logo so the two daily games read as a family.
 */
const BRAND = "#2aa99d";

export default function KvizcheLogo({ height = 40 }: { height?: number }) {
  return (
    <span className="inline-flex items-center font-extrabold leading-none" style={{ fontSize: height * 0.72, gap: height * 0.12 }}>
      <span className="text-theme-heading">Квиз</span>
      <span
        className="inline-flex items-center justify-center text-white"
        style={{ background: BRAND, height, padding: `0 ${height * 0.2}px`, borderRadius: height * 0.18 }}
      >
        ЧЕ
      </span>
    </span>
  );
}
