import { NextResponse } from 'next/server';
import { getSessionUser } from '../../../../../lib/auth/user';
import { cancelRecurrentRegister } from '../../../../../lib/naverpay';
import { dbService } from '../../../../../lib/db-service';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
    }

    if (!user.naverpayRecurrentId) {
      return NextResponse.json({ error: '활성 네이버페이 구독이 없습니다.' }, { status: 400 });
    }

    console.log(`[NaverPay Cancel] Cancelling recurrent registration: ${user.naverpayRecurrentId}`);
    await cancelRecurrentRegister(user.naverpayRecurrentId);

    await dbService.updateUserNaverPay(user.id, {
      naverpayRecurrentId: null,
      naverpaySubscriptionStatus: 'CANCELLED',
      plan: 'FREE',
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[NaverPay Cancel Error]', error);
    return NextResponse.json({ error: '구독 취소에 실패했습니다.' }, { status: 500 });
  }
}
