import path from 'node:path'
import { fileURLToPath } from 'node:url'
import grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const PROTO_PATH = path.join(MODULE_DIR, 'riva_tts.proto')

const NVIDIA_GRPC_SERVER = 'grpc.nvcf.nvidia.com:443'
const CHATTERBOX_FUNCTION_ID = 'ddacc747-1269-4fab-bfd9-8f593dead106'

// Korean voice — falls back to en-US male if no KO voice found at runtime.
// Available voices can be listed via GetRivaSynthesisConfig.
const DEFAULT_VOICE_KO = 'Chatterbox-Multilingual.ko-KR.Male'
const DEFAULT_VOICE_EN = 'Chatterbox-Multilingual.en-US.Male'

let _clientCache: ReturnType<typeof buildClient> | null = null

function buildClient(apiKey: string) {
  const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const proto = grpc.loadPackageDefinition(packageDef) as any
  const credentials = grpc.credentials.createSsl()
  const callCreds = grpc.credentials.createFromMetadataGenerator((_params, callback) => {
    const meta = new grpc.Metadata()
    meta.add('authorization', `Bearer ${apiKey}`)
    meta.add('function-id', CHATTERBOX_FUNCTION_ID)
    callback(null, meta)
  })
  const combinedCreds = grpc.credentials.combineChannelCredentials(credentials, callCreds)
  return new proto.nvidia.riva.tts.RivaSpeechSynthesis(NVIDIA_GRPC_SERVER, combinedCreds)
}

function getClient(apiKey: string) {
  if (!_clientCache) {
    _clientCache = buildClient(apiKey)
  }
  return _clientCache
}

/**
 * Synthesize speech using NVIDIA Chatterbox Multilingual TTS.
 * Returns raw WAV (LINEAR_PCM) bytes.
 */
export async function synthesizeWithNvidia(text: string, locale = 'ko'): Promise<Buffer> {
  const apiKey = process.env.NVIDIA_API_KEY
  if (!apiKey) throw new Error('NVIDIA_API_KEY is not set')

  const isKo = locale.startsWith('ko')
  const voice = isKo ? DEFAULT_VOICE_KO : DEFAULT_VOICE_EN
  const languageCode = isKo ? 'ko-KR' : 'en-US'

  const client = getClient(apiKey)

  return new Promise<Buffer>((resolve, reject) => {
    client.Synthesize(
      {
        text,
        language_code: languageCode,
        encoding: 'LINEAR_PCM',
        sample_rate_hz: 22050,
        voice_name: voice,
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (err: grpc.ServiceError | null, response: any) => {
        if (err) {
          reject(new Error(`[NVIDIA TTS] gRPC error ${err.code}: ${err.message}`))
          return
        }
        if (!response?.audio || response.audio.length === 0) {
          reject(new Error('[NVIDIA TTS] Empty audio response'))
          return
        }
        resolve(Buffer.from(response.audio))
      },
    )
  })
}

export function isNvidiaTtsAvailable(): boolean {
  const key = process.env.NVIDIA_API_KEY
  return typeof key === 'string' && key.length > 10
}
