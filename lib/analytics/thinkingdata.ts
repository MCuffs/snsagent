// ThinkingData analytics singleton — browser only
// All functions are no-ops on the server side

interface TD {
  init(config: { appId: string; serverUrl: string; autoTrack?: Record<string, boolean> }): void
  login(accountId: string): void
  logout(isChangeId?: boolean): void
  identify(distinctId: string): void
  getDistinctId(): string
  getDeviceId(): string
  userSet(props: Record<string, unknown>): void
  userSetOnce(props: Record<string, unknown>): void
  setSuperProperties(props: Record<string, unknown>): void
  unsetSuperProperty(propertyName: string): void
  track(event: string, props?: Record<string, unknown>): void
  timeEvent(event: string): void
  flush(): void
}

let td: TD | null = null
let initialized = false
let initPromise: Promise<TD | null> | null = null
const queuedTracks: Array<{ event: string; props: Record<string, unknown> }> = []

const APP_ID = '3bd98ae26423469a9a124f4151bf3972'
// 사설 TE 수신 서버는 http 라 https 페이지에서 직접 전송하면 mixed content 로 차단됩니다.
// SDK 는 serverUrl 의 origin + /sync_js 로 전송하므로 같은 출처를 지정하고,
// next.config rewrites 가 /sync_js 를 수신 서버(http://49.51.180.241:8991)로 프록시합니다.

export async function initThinkingData(): Promise<TD | null> {
  if (typeof window === 'undefined') return null
  if (initialized) return td
  if (initPromise) return initPromise

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initPromise = import('thinkingdata-browser').then((mod: any) => {
    const lib = mod.default ?? mod
    td = lib as TD
    td.init({
      appId: APP_ID,
      serverUrl: window.location.origin,
      autoTrack: { pageShow: true, pageHide: true },
    })
    initialized = true

    while (queuedTracks.length > 0) {
      const item = queuedTracks.shift()
      if (item) td.track(item.event, item.props)
    }

    return td
  }).catch((error) => {
    initPromise = null
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[ThinkingData] initialization failed', error)
    }
    return null
  })

  return initPromise
}

export function identifyUser(accountId: string, props?: Record<string, unknown>) {
  if (!td) return
  td.login(accountId)
  if (props) td.userSet(props)
}

export function resetIdentity() {
  if (!td) return
  td.logout(true)
}

export function setUserProperties(props: Record<string, unknown>) {
  td?.userSet(props)
}

export function setSuperProperties(props: Record<string, unknown>) {
  td?.setSuperProperties(props)
}

export function unsetSuperProperty(propertyName: string) {
  td?.unsetSuperProperty(propertyName)
}

export function getAnonymousId() {
  return td?.getDistinctId?.() ?? td?.getDeviceId?.()
}

export function track(event: string, props?: Record<string, unknown>) {
  const safeProps = props ?? {}

  if (td) {
    td.track(event, safeProps)
    return
  }

  if (typeof window !== 'undefined') {
    queuedTracks.push({ event, props: safeProps })
    void initThinkingData()
  }
}

export function timeEvent(event: string) {
  td?.timeEvent(event)
}

type PaymentProvider = 'polar'
type ExportFormat = 'zip' | 'png' | 'jpg' | 'pdf' | 'mp4'
type RegenerateScope = 'copy' | 'image' | 'all'

// ── Typed event helpers ────────────────────────────────────────────────────

export const analytics = {
  // Auth
  pageView: (page: string, props?: Record<string, unknown>) =>
    track('page_view', { page, ...props }),

  signupStart: () => track('signup_start'),
  signupComplete: (method: string, plan?: string) =>
    track('signup_complete', { method, plan }),
  loginStart: () => track('login_start'),
  loginComplete: (method: string, props?: Record<string, unknown>) =>
    track('login_complete', { method, ...props }),
  loginFailed: (method: string, reason?: string, props?: Record<string, unknown>) =>
    track('login_failed', { method, reason, ...props }),
  logout: (props?: Record<string, unknown>) => track('logout', props),

  // Brand
  brandCreateStart: (props?: Record<string, unknown>) => track('brand_create_start', props),
  brandCreateComplete: (brandId: string, props?: Record<string, unknown>) =>
    track('brand_create_complete', { brand_id: brandId, ...props }),
  brandUrlAnalyzed: (brandUrl: string, success: boolean, props?: Record<string, unknown>) =>
    track('brand_url_analyzed', { brand_url: brandUrl, success, ...props }),
  brandAiChatSend: (props: { brandId: string; messageLength: number; chatTurnIndex: number; locale?: string }) =>
    track('brand_ai_chat_send', {
      brand_id: props.brandId,
      message_length: props.messageLength,
      chat_turn_index: props.chatTurnIndex,
      locale: props.locale,
    }),

  // Generation
  generateAgentMessageSend: (props: {
    brandId: string
    generationMode: string
    messageLength: number
    chatTurnIndex: number
    locale?: string
  }) => track('generate_agent_message_send', {
    brand_id: props.brandId,
    generation_mode: props.generationMode,
    message_length: props.messageLength,
    chat_turn_index: props.chatTurnIndex,
    locale: props.locale,
  }),
  generateBriefReady: (props: {
    brandId: string
    generationMode: string
    topic: string
    contentType: string
    objective: string
    slideCount: number
    hasProductUrl?: boolean
    structureSlideCount?: number
    locale?: string
  }) => track('generate_brief_ready', {
    brand_id: props.brandId,
    generation_mode: props.generationMode,
    topic: props.topic,
    content_type: props.contentType,
    objective: props.objective,
    slide_count: props.slideCount,
    has_product_url: props.hasProductUrl,
    structure_slide_count: props.structureSlideCount,
    locale: props.locale,
  }),
  generateStart: (params: {
    brandId: string
    generationMode?: string
    slideCount: number
    platform?: string
    intent?: string
    topic?: string
    contentType?: string
    hasProductUrl?: boolean
    imageCount?: number
    plan?: string
  }) =>
    track('generate_start', {
      brand_id: params.brandId,
      generation_mode: params.generationMode,
      slide_count: params.slideCount,
      platform_name: params.platform,
      intent: params.intent,
      topic: params.topic,
      content_type: params.contentType,
      has_product_url: params.hasProductUrl,
      image_count: params.imageCount,
      plan: params.plan,
    }),
  generateComplete: (params: {
    brandId: string
    campaignId: string
    generationMode?: string
    slideCount: number
    durationMs: number
    imageProvider?: string
    imageModel?: string
    hookPattern?: string
    qualityScore?: number
    plan?: string
  }) => track('generate_complete', {
    brand_id: params.brandId,
    campaign_id: params.campaignId,
    generation_mode: params.generationMode,
    slide_count: params.slideCount,
    duration_ms: params.durationMs,
    image_provider: params.imageProvider,
    image_model: params.imageModel,
    hook_pattern: params.hookPattern,
    quality_score: params.qualityScore,
    plan: params.plan,
  }),
  generateFailed: (brandId: string, reason: string, props?: Record<string, unknown>) =>
    track('generate_failed', { brand_id: brandId, reason, ...props }),

  // Slide editor
  slideEditStart: (campaignId: string, slideNumber: number, field: 'headline' | 'body') =>
    track('slide_edit_start', { campaign_id: campaignId, slide_number: slideNumber, field }),
  slideEditSave: (campaignId: string, slideNumber: number, field: 'headline' | 'body') =>
    track('slide_edit_save', { campaign_id: campaignId, slide_number: slideNumber, field }),
  slideImageReplace: (campaignId: string, slideNumber: number) =>
    track('slide_image_replace', { campaign_id: campaignId, slide_number: slideNumber }),
  slideSelect: (campaignId: string, slideId: string, slideNumber: number, slideCount: number) =>
    track('slide_select', { campaign_id: campaignId, slide_id: slideId, slide_number: slideNumber, slide_count: slideCount }),
  editorLayerEdit: (props: {
    campaignId: string
    slideId: string
    slideNumber: number
    layerId?: string
    layerType?: string
    editType: string
    field?: string
  }) => track('editor_layer_edit', {
    campaign_id: props.campaignId,
    slide_id: props.slideId,
    slide_number: props.slideNumber,
    layer_id: props.layerId,
    layer_type: props.layerType,
    edit_type: props.editType,
    field: props.field,
  }),
  editorDocumentSave: (props: {
    campaignId: string
    slideId: string
    slideNumber: number
    saveType: string
    renderOutput?: boolean
    success: boolean
    reason?: string
  }) => track('editor_document_save', {
    campaign_id: props.campaignId,
    slide_id: props.slideId,
    slide_number: props.slideNumber,
    save_type: props.saveType,
    render_output: props.renderOutput,
    success: props.success,
    reason: props.reason,
  }),
  backgroundUpload: (props: {
    campaignId: string
    slideId: string
    slideNumber: number
    fileType?: string
    fileSize?: number
    success: boolean
    reason?: string
  }) => track('background_upload', {
    campaign_id: props.campaignId,
    slide_id: props.slideId,
    slide_number: props.slideNumber,
    file_type: props.fileType,
    file_size: props.fileSize,
    success: props.success,
    reason: props.reason,
  }),
  slideRegenerate: (props: {
    campaignId: string
    slideId?: string
    slideNumber: number
    scope: RegenerateScope
    regenerationAccess?: string
    imageModel?: string
    success?: boolean
    reason?: string
    plan?: string
  }) =>
    track('slide_regenerate', {
      campaign_id: props.campaignId,
      slide_id: props.slideId,
      slide_number: props.slideNumber,
      regenerate_scope: props.scope,
      regeneration_access: props.regenerationAccess,
      image_model: props.imageModel,
      success: props.success,
      reason: props.reason,
      plan: props.plan,
    }),
  slideLayoutChange: (campaignId: string, slideNumber: number, layout: string) =>
    track('slide_layout_change', { campaign_id: campaignId, slide_number: slideNumber, layout }),
  slideFontChange: (campaignId: string, slideNumber: number, font: string) =>
    track('slide_font_change', { campaign_id: campaignId, slide_number: slideNumber, font }),

  // Campaign actions
  captionSave: (props: {
    campaignId: string
    postId: string
    captionLength: number
    hashtagCount: number
    success: boolean
    reason?: string
  }) => track('caption_save', {
    campaign_id: props.campaignId,
    post_id: props.postId,
    caption_length: props.captionLength,
    hashtag_count: props.hashtagCount,
    success: props.success,
    reason: props.reason,
  }),
  campaignDownload: (campaignId: string, format: ExportFormat, slideCount: number, props?: Record<string, unknown>) =>
    track('campaign_download', { campaign_id: campaignId, export_format: format, slide_count: slideCount, ...props }),
  exportComplete: (props: {
    campaignId: string
    slideId?: string
    format: ExportFormat
    scale?: number
    downloadScope: string
    success: boolean
    reason?: string
  }) => track('export_complete', {
    campaign_id: props.campaignId,
    slide_id: props.slideId,
    export_format: props.format,
    export_scale: props.scale,
    download_scope: props.downloadScope,
    success: props.success,
    reason: props.reason,
  }),
  campaignShare: (campaignId: string, channel: string) =>
    track('campaign_share', { campaign_id: campaignId, channel }),
  campaignDelete: (campaignId: string, props?: Record<string, unknown>) =>
    track('campaign_delete', { campaign_id: campaignId, ...props }),
  campaignView: (campaignId: string, props?: Record<string, unknown>) =>
    track('campaign_view', { campaign_id: campaignId, ...props }),

  // YouTube automation
  youtubeAutomationView: (props?: Record<string, unknown>) => track('youtube_automation_view', props),
  youtubePlannerCreateStart: (topicLength: number, historyCount: number) =>
    track('youtube_planner_create_start', { topic_length: topicLength, history_count: historyCount }),
  youtubePlannerCreateComplete: (projectId: string, dayCount: number, durationMs: number) =>
    track('youtube_planner_create_complete', {
      project_id: projectId, day_count: dayCount, duration_ms: durationMs,
    }),
  youtubePlannerCreateFailed: (durationMs: number, reason: string) =>
    track('youtube_planner_create_failed', { duration_ms: durationMs, reason }),
  youtubeProjectOpen: (
    projectId: string,
    projectStatus: string,
    completedDayCount: number,
    source: 'created' | 'history',
  ) => track('youtube_project_open', {
    project_id: projectId,
    project_status: projectStatus,
    completed_day_count: completedDayCount,
    source,
  }),
  youtubeProjectDelete: (projectId: string, success: boolean, reason?: string) =>
    track('youtube_project_delete', { project_id: projectId, success, reason }),
  youtubeDaySelect: (props: {
    projectId: string
    dayId: string
    dayNumber: number
    dayStatus: string
    isLocked: boolean
    hasVideo: boolean
  }) => track('youtube_day_select', {
    project_id: props.projectId,
    day_id: props.dayId,
    day_number: props.dayNumber,
    day_status: props.dayStatus,
    is_locked: props.isLocked,
    has_video: props.hasVideo,
  }),
  youtubeProductionStart: (props: {
    projectId: string
    dayId: string
    dayNumber: number
    resumed: boolean
    retry: boolean
  }) => track('youtube_production_start', {
    project_id: props.projectId,
    day_id: props.dayId,
    day_number: props.dayNumber,
    resumed: props.resumed,
    retry: props.retry,
  }),
  youtubePlanComplete: (props: {
    projectId: string
    dayId: string
    dayNumber: number
    sceneCount: number
    durationMs: number
  }) => track('youtube_plan_complete', {
    project_id: props.projectId,
    day_id: props.dayId,
    day_number: props.dayNumber,
    scene_count: props.sceneCount,
    duration_ms: props.durationMs,
  }),
  youtubeRenderStart: (props: {
    projectId: string
    dayId: string
    dayNumber: number
    sceneCount: number
  }) => track('youtube_render_start', {
    project_id: props.projectId,
    day_id: props.dayId,
    day_number: props.dayNumber,
    scene_count: props.sceneCount,
  }),
  youtubeRenderRequested: (projectId: string, dayId: string, dayNumber: number, durationMs: number) =>
    track('youtube_render_requested', {
      project_id: projectId, day_id: dayId, day_number: dayNumber, duration_ms: durationMs,
    }),
  youtubeRenderComplete: (projectId: string, dayId: string, dayNumber: number, sceneCount: number) =>
    track('youtube_render_complete', {
      project_id: projectId, day_id: dayId, day_number: dayNumber, scene_count: sceneCount,
    }),
  youtubeProductionFailed: (
    projectId: string,
    dayId: string,
    dayNumber: number,
    phase: string,
    reason: string,
  ) => track('youtube_production_failed', {
    project_id: projectId, day_id: dayId, day_number: dayNumber, phase, reason,
  }),
  youtubeRenderCancel: (
    projectId: string,
    dayId: string,
    dayNumber: number,
    success: boolean,
    reason?: string,
  ) => track('youtube_render_cancel', {
    project_id: projectId, day_id: dayId, day_number: dayNumber, success, reason,
  }),
  youtubeVideoDownload: (props: {
    projectId: string
    dayId: string
    dayNumber: number
    success: boolean
    durationMs: number
    fileSizeBytes?: number
    reason?: string
  }) => track('youtube_video_download', {
    project_id: props.projectId,
    day_id: props.dayId,
    day_number: props.dayNumber,
    success: props.success,
    duration_ms: props.durationMs,
    file_size_bytes: props.fileSizeBytes,
    reason: props.reason,
  }),
  youtubeUploadMarked: (
    projectId: string,
    dayId: string,
    dayNumber: number,
    success: boolean,
    reason?: string,
  ) => track('youtube_upload_marked', {
    project_id: projectId, day_id: dayId, day_number: dayNumber, success, reason,
  }),

  // Shorts Lab — 퍼널: view → filter/select → (paywall) → capture → upload → generate → download
  shortsLabView: (props: { access_mode: string; embedded: boolean; video_count: number }) =>
    track('shorts_lab_view', props),
  shortsLabTrendingRefresh: (props: { video_count: number; mode: string }) =>
    track('shorts_lab_trending_refresh', props),
  shortsLabFilterToggle: (filter: string, enabled: boolean, blocked: boolean) =>
    track('shorts_lab_filter_toggle', { filter, enabled, blocked }),
  shortsLabVideoSelect: (props: {
    video_id: string
    video_title: string
    reusable: boolean
    blocked: boolean
  }) => track('shorts_lab_video_select', props),
  shortsLabPaywallShow: (trigger: string) =>
    track('shorts_lab_paywall_show', { trigger }),
  shortsLabPaywallCheckoutClick: () => track('shorts_lab_paywall_checkout_click'),
  shortsLabPaywallDismiss: () => track('shorts_lab_paywall_dismiss'),
  shortsLabCaptureOpen: (videoId: string) =>
    track('shorts_lab_capture_open', { video_id: videoId }),
  shortsLabCaptureStart: (videoId: string, startSec: number) =>
    track('shorts_lab_capture_start', { video_id: videoId, start_sec: startSec }),
  shortsLabCaptureComplete: (videoId: string, sizeMb: number) =>
    track('shorts_lab_capture_complete', { video_id: videoId, size_mb: sizeMb }),
  shortsLabCaptureError: (videoId: string, reason: string) =>
    track('shorts_lab_capture_error', { video_id: videoId, reason }),
  shortsLabUploadComplete: (videoId: string, sizeMb: number) =>
    track('shorts_lab_upload_complete', { video_id: videoId, size_mb: sizeMb }),
  shortsLabUploadError: (videoId: string, reason: string) =>
    track('shorts_lab_upload_error', { video_id: videoId, reason }),
  shortsLabGenerateStart: (props: { video_id: string; is_trial: boolean }) =>
    track('shorts_lab_generate_start', props),
  shortsLabGenerateSuccess: (props: {
    video_id: string
    is_trial: boolean
    duration_ms: number
    comment_source?: string
  }) => track('shorts_lab_generate_success', props),
  shortsLabGenerateError: (props: { video_id: string; reason: string; code?: string }) =>
    track('shorts_lab_generate_error', props),
  shortsLabLimitBlocked: (kind: 'trial_exhausted' | 'daily_limit' | 'monthly_limit') =>
    track('shorts_lab_limit_blocked', { kind }),
  shortsLabDownloadClick: (videoId: string) =>
    track('shorts_lab_download_click', { video_id: videoId }),
  shortsLabRemakeClick: (videoId: string) =>
    track('shorts_lab_remake_click', { video_id: videoId }),

  // Billing
  billingPageView: (currentPlan: string, props?: Record<string, unknown>) =>
    track('billing_page_view', { current_plan: currentPlan, ...props }),
  planSelectClick: (selectedPlan: string, currentPlan: string, props?: Record<string, unknown>) =>
    track('plan_select_click', { selected_plan: selectedPlan, current_plan: currentPlan, ...props }),
  paymentStart: (selectedPlan: string, provider: PaymentProvider, props?: Record<string, unknown>) =>
    track('payment_start', { selected_plan: selectedPlan, payment_provider: provider, ...props }),
  paymentSuccess: (selectedPlan: string, provider: PaymentProvider, props?: Record<string, unknown>) =>
    track('payment_success', { selected_plan: selectedPlan, payment_provider: provider, ...props }),
  paymentFailed: (selectedPlan: string, provider: string, reason: string, props?: Record<string, unknown>) =>
    track('payment_failed', { selected_plan: selectedPlan, payment_provider: provider, reason, ...props }),
  subscriptionCancel: (currentPlan: string, provider: string, props?: Record<string, unknown>) =>
    track('subscription_cancel', { current_plan: currentPlan, payment_provider: provider, ...props }),

  // Works
  worksView: (count: number, props?: Record<string, unknown>) => track('works_view', { campaign_count: count, ...props }),
  worksFilter: (filter: string) => track('works_filter', { filter }),
  workOpen: (campaignId: string, props?: Record<string, unknown>) =>
    track('work_open', { campaign_id: campaignId, ...props }),

  // Tab / navigation
  tabSwitch: (from: string, to: string, props?: Record<string, unknown>) =>
    track('tab_switch', { from_tab: from, to_tab: to, ...props }),
  sidebarClick: (item: string, props?: Record<string, unknown>) => track('sidebar_click', { item, ...props }),

  // Feature discovery
  referenceUrlAdd: (url: string) => track('reference_url_add', { url }),
  productImageAdd: (count: number, props?: Record<string, unknown>) => track('product_image_add', { image_count: count, ...props }),
  keywordAdd: (keyword: string) => track('keyword_add', { keyword }),
}
