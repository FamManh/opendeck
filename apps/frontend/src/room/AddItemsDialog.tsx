import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { NewItem } from '@/domain'
import { parseItemLines, parseItemsCsv } from '@/lib/items-import'

export interface AddItemsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSubmit: (items: NewItem[]) => Promise<void>
}

const areaClass = 'min-h-32 w-full resize-none rounded-2xl bg-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring'

export function AddItemsDialog({ open, onOpenChange, onSubmit }: AddItemsDialogProps) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('manual')
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [key, setKey] = useState('')
  const [lines, setLines] = useState('')
  const [csv, setCsv] = useState<{ items: NewItem[]; error: string | null }>({ items: [], error: null })
  const [busy, setBusy] = useState(false)

  const items: NewItem[] =
    tab === 'manual' ? (title.trim() ? [{ title: title.trim(), description: desc.trim(), ...(key.trim() && { externalRef: key.trim() }) }] : [])
    : tab === 'paste' ? parseItemLines(lines)
    : csv.items

  const reset = () => { setTitle(''); setDesc(''); setKey(''); setLines(''); setCsv({ items: [], error: null }) }

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    try {
      setCsv({ items: parseItemsCsv(await file.text()), error: null })
    } catch (e) {
      setCsv({ items: [], error: e instanceof Error && e.message === 'TOO_MANY_ITEMS' ? 'addItems.errTooMany' : 'addItems.errCsv' })
    }
  }

  const submit = async () => {
    if (!items.length || busy) return
    setBusy(true)
    try {
      await onSubmit(items)
      reset()
      onOpenChange(false)
    } catch { /* the store already toasted the error */ } finally { setBusy(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('addItems.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('addItems.title')}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList className="h-auto w-full justify-start gap-1 rounded-3xl bg-muted p-1">
            <TabsTrigger value="manual" className="h-9 rounded-full px-3 text-[13px] font-semibold">{t('addItems.tabManual')}</TabsTrigger>
            <TabsTrigger value="paste" className="h-9 rounded-full px-3 text-[13px] font-semibold">{t('addItems.tabPaste')}</TabsTrigger>
            <TabsTrigger value="csv" className="h-9 rounded-full px-3 text-[13px] font-semibold">{t('addItems.tabCsv')}</TabsTrigger>
          </TabsList>
          <TabsContent value="manual" className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-title">{t('addItems.titleLabel')}</Label>
              <Input id="add-title" value={title} onChange={e => setTitle(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-key">{t('addItems.keyLabel')}</Label>
              <Input id="add-key" value={key} placeholder={t('addItems.keyPlaceholder')} onChange={e => setKey(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="add-desc">{t('addItems.descLabel')}</Label>
              <textarea id="add-desc" className={areaClass} value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
          </TabsContent>
          <TabsContent value="paste" className="flex flex-col gap-2">
            <Label htmlFor="add-lines">{t('addItems.pasteLabel')}</Label>
            <textarea id="add-lines" className={areaClass} value={lines} onChange={e => setLines(e.target.value)} />
            <p className="text-[13px] text-muted-foreground">{t('addItems.pasteHint')}</p>
          </TabsContent>
          <TabsContent value="csv" className="flex flex-col gap-2">
            <Label htmlFor="add-csv">{t('addItems.csvPick')}</Label>
            <input id="add-csv" type="file" accept=".csv,text/csv" onChange={e => void pickFile(e.target.files?.[0])} className="text-sm file:mr-3 file:h-9 file:rounded-full file:border-0 file:bg-secondary file:px-4 file:font-semibold" />
            <p className="text-[13px] text-muted-foreground">{t('addItems.csvHint')}</p>
            {csv.error && <p role="alert" className="text-sm text-destructive">{t(csv.error)}</p>}
          </TabsContent>
        </Tabs>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{t('addItems.count', { count: items.length })}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
            <Button disabled={!items.length || busy} onClick={() => void submit()}>{t('addItems.submit')}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
