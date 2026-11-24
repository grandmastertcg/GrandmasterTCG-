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

      <h2>The shop</h2>
      <p>GrandmasterTCG is a UK marketplace for trading cards. Members list their own cards, and some cards are sold by the shop itself. Each listing is one seller’s offer. If someone else lists the same card, both listings stay on the market with their own price, condition, photos and seller. The buyer chooses one listing. Game names and card names are trademarks of their owners.</p>

      <h2>Accounts</h2>
      <p>You need an account to buy or to list a card. The display name on the account is the seller name buyers see. It is between 2 and 40 characters. The password is at least 8 characters. If the shop asks you to confirm your email, do that before you sign in. You can reset the password from the sign-in page. Keep your sign-in details to yourself.</p>

      <h2>Prices and payment</h2>
      <p>Prices are in pounds. The price on the listing is the price the buyer pays. Checkout does not add a postage charge. The seller pays the postage out of what they receive.</p>
      <p>GrandmasterTCG keeps 2% of each card, and never more than £100 on one card. Two copies mean the 2% is worked out on each copy. The buyer is not charged the 2% on top of the price.</p>
      <p>The seller also pays the card processing fee Stripe charges on the payment. That fee is Stripe’s real charge for the buyer’s card, not a fixed rate set by the shop. If the basket includes cards from more than one seller, the fee is split by each seller’s share of the order. A seller’s payout is the sale price, minus the shop’s 2%, minus that seller’s share of the card fee. The amount before the card fee is shown when the seller sets the price. The card fee is shown on the sale after the buyer has paid.</p>
      <p>Stripe takes the payment and asks for a billing address and a UK delivery address. The shop only posts to the United Kingdom. If you leave checkout before you pay, the shop does not take the money. Sample cards shown before live stock loads cannot be bought. If a card is no longer in stock in the quantity you chose, checkout stops.</p>

      <h2>One payment, separate parcels</h2>
      <p>Cards from different sellers in the same basket are paid for together, then split into one parcel per seller. Each parcel has its own tracking number, its own delivery, and its own payout. A problem with one parcel does not by itself change the others.</p>

      <h2>Selling a card</h2>
      <p>You are not paid when the buyer checks out. The money stays with the shop’s Stripe account until the buyer presses “I received this”, or until 2 days after the courier shows the parcel was delivered. A tracking number on its own does not start the payout. You must connect a Stripe payout account from your account page before a payout can be sent. If you never connect Stripe, the payout waits until the account is ready.</p>
      <p>A dispute or a refund request stops the payout. The shop reads the message. If the shop agrees, Stripe refunds the buyer for that parcel and you are not paid. If the shop decides the card was as listed, the request is closed and the normal payout rule applies.</p>
      <p>You can close a listing from your account while it is still unsold. A card that has already been paid for must still be posted. GrandmasterTCG can remove a listing that is misleading, not available, or breaks these terms.</p>

      <h2>What the listing must say</h2>
      <p>You can list Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Lorcana, or Other. The name, set, number, rarity, condition and price must describe the card you are sending. A raw card uses Near Mint, Excellent, Good, Played or Poor. A graded card uses PSA, BGS, CGC, ACE, SGC, TAG or Other, plus the grade, and the certificate number from the slab if it has one. A graded card is one slab, so the quantity is one. Do not mark a raw card as graded. Stock on a raw card is from 1 to 99. The price must be more than zero.</p>
      <p>You can add a photo of the front and a photo of the back. Photos are optional. If you add them, they must be of the card in the listing, as a JPG, PNG or WebP under 4 MB each. You may list only cards you are allowed to sell.</p>

      <h2>Posting the card</h2>
      <p>After the buyer pays, your account shows the UK address for that parcel, and the cards in it. Post only those cards. The buyer does not see that address on the tracking page. Every sale must be posted with tracking. You cannot mark a parcel posted without a tracking number. The couriers on the form are Royal Mail, Parcelforce, Evri, DPD, UPS, DHL, FedEx and Other. The number has to be the one for that parcel.</p>
      <p>Once the number is saved, you and the buyer can both open that parcel and follow where it is. Scans appear after the courier posts them, so a new number can stay blank for a while. You can also open the courier’s own tracker from that page.</p>

      <h2>Buying a card</h2>
      <p>When the seller adds tracking, it appears on your account. Press “I received this” only when that parcel has arrived and matches the listing. That pays the seller straight away. You cannot undo it in the shop, and you cannot open a dispute or request a refund after the seller has been paid. If you do nothing, the seller is paid 2 days after the courier shows the parcel was delivered.</p>
      <p>Open a dispute or request a refund from your account if the parcel is missing, damaged, or not the card you bought, and do it before the seller is paid. Say what went wrong. The message has to be long enough to explain the problem. That holds the payout while the shop looks at it. You cannot press “I received this” while a dispute or refund request is open. If the shop refunds the parcel, the money for that seller’s cards goes back to the card that paid, including the shop’s fee and that parcel’s share of the card fee. If the shop closes the request, the normal payout rule applies.</p>

      <h2>The shop’s own cards</h2>
      <p>Some cards are sold by GrandmasterTCG rather than another member. Those sales still need tracking. The payment stays with the shop, because there is no separate seller to pay. A dispute or refund request on a shop parcel is handled in the same way.</p>

      <h2>What the shop keeps</h2>
      <p>The shop keeps your display name, email, listings, photos, orders, tracking numbers, and the UK delivery name and address Stripe collects. That address is shown to the seller of the parcel so they can post it, and to the shop when the shop is the seller. Stripe handles the card payment. The shop does not show your card number on the account page.</p>

      <p>These terms are governed by the laws of England and Wales.</p>
    </main>
  );
}
