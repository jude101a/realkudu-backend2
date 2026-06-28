import { create as _create, findOne, findByIdAndUpdate } from "../models/Escrow";

class EscrowRepository {

    async create(data) {

        return _create(data);

    }

    async findByTransaction(transactionId) {

        return findOne({

            transaction: transactionId

        })

        .populate("buyer seller agent property transaction");

    }

    async findByProperty(propertyId) {

        return findOne({

            property: propertyId

        });

    }

    async updateStatus(id, status) {

        return findByIdAndUpdate(

            id,

            {

                status

            },

            {

                new: true

            }

        );

    }

    async release(id) {

        return findByIdAndUpdate(

            id,

            {

                status: "RELEASED",

                releasedAt: new Date()

            },

            {

                new: true

            }

        );

    }

}

export default
new EscrowRepository();