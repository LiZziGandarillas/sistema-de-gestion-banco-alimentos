import 'server-only'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendPasswordResetEmail(to: string, url: string): Promise<void> {
  try {
    const { error } = await resend.emails.send({
      from: 'Banco de Alimentos <onboarding@resend.dev>',
      to,
      subject: 'Restablece tu contraseña',
      text: `Recibimos una solicitud para cambiar la contraseña de tu cuenta. Usa este enlace para establecer una nueva contraseña:\n\n${url}\n\nSi no solicitaste este cambio, puedes ignorar este mensaje.`,
    })

    if (error) {
      console.error('[email] No se pudo enviar el correo de restablecimiento.')
    }
  } catch {
    console.error('[email] No se pudo enviar el correo de restablecimiento.')
  }
}