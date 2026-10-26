'use client'

import { useState, useTransition } from 'react'
import { discardFromLot, reviewLot } from '@/app/actions/lots'
import type { ActionResult } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Field, ResultBanner, bigButton, fieldClass } from '@/components/kit'

type Mode = null | 'review' | 'discard'

export function LotActions({
  lotId,
  unit,
  available,
  alertKind,
}: {
  lotId: number
  unit: string
  available: number
  alertKind: string
}) {
  const [mode, setMode] = useState<Mode>(alertKind === 'vencido' || alertKind === 'revisar' ? 'review' : null)
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  function onReview(decision: 'apto' | 'descartar', form: HTMLFormElement) {
    const note = String(new FormData(form).get('note') ?? '')
    startTransition(async () => {
      const res = await reviewLot({ lotId, decision, note })
      setResult(res)
      if (res.ok) setMode(null)
    })
  }

  function onDiscard(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await discardFromLot({
        lotId,
        quantity: Number(String(f.get('quantity')).replace(',', '.')),
        reason: String(f.get('reason') ?? ''),
      })
      setResult(res)
      if (res.ok) setMode(null)
    })
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border pt-4">
      <ResultBanner result={result} />
      {mode === null ? (
        <div className="flex flex-col gap-3">
          <Button variant="outline" className={bigButton} onClick={() => setMode('review')}>
            Revisar producto
          </Button>
          <Button variant="outline" className={bigButton} onClick={() => setMode('discard')}>
            Retirar una parte
          </Button>
        </div>
      ) : null}

      {mode === 'review' ? (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            onReview('apto', e.currentTarget)
          }}
        >
          <p className="text-lg font-bold">Mire el producto. ¿Está en buen estado?</p>
          <p className="text-base text-muted-foreground">
            “Consumir preferentemente” puede seguir siendo apto. “Fecha de caducidad” pasada: retírelo.
          </p>
          <Field label="¿Qué ha comprobado?" htmlFor="note">
            <input id="note" name="note" required minLength={3} maxLength={500} className={fieldClass} />
          </Field>
          <div className="flex flex-col gap-3">
            <Button type="submit" className={bigButton} disabled={pending}>
              Está bien, sigue disponible
            </Button>
            <Button
              type="button"
              variant="destructive"
              className={bigButton}
              disabled={pending}
              onClick={(e) => {
                const form = e.currentTarget.form!
                if (form.reportValidity()) onReview('descartar', form)
              }}
            >
              {`Retirar todo (${available} ${unit})`}
            </Button>
            <Button type="button" variant="ghost" className={bigButton} onClick={() => setMode(null)}>
              Cancelar
            </Button>
          </div>
        </form>
      ) : null}

      {mode === 'discard' ? (
        <form className="flex flex-col gap-4" onSubmit={onDiscard}>
          <Field label={`Cantidad a retirar (${unit})`} htmlFor="quantity" help={`Quedan ${available} ${unit}.`}>
            <input id="quantity" name="quantity" required inputMode="decimal" className={fieldClass} />
          </Field>
          <Field label="Motivo" htmlFor="reason" help="Por ejemplo: envase roto, mojado, abierto.">
            <input id="reason" name="reason" required minLength={3} maxLength={500} className={fieldClass} />
          </Field>
          <Button type="submit" variant="destructive" className={bigButton} disabled={pending}>
            {pending ? 'Guardando…' : 'Registrar retirada'}
          </Button>
          <Button type="button" variant="ghost" className={bigButton} onClick={() => setMode(null)}>
            Cancelar
          </Button>
        </form>
      ) : null}
    </div>
  )
}
