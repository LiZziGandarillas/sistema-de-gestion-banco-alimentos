import { DonationForm } from '@/components/donation-form'
import { PageHeader } from '@/components/kit'
import { todayISO } from '@/lib/domain'

export default function NewDonationPage() {
  return (
    <>
      <PageHeader
        title="Registrar donación"
        description="Añada cada producto distinto por separado. Si dos cajas del mismo producto tienen fechas distintas, regístrelas como dos productos."
      />
      <DonationForm today={todayISO()} />
    </>
  )
}
