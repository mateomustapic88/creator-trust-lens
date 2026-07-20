import ExtPay from "extpay";
import { EXTENSION_PAY_ID } from "./config";

const extpay = ExtPay(EXTENSION_PAY_ID);

export interface BillingStatus {
  isPro: boolean;
  planName?: string;
  subscriptionStatus?: "active" | "past_due" | "canceled";
}

export async function getBillingStatus(): Promise<BillingStatus> {
  const user = await extpay.getUser();
  return {
    isPro: user.paid,
    planName: user.plan?.nickname ? String(user.plan.nickname) : undefined,
    subscriptionStatus: user.subscriptionStatus,
  };
}

export async function openUpgradePage(): Promise<void> {
  await extpay.openPaymentPage();
}

export async function openRestorePage(): Promise<void> {
  await extpay.openLoginPage();
}

export async function openSubscriptionPage(): Promise<void> {
  await extpay.openPaymentPage();
}
