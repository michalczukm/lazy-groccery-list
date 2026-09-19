const REQUEST_BODY = { text: 'mleko\nchleb' }

export async function checkPreviewAi(baseUrl, fetchImpl = fetch) {
  const response = await fetchImpl(`${baseUrl.replace(/\/+$/, '')}/api/integrations/categorize`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(REQUEST_BODY),
  })

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Preview AI check failed with HTTP ${response.status}`)
  }

  let body
  try {
    body = await response.json()
  } catch {
    throw new Error('Preview AI check returned invalid JSON')
  }

  if (!body || typeof body.url !== 'string') {
    throw new Error('Preview AI check returned an invalid body')
  }

  return body
}

async function runCli(argv) {
  const [baseUrl] = argv
  if (!baseUrl) {
    throw new Error('Usage: node scripts/check-preview-ai.js <preview-base-url>')
  }

  const result = await checkPreviewAi(baseUrl)
  console.log(`Preview AI check passed: ${result.url}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
