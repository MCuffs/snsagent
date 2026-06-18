import ExcelJS from '/opt/homebrew/lib/node_modules/ae-tracking/node_modules/exceljs/dist/es5/exceljs.nodejs.js'
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const XLSX = require('/opt/homebrew/lib/node_modules/ae-tracking/node_modules/xlsx/xlsx.js')

// ── 원본 draft.xlsx 읽기 (CLI 생성 버전) ──────────────────────────────────
const source = XLSX.readFile('.ae-tracking/draft.xlsx')

// 시트명 매핑 (중국어 → 한국어)
const SHEET_MAP = {
  '#事件数据':     '#이벤트 데이터',
  '#公共事件属性': '#공통 이벤트 속성',
  '#用户数据':     '#유저 데이터',
  '#用户ID体系':   '#유저 ID 체계',
}

// 헤더 매핑 (중국어 → 한국어)
const HEADER_MAP = {
  '事件名（必填）':   '이벤트 이름 (필수)',
  '事件显示名':       '이벤트 별칭',
  '事件说明':         '이벤트 설명',
  '事件标签':         '이벤트 태그',
  '采集端':           '플랫폼',
  '属性名（必填）':   '속성 이름 (필수)',
  '属性显示名':       '속성 별칭',
  '属性类型（必填）': '속성 유형 (필수)',
  '属性说明':         '속성 설명',
  // 공통 속성
  '属性名':           '속성 이름 (필수)',
  // 유저 데이터
  '更新方式':         '업데이트 방식',
  '属性标签':         '속성 태그',
  // 유저 ID
  '属性显示名':       '속성 별칭',
  '赋值说明':         '값 설명',
}

// 속성 타입 매핑 (중국어 → 영어)
const TYPE_MAP = {
  '文本':   'string',
  '数值':   'number',
  '布尔':   'boolean',
  '时间':   'time',
  '列表':   'list',
  '对象':   'object',
  '对象组': 'array',
}

const wb = new ExcelJS.Workbook()

for (const [srcName, dstName] of Object.entries(SHEET_MAP)) {
  const srcSheet = source.Sheets[srcName]
  if (!srcSheet) { console.warn('Sheet not found:', srcName); continue }

  const rows = XLSX.utils.sheet_to_json(srcSheet, { header: 1, defval: '' })
  const ws = wb.addWorksheet(dstName)

  rows.forEach((row, ri) => {
    const mapped = row.map(cell => {
      if (typeof cell !== 'string') return cell
      // 헤더 매핑
      if (ri === 0) return HEADER_MAP[cell] ?? cell
      // 타입 매핑
      return TYPE_MAP[cell] ?? cell
    })
    ws.addRow(mapped)
  })
}

await wb.xlsx.writeFile('.ae-tracking/draft-ko.xlsx')
console.log('✅ wrote .ae-tracking/draft-ko.xlsx')
