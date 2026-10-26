'use client'

import { useState, useTransition } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { createDonation } from '@/app/actions/lots'
import { CATEGORIES, UNITS } from '@/lib/domain'
import type { ActionResult } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Field, ResultBanner, bigButton, fieldClass } from '@/components/kit'

type Item = {
  key: string
  name: string
  category: string
  unit: string
  quantity: string
  expiresAt: string
  expiryUnknown: boolean
  notes: string
}

const emptyItem = (): Item => ({
  key: crypto.randomUUID(),
  name: '',
  category: '',
  unit: 'unidades',
  quantity: '',
  expiresAt: '',
  expiryUnknown: false,
  notes: '',
})

export function DonationForm({ today }: { today: string }) {
  const [idempotencyKey, setIdempotencyKey] = useState(() => crypto.randomUUID())
  const [receivedAt, setReceivedAt] = useState(today)
  const [items, setItems] = useState<Item[]>(() => [emptyItem()])
  const [result, setResult] = useState<ActionResult | null>(null)
  const [pending, startTransition] = useTransition()

  const update = (key: string, patch: Partial<Item>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)))

  function submit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const res = await createDonation({
        idempotencyKey,
        receivedAt,
        items: items.map((i) => ({
          name: i.name,
          category: i.category as (typeof CATEGORIES)[number],
          unit: i.unit as (typeof UNITS)[number],
          quantity: Number(i.quantity.replace(',', '.')),
          expiresAt: i.expiryUnknown ? null : i.expiresAt || null,
          expiryUnknown: i.expiryUnknown,
          notes: i.notes,
        })),
      })
      setResult(res)
      if (res.ok) {
        setItems([emptyItem()])
        setIdempotencyKey(crypto.randomUUID())
      }
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <ResultBanner result={result} />

      <div className="max-w-xs">
        <Field label="Fecha en que llegó la donación" htmlFor="receivedAt">
          <input
            id="receivedAt"
            type="date"
            required
            max={today}
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            className={fieldClass}
          />
        </Field>
      </div>

      <ol className="flex flex-col gap-5">
        {items.map((item, index) => (
          <li key={item.key} className="flex flex-col gap-4 rounded-xl border-2 border-border bg-card p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">{`Producto ${index + 1}`}</h2>
              {items.length > 1 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 gap-2 text-base"
                  onClick={() => setItems((l) => l.filter((i) => i.key !== item.key))}
                >
                  <Trash2 className="size-5" aria-hidden="true" />
                  Quitar
                </Button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Nombre del producto" htmlFor={`name-${item.key}`} help="Por ejemplo: arroz blanco 1 kg">
                <input
                  id={`name-${item.key}`}
                  required
                  minLength={2}
                  value={item.name}
                  onChange={(e) => update(item.key, { name: e.target.value })}
                  className={fieldClass}
                />
              </Field>
              <Field label="Categoría" htmlFor={`cat-${item.key}`}>
                <select
                  id={`cat-${item.key}`}
                  required
                  value={item.category}
                  onChange={(e) => update(item.key, { category: e.target.value })}
                  className={fieldClass}
                >
                  <option value="" disabled>
                    Elija una…
                  </option>
                  {CATEGORIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cantidad" htmlFor={`qty-${item.key}`}>
                  <input
                    id={`qty-${item.key}`}
                    required
                    inputMode="decimal"
                    pattern="[0-9]+([.,][0-9]{1,2})?"
                    value={item.quantity}
                    onChange={(e) => update(item.key, { quantity: e.target.value })}
                    className={fieldClass}
                  />
                </Field>
                <Field label="Unidad" htmlFor={`unit-${item.key}`}>
                  <select
                    id={`unit-${item.key}`}
                    value={item.unit}
                    onChange={(e) => update(item.key, { unit: e.target.value })}
                    className={fieldClass}
                  >
                    {UNITS.map((u) => (
                      <option key={u}>{u}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <div className="flex flex-col gap-3">
                <Field label="Fecha de caducidad" htmlFor={`exp-${item.key}`}>
                  <input
                    id={`exp-${item.key}`}
                    type="date"
                    required={!item.expiryUnknown}
                    disabled={item.expiryUnknown}
                    value={item.expiryUnknown ? '' : item.expiresAt}
                    onChange={(e) => update(item.key, { expiresAt: e.target.value })}
                    className={fieldClass}
                  />
                </Field>
                <label className="flex items-center gap-3 text-base">
                  <input
                    type="checkbox"
                    checked={item.expiryUnknown}
                    onChange={(e) => update(item.key, { expiryUnknown: e.target.checked })}
                    className="size-6 accent-primary"
                  />
                  No tiene fecha visible (se pedirá revisarlo cada cierto tiempo)
                </label>
              </div>
            </div>
            {item.expiresAt && item.expiresAt < today && !item.expiryUnknown ? (
              <p role="alert" className="rounded-lg bg-warning p-3 text-base font-bold text-warning-foreground">
                Esta fecha ya ha pasado. El lote quedará bloqueado hasta que alguien lo revise.
              </p>
            ) : null}
            <Field label="Notas (opcional)" htmlFor={`notes-${item.key}`} help="Estado del envase, quién lo donó, etc.">
              <input
                id={`notes-${item.key}`}
                value={item.notes}
                maxLength={500}
                onChange={(e) => update(item.key, { notes: e.target.value })}
                className={fieldClass}
              />
            </Field>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          variant="outline"
          className={bigButton}
          onClick={() => setItems((l) => [...l, { ...emptyItem(), category: l.at(-1)?.category ?? '' }])}
          disabled={items.length >= 40}
        >
          <Plus aria-hidden="true" />
          Añadir otro producto
        </Button>
        <Button type="submit" className={bigButton} disabled={pending}>
          {pending ? 'Guardando…' : `Guardar donación (${items.length} ${items.length === 1 ? 'producto' : 'productos'})`}
        </Button>
      </div>
    </form>
  )
}
