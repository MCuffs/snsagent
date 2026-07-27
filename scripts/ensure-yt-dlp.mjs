import { createHash } from 'node:crypto'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const RELEASE = '2026.06.09'
const RELEASE_ASSETS = {
  'darwin-arm64': {
    name: 'yt-dlp_macos',
    sha256: 'b82c3626952e6c14eaf654cc565866775ffd0b9ffb7021628ac59b42c2f4f244',
  },
  'darwin-x64': {
    name: 'yt-dlp_macos',
    sha256: 'b82c3626952e6c14eaf654cc565866775ffd0b9ffb7021628ac59b42c2f4f244',
  },
  'linux-arm64': {
    name: 'yt-dlp_linux_aarch64',
    sha256: 'cabd246445bdfde0eda0dfe68bbe90354be83f3fdbbf077df11a2ea55f41cdbd',
  },
  'linux-x64': {
    name: 'yt-dlp_linux',
    sha256: 'bf8aac79b72287a6d2043074415132558b43743a8f9461a22b0141e90f16ce66',
  },
}

const asset = RELEASE_ASSETS[`${process.platform}-${process.arch}`]
if (!asset) {
  console.log(`[yt-dlp] Using the package binary on ${process.platform}-${process.arch}.`)
  process.exit(0)
}

const destination = path.join(process.cwd(), 'vendor', 'yt-dlp')
const checksum = buffer => createHash('sha256').update(buffer).digest('hex')

let existing = null
try {
  existing = await readFile(destination)
} catch {
  // The binary is generated during the deployment build.
}

if (existing && checksum(existing) === asset.sha256) {
  await chmod(destination, 0o755)
  console.log('[yt-dlp] Verified cached standalone binary.')
  process.exit(0)
}

const url = `https://github.com/yt-dlp/yt-dlp/releases/download/${RELEASE}/${asset.name}`
console.log(`[yt-dlp] Downloading ${asset.name} ${RELEASE}...`)
const response = await fetch(url)
if (!response.ok) {
  throw new Error(`[yt-dlp] Download failed: ${response.status} ${response.statusText}`)
}

const binary = Buffer.from(await response.arrayBuffer())
const actualChecksum = checksum(binary)
if (actualChecksum !== asset.sha256) {
  throw new Error(
    `[yt-dlp] Checksum mismatch: expected ${asset.sha256}, received ${actualChecksum}`,
  )
}

await mkdir(path.dirname(destination), { recursive: true })
await writeFile(destination, binary, { mode: 0o755 })
await chmod(destination, 0o755)
console.log('[yt-dlp] Standalone binary installed and verified.')
