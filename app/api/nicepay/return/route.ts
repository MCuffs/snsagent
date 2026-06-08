import { NextRequest, NextResponse } from 'next/server'
import { dbService } from '../../../../lib/db-service'
import { approveNicepayPaymentForUser, nicepayUnexpectedError } from '../../../../lib/nicepay-approval'
import { readNicepayReturnToken } from '../../../../lib/nicepay-return-token'

export const runtime = 'nodejs'

function billingUrl(request: NextRequest, locale: string, params: Record<string, string>) {
  const normalizedLocale = locale === 'ko' || locale === 'en' ? locale : 'ko'
  const url = new URL(`/${normalizedLocale}/billing`, request.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

function paymentResultHtml(targetUrl: URL) {
  const href = targetUrl.toString()
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>결제 처리 중</title>
</head>
<body>
  <script>
    const target = ${JSON.stringify(href)};
    if (window.opener && !window.opener.closed) {
      window.opener.location.href = target;
      window.close();
    } else {
      window.location.replace(target);
    }
  </script>
  <p>결제 처리를 완료하는 중입니다.</p>
</body>
</html>`
}

function htmlResponse(targetUrl: URL) {
  return new NextResponse(paymentResultHtml(targetUrl), {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  })
}

export async function POST(request: NextRequest) {
  const locale = request.nextUrl.searchParams.get('locale') || 'ko'

  try {
    const form = await request.formData()
    const token = request.nextUrl.searchParams.get('token') || String(form.get('mallReserved') || '')
    const tokenPayload = readNicepayReturnToken(token)

    if (!tokenPayload) {
      return htmlResponse(billingUrl(request, locale, {
        canceled: 'true',
        message: '결제 검증 정보가 만료되었거나 올바르지 않습니다.',
      }))
    }

    const authResultCode = String(form.get('authResultCode') || '')
    if (authResultCode !== '0000') {
      return htmlResponse(billingUrl(request, locale, {
        canceled: 'true',
        message: String(form.get('authResultMsg') || '결제가 취소되었습니다.'),
      }))
    }

    const user = await dbService.getUser(tokenPayload.userId)
    if (!user) {
      return htmlResponse(billingUrl(request, locale, {
        canceled: 'true',
        message: '사용자 정보를 찾을 수 없습니다.',
      }))
    }

    const result = await approveNicepayPaymentForUser(user, {
      tid: String(form.get('tid') || ''),
      authToken: String(form.get('authToken') || ''),
      orderId: String(form.get('orderId') || ''),
      plan: tokenPayload.plan,
    }, dbService.updateUserNicepay)

    if (!result.ok) {
      return htmlResponse(billingUrl(request, locale, {
        canceled: 'true',
        message: result.error,
        ...(result.offer ? { offer: result.offer } : {}),
      }))
    }

    return htmlResponse(billingUrl(request, locale, {
      success: 'true',
      ...(result.offer ? { offer: result.offer } : {}),
    }))
  } catch (error) {
    const result = nicepayUnexpectedError(error)
    return htmlResponse(billingUrl(request, locale, {
      canceled: 'true',
      message: result.error,
    }))
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.redirect(billingUrl(request, request.nextUrl.searchParams.get('locale') || 'ko', {
    canceled: 'true',
    message: '결제 인증 응답이 없습니다.',
  }))
}
