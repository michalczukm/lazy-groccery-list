const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export type TurnstileResult = { success: boolean }

export type VerifyTurnstileInput = {
  token: string
  ip: string | null
  secret: string
}

export const verifyTurnstile = async ({
  token,
  ip,
  secret,
}: VerifyTurnstileInput): Promise<TurnstileResult> => {
  const body: Record<string, string> = { secret, response: token }
  if (ip) body.remoteip = ip

  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) return { success: false }
    const data = (await res.json()) as { success?: boolean }
    return { success: data.success === true }
  } catch {
    return { success: false }
  }
}
