import path from 'path'
import { Resvg } from '@resvg/resvg-js'

const FONT_FILES = [
  path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'fonts', 'Pretendard-Regular.otf'),
  path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'fonts', 'Pretendard-SemiBold.otf'),
  path.join(/*turbopackIgnore: true*/ process.cwd(), 'public', 'fonts', 'Pretendard-Bold.otf'),
]

export function renderSvgToPng(svg: string, scale = 1): Buffer {
  const renderer = new Resvg(svg, {
    fitTo: scale > 1 ? { mode: 'zoom', value: scale } : undefined,
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: true,
      defaultFontFamily: 'Pretendard',
      sansSerifFamily: 'Pretendard',
    },
  })

  return Buffer.from(renderer.render().asPng())
}
