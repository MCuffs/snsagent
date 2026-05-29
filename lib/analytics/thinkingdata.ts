// ThinkingData analytics singleton — browser only
// All functions are no-ops on the server side

interface TD {
  init(config: { appId: string; serverUrl: string; autoTrack?: Record<string, boolean> }): void
  login(accountId: string): void
  logout(): void
  identify(distinctId: string): void
  userSet(props: Record<string, unknown>): void
  userSetOnce(props: Record<string, unknown>): void
  setSuperProperties(props: Record<string, unknown>): void
  track(event: string, props?: Record<string, unknown>): void
  timeEvent(event: string): void
}

let td: TD | null = null
let initialized = false

const APP_ID = 'fb483555173b464fb64813eb7d82f294'
const SERVER_URL = 'https://te-receiver-naver.thinkingdata.kr'

export async function initThinkingData() {
  if (typeof window === 'undefined' || initialized) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = await import('thinkingdata-browser') as any
  const lib = mod.default ?? mod
  td = lib as TD
  td!.init({ appId: APP_ID, serverUrl: SERVER_URL, autoTrack: { pageShow: true, pageHide: true } })
  initialized = true
}

export function identifyUser(accountId: string, props?: Record<string, unknown>) {
  if (!td) return
  td.login(accountId)
  if (props) td.userSet(props)
}

export function resetIdentity() {
  if (!td) return
  td.logout()
}

export function setUserProperties(props: Record<string, unknown>) {
  td?.userSet(props)
}

export function setSuperProperties(props: Record<string, unknown>) {
  td?.setSuperProperties(props)
}

export function track(event: string, props?: Record<string, unknown>) {
  td?.track(event, props ?? {})
}

export function timeEvent(event: string) {
  td?.timeEvent(event)
}

// ── Typed event helpers ────────────────────────────────────────────────────

export const analytics = {
  // Auth
  pageView: (page: string, props?: Record<string, unknown>) =>
    track('page_view', { page, ...props }),

  signupStart: () => track('signup_start'),
  signupComplete: (method: string, plan?: string) =>
    track('signup_complete', { method, plan }),
  loginStart: () => track('login_start'),
  loginComplete: (method: string) => track('login_complete', { method }),
  loginFailed: (method: string, reason?: string) =>
    track('login_failed', { method, reason }),
  logout: () => track('logout'),

  // Brand
  brandCreateStart: () => track('brand_create_start'),
  brandCreateComplete: (brandId: string) =>
    track('brand_create_complete', { brand_id: brandId }),
  brandUrlAnalyzed: (url: string, success: boolean) =>
    track('brand_url_analyzed', { url, success }),

  // Generation
  generateStart: (params: { brandId: string; slideCount: number; platform?: string; intent?: string }) =>
    track('generate_start', params),
  generateComplete: (params: {
    brandId: string
    campaignId: string
    slideCount: number
    durationMs: number
    imageProvider?: string
    hookPattern?: string
  }) => track('generate_complete', params),
  generateFailed: (brandId: string, reason: string) =>
    track('generate_failed', { brand_id: brandId, reason }),

  // Slide editor
  slideEditStart: (campaignId: string, slideNumber: number, field: 'headline' | 'body') =>
    track('slide_edit_start', { campaign_id: campaignId, slide_number: slideNumber, field }),
  slideEditSave: (campaignId: string, slideNumber: number, field: 'headline' | 'body') =>
    track('slide_edit_save', { campaign_id: campaignId, slide_number: slideNumber, field }),
  slideImageReplace: (campaignId: string, slideNumber: number) =>
    track('slide_image_replace', { campaign_id: campaignId, slide_number: slideNumber }),
  slideRegenerate: (campaignId: string, slideNumber: number, scope: 'copy' | 'image' | 'all') =>
    track('slide_regenerate', { campaign_id: campaignId, slide_number: slideNumber, scope }),
  slideLayoutChange: (campaignId: string, slideNumber: number, layout: string) =>
    track('slide_layout_change', { campaign_id: campaignId, slide_number: slideNumber, layout }),
  slideFontChange: (campaignId: string, slideNumber: number, font: string) =>
    track('slide_font_change', { campaign_id: campaignId, slide_number: slideNumber, font }),

  // Campaign actions
  campaignDownload: (campaignId: string, format: 'zip' | 'png' | 'pdf', slideCount: number) =>
    track('campaign_download', { campaign_id: campaignId, format, slide_count: slideCount }),
  campaignShare: (campaignId: string, channel: string) =>
    track('campaign_share', { campaign_id: campaignId, channel }),
  campaignDelete: (campaignId: string) =>
    track('campaign_delete', { campaign_id: campaignId }),
  campaignView: (campaignId: string) =>
    track('campaign_view', { campaign_id: campaignId }),

  // Billing
  billingPageView: (currentPlan: string) =>
    track('billing_page_view', { current_plan: currentPlan }),
  planSelectClick: (plan: string, currentPlan: string) =>
    track('plan_select_click', { plan, current_plan: currentPlan }),
  paymentStart: (plan: string, provider: 'nicepay' | 'toss' | 'paypal') =>
    track('payment_start', { plan, provider }),
  paymentSuccess: (plan: string, provider: 'nicepay' | 'toss' | 'paypal') =>
    track('payment_success', { plan, provider }),
  paymentFailed: (plan: string, provider: string, reason: string) =>
    track('payment_failed', { plan, provider, reason }),
  subscriptionCancel: (plan: string, provider: string) =>
    track('subscription_cancel', { plan, provider }),

  // Works
  worksView: (count: number) => track('works_view', { campaign_count: count }),
  worksFilter: (filter: string) => track('works_filter', { filter }),

  // Tab / navigation
  tabSwitch: (from: string, to: string) =>
    track('tab_switch', { from_tab: from, to_tab: to }),
  sidebarClick: (item: string) => track('sidebar_click', { item }),

  // Feature discovery
  referenceUrlAdd: (url: string) => track('reference_url_add', { url }),
  productImageAdd: (count: number) => track('product_image_add', { count }),
  keywordAdd: (keyword: string) => track('keyword_add', { keyword }),
}
