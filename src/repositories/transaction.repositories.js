import mongoose from "mongoose";
import Transaction from "../models/transaction.js";
import {findUserById} from "../models/user.models.js"

class TransactionRepository {

    /**
     * ============================================
     * CREATE
     * ============================================
     */

    async create(payload) {
        return await Transaction.create(payload);
    }

    /**
     * ============================================
     * FIND BY ID
     * ============================================
     */

    async findById(id) {
        return await findUserById(id)
            .populate("buyer", "-password")
            .populate("seller", "-password")
            .populate("agent", "-password")
            .populate("property");
    }

    /**
     * ============================================
     * FIND BY REFERENCE
     * ============================================
     */

    async findByReference(reference) {
        return await Transaction.findOne({ reference })
            .populate("buyer", "-password")
            .populate("seller", "-password")
            .populate("agent", "-password")
            .populate("property");
    }

    /**
     * ============================================
     * FIND BY GATEWAY REFERENCE
     * ============================================
     */

    async findByGatewayReference(gatewayReference) {
        return await Transaction.findOne({
            gatewayReference
        });
    }

    /**
     * ============================================
     * UPDATE STATUS
     * ============================================
     */

    async updateStatus(reference, status) {

        return await Transaction.findOneAndUpdate(

            { reference },

            {
                status
            },

            {
                new: true
            }

        );

    }

    /**
     * ============================================
     * UPDATE GATEWAY RESPONSE
     * ============================================
     */

    async updateGatewayResponse(reference, gatewayResponse) {

        return await Transaction.findOneAndUpdate(

            { reference },

            {

                gatewayResponse

            },

            {

                new: true

            }

        );

    }

    /**
     * ============================================
     * SAVE PAYSTACK DATA
     * ============================================
     */

    async saveInitialization(reference, data) {

        return await Transaction.findOneAndUpdate(

            { reference },

            {

                authorizationUrl: data.authorization_url,

                accessCode: data.access_code,

                gatewayReference: data.reference,

                gatewayResponse: data,

                status: "INITIALIZED"

            },

            {

                new: true

            }

        );

    }

    /**
     * ============================================
     * MARK SUCCESS
     * ============================================
     */

    async markSuccessful(reference, gatewayResponse) {

        return await Transaction.findOneAndUpdate(

            {

                reference

            },

            {

                status: "SUCCESS",

                gatewayResponse

            },

            {

                new: true

            }

        );

    }

    /**
     * ============================================
     * MARK FAILED
     * ============================================
     */

    async markFailed(reference, gatewayResponse = {}) {
        return await Transaction.findOneAndUpdate(

            {

                reference

            },

            {

                status: "FAILED",

                gatewayResponse

            },

            {

                new: true

            }

        );

    }

    /**
     * ============================================
     * MARK CANCELLED
     * ============================================
     */

    async markCancelled(reference) {

        return await Transaction.findOneAndUpdate(

            {

                reference

            },

            {

                status: "CANCELLED"

            },

            {

                new: true

            }

        );

    }

    /**
     * ============================================
     * MARK REFUNDED
     * ============================================
     */

    async markRefunded(reference, refundData) {

        return await Transaction.findOneAndUpdate(

            {

                reference

            },

            {

                status: "REFUNDED",

                refund: refundData

            },

            {

                new: true

            }

        );

    }

    /**
     * ============================================
     * PROPERTY TRANSACTIONS
     * ============================================
     */

    async findByProperty(propertyId) {

        return await Transaction.find({

            property: propertyId

        }).sort({

            createdAt: -1

        });

    }

    /**
     * ============================================
     * BUYER HISTORY
     * ============================================
     */

    async findBuyerTransactions(buyerId) {

        return await Transaction.find({

            buyer: buyerId

        }).sort({

            createdAt: -1

        });

    }

    /**
     * ============================================
     * SELLER HISTORY
     * ============================================
     */

    async findSellerTransactions(sellerId) {

        return await Transaction.find({

            seller: sellerId

        }).sort({

            createdAt: -1

        });

    }

    /**
     * ============================================
     * AGENT HISTORY
     * ============================================
     */

    async findAgentTransactions(agentId) {

        return await Transaction.find({

            agent: agentId

        }).sort({

            createdAt: -1

        });

    }

    /**
     * ============================================
     * PENDING
     * ============================================
     */

    async findPendingTransactions() {

        return await Transaction.find({

            status: "PENDING"

        });

    }

    /**
     * ============================================
     * SUCCESSFUL
     * ============================================
     */

    async findSuccessfulTransactions() {

        return await Transaction.find({

            status: "SUCCESS"

        });

    }

    /**
     * ============================================
     * INITIALIZED
     * ============================================
     */

    async findInitializedTransactions() {

        return await Transaction.find({

            status: "INITIALIZED"

        });

    }

    /**
     * ============================================
     * PROCESSING
     * ============================================
     */

    async findProcessingTransactions() {

        return await Transaction.find({

            status: "PROCESSING"

        });

    }

    /**
     * ============================================
     * PAGINATION
     * ============================================
     */

    async paginate({

        page = 1,

        limit = 20,

        filters = {},

        sort = { createdAt: -1 }

    }) {

        const skip = (page - 1) * limit;

        const [rows, total] = await Promise.all([

            Transaction.find(filters)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate("buyer", "-password")
                .populate("seller", "-password")
                .populate("agent", "-password")
                .populate("property"),

            countDocuments(filters)

        ]);

        return {

            rows,

            total,

            page,

            pages: Math.ceil(total / limit),

            limit

        };

    }

    /**
     * ============================================
     * EXISTS
     * ============================================
     */

    async exists(reference) {

        return await Transaction._exists({

            reference

        });

    }

    /**
     * ============================================
     * DELETE
     * (Only for development)
     * ============================================
     */

    async delete(reference) {

        return await Transaction.deleteOne({

            reference

        });

    }

    /**
     * ============================================
     * AGGREGATE TOTAL REVENUE
     * ============================================
     */

    async totalRevenue() {

        const result = await Transaction.aggregate([

            {

                $match: {

                    status: "SUCCESS"

                }

            },

            {

                $group: {

                    _id: null,

                    total: {

                        $sum: "$amount"

                    }

                }

            }

        ]);

        return result[0]?.total || 0;

    }

    /**
     * ============================================
     * TODAY'S REVENUE
     * ============================================
     */

    async todayRevenue() {

        const start = new Date();

        start.setHours(0,0,0,0);

        const end = new Date();

        end.setHours(23,59,59,999);

        const result = await Transaction.aggregate([

            {

                $match: {

                    status: "SUCCESS",

                    createdAt: {

                        $gte: start,

                        $lte: end

                    }

                }

            },

            {

                $group: {

                    _id: null,

                    total: {

                        $sum: "$amount"

                    }

                }

            }

        ]);

        return result[0]?.total || 0;

    }

}

export default new TransactionRepository();