import { parseItemLines, parseItemsCsv } from './items-import'

describe('parseItemLines', () => {
  test('drops blank lines and splits title | description at the first pipe', () => {
    expect(parseItemLines('A\n\n B | mô tả | x ')).toEqual([
      { title: 'A', description: '' },
      { title: 'B', description: 'mô tả | x' },
    ])
  })
  test('moves a leading ticket key into externalRef', () => {
    expect(parseItemLines('PAY-142 Tích hợp VNPay')).toEqual([
      { title: 'Tích hợp VNPay', description: '', externalRef: 'PAY-142' },
    ])
  })
  test('keeps the title when it is only a key', () => {
    expect(parseItemLines('PAY-142')).toEqual([{ title: 'PAY-142', description: '', externalRef: 'PAY-142' }])
  })
})

describe('parseItemsCsv', () => {
  test('parses quotes, escaped quotes and newlines inside cells', () => {
    const csv = 'title,description,key\r\n"Login, SSO","dòng 1\nđòng ""2""",AUTH-1\r\nPlain,,\r\n'
    expect(parseItemsCsv(csv)).toEqual([
      { title: 'Login, SSO', description: 'dòng 1\nđòng "2"', externalRef: 'AUTH-1' },
      { title: 'Plain', description: '' },
    ])
  })
  test('works with a BOM and without optional columns', () => {
    expect(parseItemsCsv('\uFEFFtitle\nOne\nTwo')).toEqual([
      { title: 'One', description: '' },
      { title: 'Two', description: '' },
    ])
  })
  test('rejects a missing title column', () => {
    expect(() => parseItemsCsv('name\nx')).toThrow('CSV_NO_TITLE')
  })
  test('throws TOO_MANY_ITEMS above 500 rows', () => {
    const rows = Array.from({ length: 501 }, (_, i) => `T${i}`).join('\n')
    expect(() => parseItemsCsv(`title\n${rows}`)).toThrow('TOO_MANY_ITEMS')
    expect(parseItemsCsv(`title\n${rows.split('\n').slice(0, 500).join('\n')}`)).toHaveLength(500)
  })
})
