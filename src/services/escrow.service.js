import { create, updateStatus } from "../repositories/escrow.repository";

  import  {transferService } from "./transfer.service";

class EscrowService {

    async createFromTransaction(transaction) {

        return create({

            property: transaction.property,

            transaction: transaction._id,

            buyer: transaction.buyer,

            seller: transaction.seller,

            agent: transaction.agent,

            amount: transaction.amount

        });

    }

    async markInspectionCompleted(id) {

        return updateStatus(

            id,

            "INSPECTION_COMPLETED"

        );

    }

    async approveBuyer(id) {

        return updateStatus(

            id,

            "BUYER_APPROVED"

        );

    }


async releaseEscrow(
    escrow,
    recipientCode
){

    const transfer =
        await transferService
            .prepareTransfer({

                escrow,

                recipientCode

            });

    await transferService
        .sendTransfer(
            transfer
        );

}

}