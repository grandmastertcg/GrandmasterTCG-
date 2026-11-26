import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy notice | GrandmasterTCG"
};

export default function PrivacyPage() {
  return (
    <main className="terms">
      <a href="/">GrandmasterTCG</a>
      <h1>Privacy notice</h1>
      <p>GrandmasterTCG runs the marketplace at grandmastertcg.co.uk. This notice says what the shop keeps, why, and how to ask about it. Last updated 26 November 2026. The <a href="/terms">terms and conditions</a> explain the buying and selling rules.</p>

      <h2>What the shop keeps</h2>
      <p>When you create an account, the shop keeps your email, password through the sign-in service, and the display name buyers see. When you buy a card, Stripe collects the card payment, a billing address, and a UK delivery name and address. The shop keeps the order, the cards in it, the delivery name and address, and the emails it sends about that order. The shop does not keep your card number.</p>
      <p>When you sell a card, the shop keeps the listing, the front and back photos, the price, the condition, and any grader, grade and certificate number you enter. Stripe keeps the payout account you connect. When a buyer pays, the shop shows that seller the delivery name and address so the card can be posted, and keeps the tracking number, courier scans, and payout record.</p>
      <p>The shop also keeps dispute and refund messages, and a record of whether a parcel was posted, delivered, refunded, or paid out.</p>

      <h2>Why</h2>
      <p>The shop uses this information to run your account, take payment, show the seller where to post, pay the seller, refund a parcel, and email you about the order. Stripe processes the card payment and seller payouts. The shop emails from orders@grandmastertcg.co.uk.</p>

      <h2>Who else sees it</h2>
      <p>The seller of a parcel sees the buyer’s delivery name and address, and the cards to post. The buyer sees the seller’s display name, the listing, and the tracking number. Shop admin can see orders, disputes, and refunds. Stripe sees the payment and payout details it needs to move the money. The shop does not sell this information.</p>

      <h2>How long it is kept</h2>
      <p>Account, order, payout, and listing records are kept while the shop needs them to complete the sale, handle a dispute, and keep its accounting records. Photos stay with the listing until the listing is removed.</p>

      <h2>Your choices</h2>
      <p>You can ask what the shop holds about you, ask for a correction, or ask for deletion where the shop does not still need the record for an open order, a refund, or its accounts. Write to <a href="mailto:orders@grandmastertcg.co.uk">orders@grandmastertcg.co.uk</a>. You can also complain to the Information Commissioner’s Office.</p>
    </main>
  );
}
