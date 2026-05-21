export interface MetaTokenResponse {
  access_token: string
  token_type?: string
  expires_in?: number
}

export interface MetaPage {
  id: string
  name: string
  access_token: string
  instagram_business_account?: {
    id: string
    username?: string
    profile_picture_url?: string
  }
}

export interface InstagramOAuthAccount {
  facebookPageId: string
  pageName: string
  pageAccessToken: string
  instagramAccountId: string
  username?: string
  profilePictureUrl?: string
}
