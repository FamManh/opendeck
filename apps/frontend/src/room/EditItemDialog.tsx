import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { Item } from '@/domain'
import type { ClientCommand } from '@/store/roomStore'

export function EditItemDialog({ item, onClose, send }: { item: Item; onClose: () => void; send: (c: ClientCommand) => Promise<void> }) {
  const { t } = useTranslation()
  const [title, setTitle] = useState(item.title)
  const [key, setKey] = useState(item.externalRef ?? '')
  const [desc, setDesc] = useState(item.description)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try {
      await send({ type: 'editItem', itemId: item.id, title, description: desc, externalRef: key })
      onClose()
    } catch { /* the store already toasted the error */ } finally { setBusy(false) }
  }
  return (
    <Dialog open onOpenChange={o => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90svh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addItems.editTitle')}</DialogTitle>
          <DialogDescription className="sr-only">{t('addItems.editTitle')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-title">{t('addItems.titleLabel')}</Label>
          <Input id="edit-title" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-key">{t('addItems.keyLabel')}</Label>
          <Input id="edit-key" value={key} placeholder={t('addItems.keyPlaceholder')} onChange={e => setKey(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="edit-desc">{t('addItems.descLabel')}</Label>
          <textarea id="edit-desc" className="min-h-28 w-full resize-none rounded-2xl bg-input p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button disabled={!title.trim() || busy} onClick={() => void save()}>{t('profile.save')}</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
