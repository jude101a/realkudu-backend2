import { create } from "axios";
import logger from "../config/logger.js";
import { secretKey, baseURL } from "../config/paystack.js";

class PaystackClient {
    constructor() {
        this.client = create({
            baseURL,
            timeout: 30000,
            headers: {
                Authorization: `Bearer ${secretKey}`,
                "Content-Type": "application/json",
                Accept: "application/json"
            }
        });

        this.client.interceptors.request.use(
            (config) => {
                info({
                    event: "PAYSTACK_REQUEST",
                    method: config.method?.toUpperCase(),
                    url: config.url,
                    payload: config.data || null
                });

                return config;
            },
            (error) => Promise.reject(error)
        );

        this.client.interceptors.response.use(
            (response) => {
                info({
                    event: "PAYSTACK_RESPONSE",
                    status: response.status,
                    url: response.config.url
                });

                return response;
            },
            (error) => {
                _error({
                    event: "PAYSTACK_ERROR",
                    message: error.message,
                    status: error.response?.status,
                    data: error.response?.data || null
                });

                return Promise.reject(error);
            }
        );
    }

    /**
     * Generic request wrapper
     */
    async request(method, url, data = {}, params = {}) {
        try {
            const response = await this.client({
                method,
                url,
                data,
                params
            });

            return response.data;
        } catch (error) {
            throw this.handleError(error);
        }
    }

    handleError(error) {
        return {
            success: false,
            status: error.response?.status || 500,
            message:
                error.response?.data?.message ||
                error.message ||
                "Paystack request failed",
            data: error.response?.data || null
        };
    }

    /**
     * ==================================================
     * TRANSACTIONS
     * ==================================================
     */

    async initializeTransaction(payload) {
        return this.request(
            "POST",
            "/transaction/initialize",
            payload
        );
    }

    async verifyTransaction(reference) {
        return this.request(
            "GET",
            `/transaction/verify/${reference}`
        );
    }

    async listTransactions(params = {}) {
        return this.request(
            "GET",
            "/transaction",
            {},
            params
        );
    }

    async fetchTransaction(id) {
        return this.request(
            "GET",
            `/transaction/${id}`
        );
    }

    async chargeAuthorization(payload) {
        return this.request(
            "POST",
            "/transaction/charge_authorization",
            payload
        );
    }

    /**
     * ==================================================
     * REFUNDS
     * ==================================================
     */

    async refund(payload) {
        return this.request(
            "POST",
            "/refund",
            payload
        );
    }

    async fetchRefund(id) {
        return this.request(
            "GET",
            `/refund/${id}`
        );
    }

    /**
     * ==================================================
     * TRANSFERS
     * ==================================================
     */

    async createTransferRecipient(payload) {
        return this.request(
            "POST",
            "/transferrecipient",
            payload
        );
    }

    async listTransferRecipients(params = {}) {
        return this.request(
            "GET",
            "/transferrecipient",
            {},
            params
        );
    }

    async initiateTransfer(payload) {
        return this.request(
            "POST",
            "/transfer",
            payload
        );
    }

    async finalizeTransfer(payload) {
        return this.request(
            "POST",
            "/transfer/finalize_transfer",
            payload
        );
    }

    async verifyTransfer(reference) {
        return this.request(
            "GET",
            `/transfer/verify/${reference}`
        );
    }

    /**
     * ==================================================
     * SUBACCOUNTS
     * ==================================================
     */

    async createSubaccount(payload) {
        return this.request(
            "POST",
            "/subaccount",
            payload
        );
    }

    async listSubaccounts(params = {}) {
        return this.request(
            "GET",
            "/subaccount",
            {},
            params
        );
    }

    /**
     * ==================================================
     * SPLIT PAYMENTS
     * ==================================================
     */

    async createSplit(payload) {
        return this.request(
            "POST",
            "/split",
            payload
        );
    }

    async updateSplit(id, payload) {
        return this.request(
            "PUT",
            `/split/${id}`,
            payload
        );
    }

    /**
     * ==================================================
     * CUSTOMERS
     * ==================================================
     */

    async createCustomer(payload) {
        return this.request(
            "POST",
            "/customer",
            payload
        );
    }

    async fetchCustomer(customerCode) {
        return this.request(
            "GET",
            `/customer/${customerCode}`
        );
    }

    /**
     * ==================================================
     * PLANS
     * ==================================================
     */

    async createPlan(payload) {
        return this.request(
            "POST",
            "/plan",
            payload
        );
    }

    async listPlans(params = {}) {
        return this.request(
            "GET",
            "/plan",
            {},
            params
        );
    }

    /**
     * ==================================================
     * SUBSCRIPTIONS
     * ==================================================
     */

    async createSubscription(payload) {
        return this.request(
            "POST",
            "/subscription",
            payload
        );
    }

    async disableSubscription(payload) {
        return this.request(
            "POST",
            "/subscription/disable",
            payload
        );
    }

    /**
     * ==================================================
     * BANKS
     * ==================================================
     */

    async listBanks(country = "nigeria") {
        return this.request(
            "GET",
            "/bank",
            {},
            {
                country
            }
        );
    }

    async resolveAccount(account_number, bank_code) {
        return this.request(
            "GET",
            "/bank/resolve",
            {},
            {
                account_number,
                bank_code
            }
        );
    }

    /**
     * ==================================================
     * CHARGES
     * ==================================================
     */

    async submitOTP(payload) {
        return this.request(
            "POST",
            "/charge/submit_otp",
            payload
        );
    }

    async submitPIN(payload) {
        return this.request(
            "POST",
            "/charge/submit_pin",
            payload
        );
    }

    async submitPhone(payload) {
        return this.request(
            "POST",
            "/charge/submit_phone",
            payload
        );
    }

    async submitBirthday(payload) {
        return this.request(
            "POST",
            "/charge/submit_birthday",
            payload
        );
    }

    async submitAddress(payload) {
        return this.request(
            "POST",
            "/charge/submit_address",
            payload
        );
    }
}

export default new PaystackClient();