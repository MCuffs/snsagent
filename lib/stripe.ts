import Stripe from 'stripe'

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY is not set')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2025-04-30.basil',
})

// Map plan keys to Stripe Price IDs — set these in env
export const STRIPE_PRICE_IDS: Record<string, string | undefined> = {
  STARTER: process.env.STRIPE_PRICE_STARTER,
  PRO: process.env.STRIPE_PRICE_PRO,
  AGENCY: process.env.STRIPE_PRICE_AGENCY,
}

// Map Stripe Price IDs back to plan keys for webhook handling
export function planFromPriceId(priceId: string): string | null {
  for (const [plan, id] of Object.entries(STRIPE_PRICE_IDS)) {
    if (id === priceId) return plan
  }
  return null
}
