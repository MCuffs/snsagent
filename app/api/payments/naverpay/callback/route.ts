import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../../lib/auth/user';
import { dbService } from '../../../../../lib/db-service';
import {
  approveRecurrentRegister,
  reserveRecurrentPayment,
  approveRecurrentPayment,
} from '../../../../../lib/naverpay';
import { SubscriptionPlan, isSubscriptionPlan } from '../../../../../lib/limits-types';

export const runtime = 'nodejs';

const PLAN_PRICES: Record<'LITE' | 'PRO' | 'UNLIMITED', number> = {
  LITE: 3000,
  PRO: 19000,
  UNLIMITED: 45000,
};

const PLAN_NAMES: Record<'LITE' | 'PRO' | 'UNLIMITED', string> = {
  LITE: 'Single (LITE)',
  PRO: 'Creator (PRO)',
  UNLIMITED: 'Studio (UNLIMITED)',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const resultCode = searchParams.get('resultCode');
  const resultMessage = searchParams.get('resultMessage') || 'Unknown error';
  const reserveId = searchParams.get('reserveId');
  const tempReceiptId = searchParams.get('tempReceiptId');
  const plan = searchParams.get('plan') as SubscriptionPlan;

  console.log('[NaverPay Callback GET]', {
    resultCode,
    resultMessage,
    reserveId,
    tempReceiptId,
    plan,
  });

  const redirectBase = new URL('/billing', request.url);

  // 1. Check if user canceled or registration failed
  if (resultCode !== 'Success') {
    redirectBase.searchParams.set('canceled', 'true');
    redirectBase.searchParams.set('reason', resultCode || 'Fail');
    redirectBase.searchParams.set('message', resultMessage);
    return NextResponse.redirect(redirectBase.toString());
  }

  if (!reserveId || !tempReceiptId) {
    redirectBase.searchParams.set('canceled', 'true');
    redirectBase.searchParams.set('message', 'Required parameters missing (reserveId or tempReceiptId)');
    return NextResponse.redirect(redirectBase.toString());
  }

  // 2. Validate plan
  if (!plan || !isSubscriptionPlan(plan) || plan === 'FREE') {
    redirectBase.searchParams.set('canceled', 'true');
    redirectBase.searchParams.set('message', 'Invalid plan specified');
    return NextResponse.redirect(redirectBase.toString());
  }

  try {
    // 3. Load user session
    const user = await getSessionUser();
    if (!user) {
      redirectBase.searchParams.set('canceled', 'true');
      redirectBase.searchParams.set('message', 'Authentication required. Please log in first.');
      return NextResponse.redirect(redirectBase.toString());
    }

    // 4. Approve Recurrent Registration (Billing Key Issuance)
    console.log('[NaverPay Callback] Approving recurrent registration...');
    const registerResult = await approveRecurrentRegister(reserveId, tempReceiptId);
    const { recurrentId } = registerResult;

    if (!recurrentId) {
      throw new Error('No recurrentId returned from Naver Pay registration approval');
    }

    // 5. Reserve Initial Recurrent Payment
    const amount = PLAN_PRICES[plan];
    const productName = `Shuffla ${PLAN_NAMES[plan]} Subscription`;
    const merchantPayKey = `np_${Date.now()}_${user.id.slice(-6)}`;

    console.log('[NaverPay Callback] Reserving initial payment...', {
      recurrentId,
      amount,
      productName,
      merchantPayKey,
    });

    const reserveResult = await reserveRecurrentPayment(
      recurrentId,
      amount,
      productName,
      merchantPayKey,
      user.id,
      plan
    );

    const { paymentId } = reserveResult;
    if (!paymentId) {
      throw new Error('No paymentId returned from Naver Pay payment reservation');
    }

    // 6. Approve Initial Payment
    console.log('[NaverPay Callback] Approving initial payment...', { paymentId });
    const idempotencyKey = `idem_${merchantPayKey}`;
    const approvalResult = await approveRecurrentPayment(paymentId, idempotencyKey);

    if (approvalResult.detail.admissionState !== 'SUCCESS') {
      throw new Error(`Naver Pay initial payment failed with state: ${approvalResult.detail.admissionState}`);
    }

    // 7. Update User plan and Naver Pay fields in DB
    console.log('[NaverPay Callback] Updating DB user subscription details...', {
      userId: user.id,
      plan,
      recurrentId,
    });

    await dbService.updateUserNaverPay(user.id, {
      naverpayRecurrentId: recurrentId,
      naverpaySubscriptionStatus: 'ACTIVE',
      plan,
    });

    // Also deactivate any existing PayPal fields if they had them
    await dbService.updateUserPayPal(user.id, {
      paypalSubscriptionId: null,
      paypalSubscriptionStatus: null,
    });

    redirectBase.searchParams.set('success', 'true');
    return NextResponse.redirect(redirectBase.toString());
  } catch (error: any) {
    console.error('[NaverPay Callback Error]', error);
    redirectBase.searchParams.set('canceled', 'true');
    redirectBase.searchParams.set('message', error.message || 'Payment approval failed');
    return NextResponse.redirect(redirectBase.toString());
  }
}
