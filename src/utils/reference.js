import { randomBytes } from "crypto";

export function generateReference() {

    return `RK-${Date.now()}-${randomBytes(5).toString("hex").toUpperCase()}`;

}