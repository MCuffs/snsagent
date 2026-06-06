'use client'

import { useState, useEffect } from 'react'
import { Camera, Link2, Calendar, Clock, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'

interface InstagramAccount {
  id: string
  username: string
  instagramAccountId: string
  status: string
  profilePictureUrl?: string | null
}

interface Campaign {
  id: string
  title: string
  status: string
  createdAt: string
  thumbnail: string | null
  slideCount: number
}

interface ScheduledPost {
  id: string
  campaignId: string
  campaign: { title: string }
  caption: string
  hashtags: string
  scheduledAt: string
  status: string
}

interface InstagramDashboardProps {
  brandId: string
  userEmail: string
}

export default function InstagramDashboard({ brandId }: InstagramDashboardProps) {
  const [account, setAccount] = useState<InstagramAccount | null>(null)
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [accountRes, campaignsRes, postsRes] = await Promise.all([
        fetch(`/api/instagram/account?brandId=${brandId}`),
        fetch(`/api/instagram/campaigns?brandId=${brandId}`),
        fetch(`/api/instagram/scheduled-posts?brandId=${brandId}`),
      ])

      if (accountRes.ok) {
        const data = await accountRes.json()
        setAccount(data.account)
      }

      if (campaignsRes.ok) {
        const data = await campaignsRes.json()
        setCampaigns(data.campaigns)
      }

      if (postsRes.ok) {
        const data = await postsRes.json()
        setScheduledPosts(data.posts)
      }
    } catch (error) {
      console.error('Failed to load Instagram data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [brandId])

  const handleConnect = async () => {
    setConnecting(true)
    
    // Check if mock mode or real OAuth
    try {
      const checkRes = await fetch('/api/auth/meta/check-config')
      const config = await checkRes.json()
      
      if (config.mockMode) {
        // Mock mode: simulate connection
        const mockRes = await fetch('/api/instagram/mock-connect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ brandId }),
        })
        
        if (mockRes.ok) {
          await loadData()
        } else {
          alert('Mock 연결에 실패했습니다.')
        }
      } else {
        // Real OAuth: redirect to Meta
        window.location.href = `/api/auth/meta/start?brandId=${brandId}`
      }
    } catch (error) {
      console.error('Connection check failed:', error)
      alert('연결 상태를 확인하는 중 오류가 발생했습니다.')
    } finally {
      setConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    if (!confirm('Instagram 계정 연결을 해제하시겠습니까?')) return

    try {
      const res = await fetch(`/api/instagram/account?brandId=${brandId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setAccount(null)
      }
    } catch (error) {
      console.error('Failed to disconnect:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#71717a]" />
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="border-b border-[#e4e4e7] bg-white px-6 py-4">
        <div className="flex items-center gap-2">
          <Camera className="h-5 w-5 text-[#E1306C]" />
          <h1 className="text-lg font-bold text-[#111111]">Instagram 자동 게시</h1>
        </div>
        <p className="mt-1 text-sm text-[#71717a]">
          생성한 카드뉴스를 Instagram 비즈니스 계정에 자동으로 게시하세요
        </p>
      </div>

      <div className="p-6 space-y-6">
        {/* Account Connection Section */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-[#e4e4e7] bg-white p-6"
        >
          <h2 className="text-base font-semibold text-[#111111] mb-4">계정 연결</h2>

          {account ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {account.profilePictureUrl ? (
                  <img
                    src={account.profilePictureUrl}
                    alt={account.username}
                    className="h-12 w-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E1306C]/10">
                    <Camera className="h-6 w-6 text-[#E1306C]" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="font-semibold text-[#111111]">@{account.username}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span className="text-xs text-green-600 font-medium">연결됨</span>
                  </div>
                </div>
                <button
                  onClick={handleDisconnect}
                  className="rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs font-medium text-[#71717a] hover:bg-[#fafafa] transition-colors"
                >
                  연결 해제
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-md bg-blue-50 p-4">
                <AlertCircle className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="flex-1 text-sm text-blue-900">
                  <p className="font-semibold mb-1">Instagram 비즈니스 계정 필요</p>
                  <p className="text-xs leading-relaxed">
                    자동 게시 기능을 사용하려면 Instagram 비즈니스 또는 크리에이터 계정이 필요합니다.
                    일반 개인 계정은 지원되지 않습니다.
                  </p>
                </div>
              </div>

              <button
                onClick={handleConnect}
                disabled={connecting}
                className="w-full rounded-md bg-[#E1306C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#C13584] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {connecting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    연결 중...
                  </>
                ) : (
                  <>
                    <Link2 className="h-4 w-4" />
                    Instagram 계정 연결하기
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>

        {/* Available Campaigns Section */}
        {account && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-lg border border-[#e4e4e7] bg-white p-6"
          >
            <h2 className="text-base font-semibold text-[#111111] mb-4">게시 가능한 카드뉴스</h2>

            {campaigns.length === 0 ? (
              <div className="text-center py-8">
                <Camera className="h-12 w-12 text-[#d4d4d8] mx-auto mb-3" />
                <p className="text-sm text-[#71717a]">게시 가능한 카드뉴스가 없습니다</p>
                <p className="text-xs text-[#a1a1aa] mt-1">먼저 카드뉴스를 생성해주세요</p>
              </div>
            ) : (
              <div className="space-y-3">
                {campaigns.map((campaign) => (
                  <CampaignCard key={campaign.id} campaign={campaign} />
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Scheduled Posts Section */}
        {account && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-lg border border-[#e4e4e7] bg-white p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-[#71717a]" />
              <h2 className="text-base font-semibold text-[#111111]">예약된 게시</h2>
            </div>

            {scheduledPosts.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-[#d4d4d8] mx-auto mb-3" />
                <p className="text-sm text-[#71717a]">예약된 게시가 없습니다</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scheduledPosts.map((post) => (
                  <ScheduledPostCard key={post.id} post={post} />
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  )
}

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [scheduling, setScheduling] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [caption, setCaption] = useState('')
  const [hashtags, setHashtags] = useState('')

  const handleSchedule = async () => {
    if (!scheduledAt) {
      alert('예약 시간을 선택해주세요')
      return
    }

    setScheduling(true)
    try {
      const res = await fetch('/api/instagram/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          scheduledAt,
          caption,
          hashtags,
        }),
      })

      if (res.ok) {
        alert('게시가 예약되었습니다')
        setScheduling(false)
        setScheduledAt('')
        setCaption('')
        setHashtags('')
        window.location.reload()
      } else {
        throw new Error('Failed to schedule')
      }
    } catch (error) {
      console.error('Failed to schedule:', error)
      alert('예약에 실패했습니다')
      setScheduling(false)
    }
  }

  const handlePublishNow = async () => {
    if (!confirm('지금 바로 게시하시겠습니까?')) return

    setScheduling(true)
    try {
      const res = await fetch('/api/instagram/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: campaign.id,
          caption,
          hashtags,
        }),
      })

      if (res.ok) {
        alert('게시되었습니다')
        window.location.reload()
      } else {
        throw new Error('Failed to publish')
      }
    } catch (error) {
      console.error('Failed to publish:', error)
      alert('게시에 실패했습니다')
    } finally {
      setScheduling(false)
    }
  }

  return (
    <div className="rounded-md border border-[#e4e4e7] p-4 hover:border-[#d4d4d8] transition-colors">
      <div className="flex items-start gap-3">
        {campaign.thumbnail ? (
          <img
            src={campaign.thumbnail}
            alt={campaign.title}
            className="h-16 w-16 rounded-md object-cover shrink-0"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-md bg-[#fafafa] shrink-0">
            <Camera className="h-6 w-6 text-[#d4d4d8]" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#111111] text-sm mb-1 truncate">{campaign.title}</h3>
          <p className="text-xs text-[#71717a] mb-3">
            {campaign.slideCount}장 · {new Date(campaign.createdAt).toLocaleDateString('ko-KR')}
          </p>

          <div className="space-y-2">
            <input
              type="text"
              placeholder="캡션 (선택사항)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#E1306C]/20 focus:border-[#E1306C]"
            />

            <input
              type="text"
              placeholder="해시태그 (선택사항, 예: #마케팅 #SNS)"
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              className="w-full rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#E1306C]/20 focus:border-[#E1306C]"
            />

            <div className="flex gap-2">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="flex-1 rounded-md border border-[#e4e4e7] px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#E1306C]/20 focus:border-[#E1306C]"
              />

              <button
                onClick={handleSchedule}
                disabled={scheduling || !scheduledAt}
                className="rounded-md bg-[#111111] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#000000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
              >
                <Calendar className="h-3.5 w-3.5" />
                예약
              </button>

              <button
                onClick={handlePublishNow}
                disabled={scheduling}
                className="rounded-md bg-[#E1306C] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#C13584] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
                지금 게시
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ScheduledPostCard({ post }: { post: ScheduledPost }) {
  const scheduledDate = new Date(post.scheduledAt)
  const isPast = scheduledDate < new Date()

  return (
    <div className="rounded-md border border-[#e4e4e7] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#111111] text-sm mb-1 truncate">
            {post.campaign.title}
          </h3>
          {post.caption && (
            <p className="text-xs text-[#52525b] mb-2 line-clamp-2">{post.caption}</p>
          )}
          {post.hashtags && (
            <p className="text-xs text-[#71717a] mb-2">{post.hashtags}</p>
          )}
          <div className="flex items-center gap-1.5 text-xs">
            <Clock className="h-3.5 w-3.5 text-[#71717a]" />
            <span className="text-[#71717a]">
              {scheduledDate.toLocaleString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </div>
        </div>

        <div className="shrink-0">
          {post.status === 'posted' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              게시됨
            </span>
          ) : post.status === 'failed' ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              <AlertCircle className="h-3.5 w-3.5" />
              실패
            </span>
          ) : (
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
              isPast
                ? 'bg-yellow-50 text-yellow-700'
                : 'bg-blue-50 text-blue-700'
            }`}>
              <Calendar className="h-3.5 w-3.5" />
              {isPast ? '예약 시간 경과' : '예약됨'}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
