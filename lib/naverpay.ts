const NAVERPAY_BASE =
  process.env.NAVERPAY_SANDBOX === 'false'
    ? 'https://pay.paygate.naver.com'
    : 'https://dev-pay.paygate.naver.com';

function getNaverPayCredentials() {
  const clientId = process.env.NEXT_PUBLIC_NAVERPAY_CLIENT_ID || 'dQPaTGkl7UD9gyUVttF3';
  const clientSecret = process.env.NAVERPAY_CLIENT_SECRET || 'sk_dev_api_secret_key';
  const chainId = process.env.NEXT_PUBLIC_NAVERPAY_CHAIN_ID || 'TDZSUHBoVGRFS2l';

  return {
    clientId: clientId.trim(),
    clientSecret: clientSecret.trim(),
    chainId: chainId.trim(),
  };
}

interface NaverPayResponse<T> {
  code: string;
  message?: string;
  body?: T;
}

async function callNaverPayAPI<T>(
  path: string,
  params: Record<string, string | number | boolean>,
  idempotencyKey?: string
): Promise<T> {
  const { clientId, clientSecret, chainId } = getNaverPayCredentials();
  const url = `${NAVERPAY_BASE}${path}`;

  const bodyParams = new URLSearchParams();
  Object.entries(params).forEach(([key, val]) => {
    bodyParams.append(key, String(val));
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'X-Naver-Client-Id': clientId,
    'X-Naver-Client-Secret': clientSecret,
    'X-NaverPay-Chain-Id': chainId,
  };

  if (idempotencyKey) {
    headers['X-NaverPay-Idempotency-Key'] = idempotencyKey;
  }

  console.log(`[NaverPay Request] POST ${url}`, params);

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: bodyParams.toString(),
    cache: 'no-store',
  });

  if (!res.ok) {
    const errorText = await res.text();
    console.error(`[NaverPay Error Response] Status: ${res.status}, Body: ${errorText}`);
    throw new Error(`Naver Pay API HTTP error: ${res.status} - ${errorText}`);
  }

  const data = (await res.json()) as NaverPayResponse<T>;
  console.log(`[NaverPay Response]`, data);

  if (data.code !== 'Success') {
    throw new Error(`Naver Pay API business error: [${data.code}] ${data.message || 'Unknown error'}`);
  }

  if (!data.body) {
    throw new Error('Naver Pay API empty body returned');
  }

  return data.body;
}

// 1. Recurrent Registration Approval
export interface RecurrentRegisterApprovalBody {
  recurrentId: string;
  recurrentReserveId: string;
  merchantUserKey: string;
}

export async function approveRecurrentRegister(
  reserveId: string,
  tempReceiptId: string
): Promise<RecurrentRegisterApprovalBody> {
  return callNaverPayAPI<RecurrentRegisterApprovalBody>(
    '/naverpay-partner/naverpay/payments/recurrent/regist/v1/approval',
    {
      reserveId,
      tempReceiptId,
    }
  );
}

// 2. Recurrent Pay Reserve
export interface RecurrentPayReserveBody {
  paymentId: string;
}

export async function reserveRecurrentPayment(
  recurrentId: string,
  amount: number,
  productName: string,
  merchantPayId: string,
  merchantUserId: string,
  productCode = 'SUBSCRIPTION'
): Promise<RecurrentPayReserveBody> {
  return callNaverPayAPI<RecurrentPayReserveBody>(
    '/naverpay-partner/naverpay/payments/recurrent/pay/v3/reserve',
    {
      recurrentId,
      totalPayAmount: amount,
      productName,
      productCode,
      productCount: 1,
      merchantPayKey: merchantPayId, // Note: some versions use merchantPayKey instead of merchantPayId
      merchantUserKey: merchantUserId,
    }
  );
}

// 3. Recurrent Pay Approval
export interface RecurrentPayApprovalBody {
  paymentId: string;
  recurrentId: string;
  detail: {
    paymentId: string;
    admissionState: 'SUCCESS' | 'FAIL';
    totalPayAmount: number;
    primaryPayMeans: string;
    cardCorpCode?: string;
  };
}

export async function approveRecurrentPayment(
  paymentId: string,
  idempotencyKey?: string
): Promise<RecurrentPayApprovalBody> {
  return callNaverPayAPI<RecurrentPayApprovalBody>(
    '/naverpay-partner/naverpay/payments/recurrent/pay/v3/approval',
    {
      paymentId,
    },
    idempotencyKey
  );
}

// 4. Recurrent Cancellation (Expire)
export interface RecurrentExpireBody {
  recurrentId: string;
}

export async function cancelRecurrentRegister(recurrentId: string): Promise<RecurrentExpireBody> {
  // We try /naverpay-partner/naverpay/payments/recurrent/expire first
  try {
    return await callNaverPayAPI<RecurrentExpireBody>(
      '/naverpay-partner/naverpay/payments/recurrent/expire',
      {
        recurrentId,
      }
    );
  } catch (error) {
    console.warn('Failed with primary expire endpoint, trying fallback /binding/recurrent-expire-request...', error);
    return callNaverPayAPI<RecurrentExpireBody>(
      '/naverpay-partner/naverpay/payments/recurrent/binding/recurrent-expire-request',
      {
        recurrentId,
      }
    );
  }
}
