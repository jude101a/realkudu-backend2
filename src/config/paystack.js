
import dotenv from "dotenv";
dotenv.config();

export const secretKey = process.env.PAYSTACK_SECRET_KEY;
export const publicKey = process.env.PAYSTACK_PUBLIC_KEY;
export const baseURL = "https://api.paystack.co";