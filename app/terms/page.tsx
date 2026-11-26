import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms and conditions | GrandmasterTCG"
};

export default function TermsPage() {
  return (
    <main className="terms">
      <a href="/">GrandmasterTCG</a>
      <h1>Terms and conditions</h1>
      <p>These terms cover buying and selling on grandmastertcg.co.uk. GrandmasterTCG runs the marketplace. Questions about an order, a listing, or your information go to <a href="mailto:orders@grandmastertcg.co.uk">orders@grandmastertcg.co.uk</a>. Creating an account, listing a card, or paying for a card means you accept these terms and the <a href="/privacy">privacy notice</a>. Last updated 26 November 2026.</p>

      <h2>Who runs the shop</h2>
      <p>GrandmasterTCG runs the marketplace at grandmastertcg.co.uk. Orders and questions go to <a href="mailto:orders@grandmastertcg.co.uk">orders@grandmastertcg.co.uk</a>. Cards sold under the name GrandmasterTCG are sold by the shop. Cards sold under a member’s display name are sold by that member.</p>

      <h2>The shop</h2>
      <p>GrandmasterTCG is a UK marketplace for trading cards. Members list their own cards, and some cards are sold by the shop itself. Each listing is one seller’s offer. If someone else lists the same card, both listings stay on the market with their own price, condition, photos and seller. The buyer chooses one listing. Game names and card names are trademarks of their owners.</p>

      <h2>Accounts</h2>
      <p>You need an account to buy or to list a card. The display name on the account is the seller name buyers see. It is between 2 and 40 characters. The password is at least 8 characters. If the shop asks you to confirm your email, do that before you sign in. You can reset the password from the sign-in page. Keep your sign-in details to yourself.</p>

      <h2>Prices and payment</h2>
      <p>Prices are in pounds. The price on the listing is the price the buyer pays. Checkout does not add a postage charge. The seller pays the postage out of what they receive.</p>
      <p>GrandmasterTCG keeps 2% of each card, and never more than £100 on one card. Two copies mean the 2% is worked out on each copy. The buyer is not charged the 2% on top of the price.</p>
      <p>The seller also pays the card processing fee Stripe charges on the payment. That fee is Stripe’s real charge for the buyer’s card, not a fixed rate set by the shop. If the basket includes cards from more than one seller, the fee is split by each seller’s share of the order. A seller’s payout is the sale price, minus the shop’s 2%, minus that seller’s share of the card fee. The amount before the card fee is shown when the seller sets the price. The card fee is shown on the sale after the buyer has paid.</p>
      <p>Stripe takes the payment and asks for a billing address and a UK delivery address. The shop only posts to the United Kingdom. If you leave checkout before you pay, the shop does not take the money. Sample cards shown before live stock loads cannot be bought. If a card is no longer in stock in the quantity you chose, checkout stops. If two buyers pay for the last copy, the later parcel is refunded to the card that paid and the seller is not paid for it.</p>

      <h2>One payment, separate parcels</h2>
      <p>Cards from different sellers in the same basket are paid for together, then split into one parcel per seller. Each parcel has its own tracking number, its own delivery, and its own payout. A problem with one parcel does not by itself change the others.</p>

      <h2>Selling a card</h2>
      <p>You are not paid when the buyer checks out. The money stays with the shop’s Stripe account until an hour after the buyer presses “I received this”, or until 2 days after the courier shows the parcel was delivered. The buyer can undo that confirmation during the hour. A tracking number on its own does not start the payout. If the courier still has not shown the parcel delivered 7 days after you added tracking, the shop emails the buyer once. If they do not confirm it or open a dispute within 2 days of that email, you are paid. You must connect a Stripe payout account from your account page before a payout can be sent. If you never connect Stripe, the payout waits until the account is ready. Stripe emails the buyer a receipt. The sale shows on your account as soon as the payment is confirmed, and the shop emails you the cards and the delivery address. If the tracking number is still missing after 3 days, the shop emails you again. You have until 5 days after payment to add it. After that the buyer is refunded and you are not paid.</p>
      <p>A dispute or a refund request stops the payout. The shop reads the message. If the shop agrees, Stripe refunds the buyer for that parcel and you are not paid. If the shop decides the card was as listed, the request is closed and the normal payout rule applies.</p>
      <p>You can change the price of a listing from your account while it is still unsold. On a raw card you can also change the condition and how many copies are for sale. The photos stay as they were. You can close a listing from your account while it is still unsold. A card that has already been paid for must still be posted. GrandmasterTCG can remove a listing that is misleading, not available, or breaks these terms.</p>

      <h2>What the listing must say</h2>
      <p>You can list Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Lorcana, or Other. The name, set, number, rarity, condition and price must describe the card you are sending. A raw card uses Near Mint, Excellent, Good, Played or Poor. A graded card uses PSA, BGS, CGC, ACE, SGC, TAG or Other, plus the grade, and the certificate number from the slab if it has one. A graded card is one slab, so the quantity is one. Do not mark a raw card as graded. Stock on a raw card is from 1 to 99. The price must be more than zero.</p>
      <p>Every listing needs a photo of the front and a photo of the back. The photos must be of the card in the listing, as a JPG, PNG or WebP under 4 MB each. You may list only cards you are allowed to sell.</p>

      <h2>Posting the card</h2>
      <p>After the buyer pays, your account shows the UK address for that parcel, and the cards in it. Post only those cards. The buyer does not see that address on the tracking page. Add a tracking number within 5 days of the payment. You cannot mark a parcel posted without a tracking number. If those 5 days pass with no tracking number, the buyer is refunded for that parcel and you are not paid. Adding a tracking number before the refund is sent still lets the normal payout rule apply. The couriers on the form are Royal Mail, Parcelforce, Evri, DPD, UPS, DHL, FedEx and Other. The number has to be the one for that parcel.</p>
      <p>Once the number is saved, you and the buyer can both open that parcel and follow where it is. Scans appear after the courier posts them, so a new number can stay blank for a while. You can also open the courier’s own tracker from that page.</p>

      <h2>Private sellers and business sellers</h2>
      <p>Every member listing says whether the seller is a private seller or a business. A private seller is selling their own card and is not selling in the course of a business. A business seller is selling as a business. The shop’s own cards are business sales. A seller chooses this when they list the card, and they can change it while the listing is still for sale.</p>

      <h2>Cancelling a business sale</h2>
      <p>When you buy from a business seller, or from GrandmasterTCG, you can cancel for any reason within 14 days after the day the parcel arrives. Email <a href="mailto:orders@grandmastertcg.co.uk">orders@grandmastertcg.co.uk</a> or open a refund request on your account before the seller is paid. Send the card back in the same condition. You pay the return postage, unless the card was not as listed. The price of that parcel is refunded to the card that paid, including the shop’s fee and that parcel’s share of the card fee, within 14 days of the shop receiving the card back. This right is separate from the payout hold. A term about when the seller is paid does not remove it.</p>
      <p>A private sale does not have that 14-day cancellation right. The card still has to match the listing. You can open a dispute or a refund request before the seller is paid if it does not.</p>

      <h2>Buying a card</h2>
      <p>When the seller adds tracking, the shop emails you the number and it appears on your account. Press “I received this” only when that parcel has arrived and matches the listing. You can undo that for an hour. The seller is paid after the hour. You cannot open a dispute or request a refund after the seller has been paid. If you do nothing, the seller is paid 2 days after the courier shows the parcel was delivered. The shop emails you when that delivery scan appears. If the courier still has not shown a delivery 7 days after the tracking number was added, the shop emails you once. Confirm the parcel or open a dispute within 2 days of that email. If you do neither, the seller is paid.</p>
      <p>Open a dispute or request a refund from your account if the parcel is missing, damaged, or not the card you bought, and do it before the seller is paid. Say what went wrong. The message has to be long enough to explain the problem. That holds the payout while the shop looks at it, and the shop is emailed about the request. You cannot press “I received this” while a dispute or refund request is open. If the shop refunds the parcel, the money for that seller’s cards goes back to the card that paid, including the shop’s fee and that parcel’s share of the card fee. If the shop closes the request, the normal payout rule applies.</p>

      <h2>The shop’s own cards</h2>
      <p>Some cards are sold by GrandmasterTCG rather than another member. Those sales still need tracking. The payment stays with the shop, because there is no separate seller to pay. A dispute or refund request on a shop parcel is handled in the same way.</p>

      <h2>What the shop keeps</h2>
      <p>The shop keeps your display name, email, listings, photos, orders, tracking numbers, and the UK delivery name and address Stripe collects. That address is shown to the seller of the parcel so they can post it, and to the shop when the shop is the seller. The seller’s sale email includes that address so they can post the card. Stripe handles the card payment and emails the buyer a receipt. The shop does not show your card number on the account page.</p>

      <p>These terms are governed by the laws of England and Wales.</p>
    </main>
  );
}
