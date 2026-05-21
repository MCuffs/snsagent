import type { LayoutType } from '../layoutTypes'
import type { LayoutConfig } from './config'
import { darkEditorialConfig } from './dark-editorial'
import { breakingNewsConfig } from './breaking-news'
import { trendFeedConfig } from './trend-feed'
import { magazineConfig } from './magazine'
import { minimalCleanConfig } from './minimal-clean'
import { quoteFocusConfig } from './quote-focus'
import { splitComparisonConfig } from './split-comparison'
import { statHighlightConfig } from './stat-highlight'
import { communityStyleConfig } from './community-style'
import { cinematicHeadlineConfig } from './cinematic-headline'

export * from './config'
export * from './dark-editorial'
export * from './breaking-news'
export * from './trend-feed'
export * from './magazine'
export * from './minimal-clean'
export * from './quote-focus'
export * from './split-comparison'
export * from './stat-highlight'
export * from './community-style'
export * from './cinematic-headline'

export const LAYOUT_CONFIGS: Record<LayoutType, LayoutConfig> = {
  'dark-editorial': darkEditorialConfig,
  'breaking-news': breakingNewsConfig,
  'trend-feed': trendFeedConfig,
  magazine: magazineConfig,
  'minimal-clean': minimalCleanConfig,
  'quote-focus': quoteFocusConfig,
  'split-comparison': splitComparisonConfig,
  'stat-highlight': statHighlightConfig,
  'community-style': communityStyleConfig,
  'cinematic-headline': cinematicHeadlineConfig,
}
