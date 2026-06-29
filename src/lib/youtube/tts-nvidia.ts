import os from 'node:os'
import path from 'node:path'
import fs from 'node:fs'
import grpc from '@grpc/grpc-js'
import protoLoader from '@grpc/proto-loader'

const NVIDIA_GRPC_SERVER = 'grpc.nvcf.nvidia.com:443'
const CHATTERBOX_FUNCTION_ID = 'ddacc747-1269-4fab-bfd9-8f593dead106'

const DEFAULT_VOICE_KO = 'Chatterbox-Multilingual.ko-KR.Male'
const DEFAULT_VOICE_EN = 'Chatterbox-Multilingual.en-US.Male'

// Embed the proto definition inline so it works regardless of the bundle path in production.
const RIVA_TTS_PROTO = `
syntax = "proto3";
package nvidia.riva.tts;

enum AudioEncoding {
  ENCODING_UNSPECIFIED = 0;
  LINEAR_PCM = 1;
  FLAC = 2;
  MULAW = 3;
  MP3 = 11;
  OPUS = 12;
}

message SynthesizeSpeechRequest {
  string text = 1;
  string language_code = 2;
  AudioEncoding encoding = 3;
  float sample_rate_hz = 4;
  string voice_name = 5;
}

message SynthesizeSpeechResponse {
  bytes audio = 1;
  AudioEncoding encoding = 2;
  string phonemes = 3;
  repeated float durations_start = 4;
  repeated float durations_end = 5;
}

message RivaSynthesisConfigRequest {}

message Voice {
  string name = 1;
  string language_code = 2;
}

message RivaSynthesisConfigResponse {
  repeated Voice voices = 2;
}

service RivaSpeechSynthesis {
  rpc Synthesize(SynthesizeSpeechRequest) returns (SynthesizeSpeechResponse) {}
  rpc SynthesizeOnline(SynthesizeSpeechRequest) returns (stream SynthesizeSpeechResponse) {}
  rpc GetRivaSynthesisConfig(RivaSynthesisConfigRequest) returns (RivaSynthesisConfigResponse) {}
}
`

// Write the proto to tmpdir once and reuse the path.
let _protoPath: string | null = null
function getProtoPath(): string {
  if (_protoPath) return _protoPath
  const tmpPath = path.join(os.tmpdir(), 'shuffla-riva-tts.proto')
  fs.writeFileSync(tmpPath, RIVA_TTS_PROTO, 'utf8')
  _protoPath = tmpPath
  return tmpPath
}

let _clientCache: ReturnType<typeof buildClient> | null = null

function buildClient(apiKey: string) {
  const packageDef = protoLoader.loadSync(getProtoPath(), {
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
