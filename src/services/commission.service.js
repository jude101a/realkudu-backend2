class CommissionService {

    calculate(amount) {

        const platformPercentage = 2;

        const agentPercentage = 1;

        const platformFee =
            (amount * platformPercentage) / 100;

        const agentCommission =
            (amount * agentPercentage) / 100;

        const payoutAmount =
            amount -
            platformFee -
            agentCommission;

        return {

            platformFee,

            agentCommission,

            payoutAmount

        };

    }

}

module.exports =
new CommissionService();