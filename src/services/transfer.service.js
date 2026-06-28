import { initiateTransfer } from "../utils/paystack";

import { randomBytes } from "crypto";

import { create } from "../repositories/transfer.repository";

import { calculate } from "./commission.service";

class TransferService {

    generateReference() {

        return `TRF-${Date.now()}-${randomBytes(4)
            .toString("hex")
            .toUpperCase()}`;

    }

    async prepareTransfer({

        escrow,

        recipientCode

    }) {

        const fees =
            calculate(

                escrow.amount

            );

        const reference =
            this.generateReference();

        return create({

            escrow: escrow._id,

            seller: escrow.seller,

            recipientCode,

            amount: escrow.amount,

            platformFee:
                fees.platformFee,

            agentCommission:
                fees.agentCommission,

            payoutAmount:
                fees.payoutAmount,

            reference

        });

    }

    async sendTransfer(transfer) {

        const response =
            await initiateTransfer({

                source: "balance",

                amount:
                    transfer.payoutAmount * 100,

                recipient:
                    transfer.recipientCode,

                reason:
                    "RealKudu Property Settlement",

                reference:
                    transfer.reference

            });

        return response;

    }

}

export default
new TransferService();