// Barrel re-export — all server actions are split into domain files under app/actions/.
// This file preserves the existing import paths (e.g. `import { saveBrandAction } from '@/app/actions'`)
// while keeping each domain module independently testable and maintainable.
// Each sub-file has its own 'use server' directive; this barrel just re-exports.

export {
  getSessionUser,
  loginAction,
  registerAction,
  loginWithPasswordAction,
  logoutAction,
} from './actions/auth'

export { changeUserPlanAction } from './actions/billing'

export { saveBrandAction } from './actions/brand'
export { analyzeBrandWebsiteAction } from './actions/brandAnalyze'
export { analyzeGeneralProfileCoreWordAction } from './actions/brandCoreWord'

export { createCampaignAction } from './actions/campaign'
export { recommendCampaignAction } from './actions/campaignRecommend'

export {
  updateSlideAction,
  rerenderMediaSlideAction,
  saveSlideTextAction,
  fastRerenderTextAction,
  replaceBackgroundAction,
  searchPexelsBackgroundsAction,
} from './actions/slide'

export {
  saveEditorialDocumentAction,
  regenerateEditorialBackgroundAction,
  rewriteEditorialCopyAction,
  exportEditorialSlideAction,
  resetSlideEditorDocumentAction,
} from './actions/slideEditor'

export { regenerateCampaignImagesAction } from './actions/slideCampaign'

export { updatePostDetailsAction } from './actions/post'

export { getPainterStatusAction } from './actions/painter'
