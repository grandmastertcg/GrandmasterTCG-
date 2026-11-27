import { gbp } from "@/lib/catalog";
import { EXTRA_COVER, POSTAGE_SIZES, SPECIAL_DELIVERY } from "@/lib/shipping";

export function PostageRates() {
  return (
    <>
      <table className="postage-rates">
        <caption>UK tracked postage, for a seller’s cards of £75 or under. The buyer pays the online price once for that seller.</caption>
        <thead>
          <tr>
            <th>Size</th>
            <th>Max weight</th>
            <th>Buyer pays</th>
            <th>Post Office</th>
          </tr>
        </thead>
        <tbody>
          {POSTAGE_SIZES.map((size) => (
            <tr key={size.id}>
              <td>{size.label}</td>
              <td>{size.weight}</td>
              <td>{gbp(size.onlinePence)}</td>
              <td>{gbp(size.counterPence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <table className="postage-rates">
        <caption>Special Delivery Guaranteed by 1pm, when that seller’s cards are over £75. This includes cover up to £750 and arrives the next working day by 1pm. A Large Letter under 100g is charged at up to 100g. A thicker parcel, or one over 100g, is charged at up to 500g.</caption>
        <thead>
          <tr>
            <th>Weight</th>
            <th>Buyer pays</th>
          </tr>
        </thead>
        <tbody>
          {SPECIAL_DELIVERY.map((band) => (
            <tr key={band.id}>
              <td>{band.weight}</td>
              <td>{gbp(band.pence)}</td>
            </tr>
          ))}
          {EXTRA_COVER.map((cover) => (
            <tr key={cover.cover}>
              <td>Extra cover up to {cover.cover}, when the cards are over {gbp(cover.overPence)}</td>
              <td>+{gbp(cover.addPence)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
