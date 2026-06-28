import { create as _create, findOne, findOneAndUpdate } from "../models/Transfer";

class TransferRepository {

    async create(data) {

        return _create(data);

    }

    async findByReference(reference) {

        return findOne({

            reference

        });

    }

    async markSuccess(reference, response) {

        return findOneAndUpdate(

            {

                reference

            },

            {

                status: "SUCCESS",

                gatewayResponse: response

            },

            {

                new: true

            }

        );

    }

    async markFailed(reference, response) {

        return findOneAndUpdate(

            {

                reference

            },

            {

                status: "FAILED",

                gatewayResponse: response

            },

            {

                new: true

            }

        );

    }

}

export default
new TransferRepository();