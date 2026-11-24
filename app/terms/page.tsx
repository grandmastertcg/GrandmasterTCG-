import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and conditions | GrandmasterTCG"
};

export default function TermsPage() {
  return (
    <main className="terms">
      <a href="/">GrandmasterTCG</a>
      <h1>Terms and conditions</h1>
      <p>These terms cover buying and selling on grandmastertcg.co.uk. Creating an account, listing a card, or paying for a card means you accept them. Last updated 24 November 2026.</p>

      <h2>Selling a card</h2>
      <p>Each listing is your own offer. If someone else lists the same card, both listings stay on the market with their own price, condition, photos and seller. The buyer chooses one listing. You are paid only for the listing they buy.</p>
      <p>The price you set is the price the buyer pays, in pounds. GrandmasterTCG keeps 2% of each card, and never more than £100 on one card. Two copies mean the 2% is worked out on each copy. The buyer is not charged the 2% on top of your price.</p>
      <p>You also pay the card processing fee Stripe charges on the payment. That fee is Stripe’s real charge for the buyer’s card, not a fixed rate set by the shop. If the basket includes cards from more than one seller, the fee is split by each seller’s share of the order. Your payout is the sale price, minus the shop’s 2%, minus your share of that card fee. The amount you will receive before the card fee is shown when you set the price. The card fee is shown on the sale after the buyer has paid.</p>
      <p>You are not paid when the buyer checks out. The money stays in the shop’s Stripe account until one of two things happens. The buyer presses “I received this”, and Stripe pays you then. Or 14 days pass after you added the tracking number, the buyer has not pressed that they received it, and they have not opened a dispute or requested a refund. Stripe pays you then. You must connect a Stripe payout account from your account page before a payout can be sent. If you never connect Stripe, the payout waits until the account is ready.</p>
      <p>A dispute or a refund request stops the payout. It stays stopped while that request is open. The shop looks at the request. The shop does not send the card refund itself from this page.</p>

      <h2>Posting the card</h2>
      <p>Every sale must be posted with tracking. You cannot mark a parcel posted without a tracking number. The couriers on the form are Royal Mail, Parcelforce, Evri, DPD, UPS, DHL, FedEx and Other. The tracking number has to be the one for that parcel.</p>
      <p>After the buyer pays, your account shows the UK address to post to, and the cards in that parcel. Post only those cards. A graded card is one slab, so it is listed as a quantity of one.</p>

      <h2>What the listing must say</h2>
      <p>The name, game, set, number, rarity, condition and price must describe the card you are sending. A raw card uses Near Mint, Excellent, Good, Played or Poor. A graded card uses the company on the slab, the grade, and the certificate number. Do not mark a raw card as graded.</p>
      <p>You can add a photo of the front and a photo of the back. If you add photos, they must be of the card in the listing. Photos are a JPG, PNG or WebP under 4 MB each.</p>
      <p>You may list only cards you are allowed to sell. GrandmasterTCG can remove a listing that is misleading, not available, or breaks these terms.</p>

      <h2>Buying a card</h2>
      <p>You need an account to check out. You pay the listed price in pounds through Stripe. Stripe collects a UK delivery address. Sample cards on the shop, shown before live stock loads, cannot be bought.</p>
      <p>When the seller adds tracking, it appears on your account. Press “I received this” only when that parcel has arrived and matches the listing. That pays the seller straight away and cannot be undone in the shop. If you do nothing, the seller is paid 14 days after the tracking number was added. Open a dispute or request a refund before those 14 days if the parcel is missing, damaged, or not the card you bought. That holds the payout. Say what went wrong in the message.</p>

      <h2>The shop’s own cards</h2>
      <p>Some cards are sold by GrandmasterTCG rather than another member. Those sales still need tracking. The payment stays with the shop, because there is no separate seller to pay.</p>

      <h2>Accounts</h2>
      <p>Keep your sign-in details to yourself. The name on your account is the seller name buyers see. You can close a listing from your account while it is still unsold. A card that has already been paid for must still be posted.</p>

      <p>These terms are governed by the laws of England and Wales.</p>
    </main>
  );
}
