// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

/** The part of ERC-20 both legs of a settlement need. ATS securities expose exactly this. */
interface IErc20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/**
 * Delivery versus payment for a receivable issued through Asset Tokenization Studio.
 *
 * ATS is a register: it records who holds a security and what the issuer owes at maturity,
 * and it deliberately knows nothing about what anyone paid. That leaves the purchase as a
 * second, unlinked transfer — the investor can pay and never receive units, or receive units
 * and never be paid. This contract closes that gap by moving both legs inside one
 * transaction, so either the money and the security both move or neither does.
 *
 * Custody is deliberately not taken. Both legs are pulled with `transferFrom` straight from
 * seller to buyer and buyer to seller, so no balance ever rests here: there is nothing to
 * strand if a settlement fails, and no refund path to get wrong.
 *
 * This contract must still be on the security's approved-holder list, because ATS refuses to
 * grant an allowance to an unlisted spender. Being listed is what lets the seller authorise
 * it; the pass-through is what stops it from ever needing to hold what it moves.
 */
contract ReceivableDvp {
    /** One receivable offered for sale on stated terms. */
    struct Offer {
        /** The business selling the receivable. Receives the payment. */
        address seller;
        /** The ATS security being sold. */
        address security;
        /** Units of that security on offer. One unit is one dollar of face value. */
        uint256 units;
        /** The token the buyer pays in, typically USDC. */
        address payment;
        /** Total the buyer pays, in the payment token's own decimals. */
        uint256 price;
        /** False once settled or cancelled. An offer is never reopened. */
        bool open;
    }

    mapping(uint256 => Offer) private offers;
    uint256 private nextId;

    event Offered(
        uint256 indexed id,
        address indexed seller,
        address indexed security,
        uint256 units,
        address payment,
        uint256 price
    );
    event Settled(uint256 indexed id, address indexed buyer, uint256 units, uint256 price);
    event Cancelled(uint256 indexed id);

    error NotOpen();
    error NotSeller();
    error NothingOffered();
    error PaymentLegFailed();
    error DeliveryLegFailed();

    /**
     * Offers `units` of a receivable for `price`, and returns the offer's id.
     *
     * The seller must approve this contract for `units` of `security` before anyone can
     * settle. Approval is not checked here on purpose: the seller may want the offer listed
     * before granting it, and a stale approval would make the check meaningless anyway.
     *
     * @param security - The ATS security being sold
     * @param units - Units of that security, one per dollar of face value
     * @param payment - Token the buyer pays in
     * @param price - Total the buyer pays, in that token's decimals
     * @return id - Identifier the buyer settles against
     */
    function offer(
        address security,
        uint256 units,
        address payment,
        uint256 price
    ) external returns (uint256 id) {
        if (units == 0) revert NothingOffered();

        id = nextId++;
        offers[id] = Offer({
            seller: msg.sender,
            security: security,
            units: units,
            payment: payment,
            price: price,
            open: true
        });

        emit Offered(id, msg.sender, security, units, payment, price);
    }

    /**
     * Buys the offer: pays the seller and receives the units, or reverts having done neither.
     *
     * The caller must have approved this contract for `price` of the payment token. The offer
     * is closed before either transfer runs, so a token that calls back into this contract
     * cannot settle the same offer twice.
     *
     * Payment moves first. If the buyer is not on the security's approved-holder list, the
     * delivery leg reverts and takes the payment with it — the refusal a judge sees is the
     * security's own compliance rule, not a check written here.
     *
     * @param id - The offer to settle
     */
    function settle(uint256 id) external {
        Offer storage sale = offers[id];
        if (!sale.open) revert NotOpen();
        sale.open = false;

        if (!IErc20(sale.payment).transferFrom(msg.sender, sale.seller, sale.price)) {
            revert PaymentLegFailed();
        }
        if (!IErc20(sale.security).transferFrom(sale.seller, msg.sender, sale.units)) {
            revert DeliveryLegFailed();
        }

        emit Settled(id, msg.sender, sale.units, sale.price);
    }

    /** Withdraws an unsettled offer. Only the seller can, and only while it is still open. */
    function cancel(uint256 id) external {
        Offer storage sale = offers[id];
        if (!sale.open) revert NotOpen();
        if (sale.seller != msg.sender) revert NotSeller();

        sale.open = false;
        emit Cancelled(id);
    }

    /** Reads an offer's terms. */
    function offerOf(uint256 id) external view returns (Offer memory) {
        return offers[id];
    }
}
