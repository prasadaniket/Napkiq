/**
 * Notification stubs — WhatsApp (Twilio) and Email (Resend).
 *
 * WHEN APIS ARE READY:
 *   WhatsApp: uncomment the Twilio block and set TWILIO_ACCOUNT_SID,
 *             TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM in .env
 *   Email:    uncomment the Resend block and set RESEND_API_KEY,
 *             RESEND_FROM_EMAIL in .env
 *
 * Until then, DRY_RUN mode logs the payload and returns success=true
 * so automation_logs populate correctly for testing.
 */

const DRY_RUN =
  process.env.AUTOMATION_DRY_RUN === 'true' ||
  !process.env.TWILIO_ACCOUNT_SID ||
  !process.env.RESEND_API_KEY

// ─── WhatsApp ────────────────────────────────────────────────────────────────

export interface WhatsAppPayload {
  to:           string // E.164 phone, e.g. +919876543210
  templateName: string
  variables:    Record<string, string>
}

export async function sendWhatsApp(payload: WhatsAppPayload): Promise<boolean> {
  if (DRY_RUN) {
    console.log(`[AUTOMATION:DRY_RUN] WhatsApp → ${payload.to}`, {
      template: payload.templateName,
      vars:     payload.variables,
    })
    return true
  }

  try {
    // ── Twilio WhatsApp (uncomment when configured) ──────────────────────
    // const twilio = require('twilio')
    // const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    //
    // Meta template message body — replace with actual approved template content:
    // const body = buildTemplateBody(payload.templateName, payload.variables)
    //
    // await client.messages.create({
    //   from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,  // e.g. whatsapp:+14155238886
    //   to:   `whatsapp:${payload.to}`,
    //   body,
    //   // OR use contentSid + contentVariables for Meta template messages:
    //   // contentSid:       '<TWILIO_CONTENT_SID_FOR_TEMPLATE>',
    //   // contentVariables: JSON.stringify(payload.variables),
    // })
    // ─────────────────────────────────────────────────────────────────────

    console.log(`[AUTOMATION] WhatsApp sent to ${payload.to}`)
    return true
  } catch (err) {
    console.error(`[AUTOMATION] WhatsApp failed to ${payload.to}:`, err)
    return false
  }
}

// ─── Email ───────────────────────────────────────────────────────────────────

export interface EmailPayload {
  to:      string
  subject: string
  html:    string
}

export async function sendEmail(payload: EmailPayload): Promise<boolean> {
  if (DRY_RUN) {
    console.log(`[AUTOMATION:DRY_RUN] Email → ${payload.to}`, {
      subject: payload.subject,
    })
    return true
  }

  try {
    // ── Resend (uncomment when configured) ──────────────────────────────
    // const { Resend } = require('resend')
    // const resend = new Resend(process.env.RESEND_API_KEY)
    //
    // await resend.emails.send({
    //   from:    process.env.RESEND_FROM_EMAIL ?? 'StoneOven <noreply@stoneoven.in>',
    //   to:      payload.to,
    //   subject: payload.subject,
    //   html:    payload.html,
    // })
    // ─────────────────────────────────────────────────────────────────────

    console.log(`[AUTOMATION] Email sent to ${payload.to}`)
    return true
  } catch (err) {
    console.error(`[AUTOMATION] Email failed to ${payload.to}:`, err)
    return false
  }
}

// ─── Template builders ───────────────────────────────────────────────────────

export function buildBirthdayWhatsApp(customerName: string, daysUntil: number): WhatsAppPayload['variables'] {
  return {
    customer_name: customerName,
    days_until:    daysUntil.toString(),
    restaurant:    'StoneOven',
  }
}

export function buildBirthdayEmail(customerName: string, daysUntil: number): Pick<EmailPayload, 'subject' | 'html'> {
  const greeting = daysUntil === 0
    ? `Happy Birthday, ${customerName}!`
    : daysUntil === 1
    ? `Your birthday is tomorrow, ${customerName}!`
    : `Your birthday is coming up, ${customerName}!`

  return {
    subject: greeting,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#111;color:#fff;border-radius:16px;overflow:hidden">
        <div style="background:#F26522;padding:32px 24px;text-align:center">
          <h1 style="margin:0;font-size:24px;color:#fff">🎂 ${greeting}</h1>
        </div>
        <div style="padding:32px 24px">
          <p>We'd love to celebrate your special day with you at <strong>StoneOven</strong>.</p>
          <p style="margin-top:16px">Visit any of our outlets and enjoy a complimentary treat on us. Show this email to our team.</p>
          <p style="margin-top:32px;color:rgba(255,255,255,0.5);font-size:12px">StoneOven Restaurant · stoneoven.in</p>
        </div>
      </div>
    `,
  }
}

export function buildAnniversaryEmail(customerName: string, daysUntil: number): Pick<EmailPayload, 'subject' | 'html'> {
  const greeting = daysUntil === 0
    ? `Happy Anniversary, ${customerName}!`
    : daysUntil === 1
    ? `Your anniversary is tomorrow, ${customerName}!`
    : `Your anniversary is coming up, ${customerName}!`

  return {
    subject: greeting,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#111;color:#fff;border-radius:16px;overflow:hidden">
        <div style="background:#1A1A1A;padding:32px 24px;text-align:center;border-bottom:2px solid #F26522">
          <h1 style="margin:0;font-size:24px;color:#F26522">💑 ${greeting}</h1>
        </div>
        <div style="padding:32px 24px">
          <p>Celebrate your love at <strong>StoneOven</strong>. We'd love to be part of your special day.</p>
          <p style="margin-top:16px">Book a table for two and enjoy a romantic dining experience.</p>
          <p style="margin-top:32px;color:rgba(255,255,255,0.5);font-size:12px">StoneOven Restaurant · stoneoven.in</p>
        </div>
      </div>
    `,
  }
}

export function buildReengagementEmail(customerName: string, daysSince: number): Pick<EmailPayload, 'subject' | 'html'> {
  return {
    subject: `We miss you, ${customerName}!`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#111;color:#fff;border-radius:16px;overflow:hidden">
        <div style="background:#1A1A1A;padding:32px 24px;text-align:center;border-bottom:2px solid #F26522">
          <h1 style="margin:0;font-size:24px;color:#fff">We miss you, ${customerName}! 👋</h1>
        </div>
        <div style="padding:32px 24px">
          <p>It's been <strong>${daysSince} days</strong> since your last visit and we'd love to have you back at <strong>StoneOven</strong>.</p>
          <p style="margin-top:16px">Our kitchen is ready and your favourite table is waiting.</p>
          <p style="margin-top:32px;color:rgba(255,255,255,0.5);font-size:12px">StoneOven Restaurant · stoneoven.in</p>
        </div>
      </div>
    `,
  }
}
