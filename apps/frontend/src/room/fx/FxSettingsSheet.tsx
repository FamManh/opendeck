import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { type FxLevel, useFxPrefs } from '@/fx/prefs'
import { useIsMobile } from '@/lib/useIsMobile'

const LEVELS: FxLevel[] = ['full', 'medium', 'minimal']

export function FxSettingsSheet() {
  const { t } = useTranslation()
  const mobile = useIsMobile()
  const { prefs, set } = useFxPrefs()
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="size-10 bg-background" aria-label={t('fx.open')}><Sparkles /></Button>
      </SheetTrigger>
      <SheetContent side={mobile ? 'bottom' : 'right'} className="gap-4 p-5">
        <SheetHeader className="p-0">
          <SheetTitle>{t('fx.title')}</SheetTitle>
          <SheetDescription>{t('fx.description')}</SheetDescription>
        </SheetHeader>
        <RadioGroup value={prefs.level} onValueChange={v => set({ level: v as FxLevel })} aria-label={t('fx.title')}>
          {LEVELS.map(l => (
            <Label key={l} htmlFor={`fx-${l}`} className="flex cursor-pointer items-start gap-3 rounded-2xl bg-muted p-3">
              <RadioGroupItem id={`fx-${l}`} value={l} className="mt-1" />
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{t(`fx.level.${l}`)}</span>
                <span className="text-[13px] font-normal text-muted-foreground">{t(`fx.levelDesc.${l}`)}</span>
              </span>
            </Label>
          ))}
        </RadioGroup>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="fx-sound">{t('fx.sound')}</Label>
          <Switch id="fx-sound" checked={prefs.sound} onCheckedChange={sound => set({ sound })} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="fx-reduced">{t('fx.followReduced')}</Label>
          <Switch id="fx-reduced" checked={prefs.followReducedMotion} onCheckedChange={followReducedMotion => set({ followReducedMotion })} />
        </div>
        <p className="text-[13px] text-muted-foreground">{t('fx.localOnly')}</p>
      </SheetContent>
    </Sheet>
  )
}
