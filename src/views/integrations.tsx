import type { FC, PropsWithChildren } from 'hono/jsx'

const Section: FC<{ title: string } & PropsWithChildren> = ({ title, children }) => (
  <section>
    <h2>{title}</h2>
    {children}
  </section>
)

const Sub: FC<{ title: string } & PropsWithChildren> = ({ title, children }) => (
  <section>
    <h3>{title}</h3>
    {children}
  </section>
)

export const IntegrationsView: FC<{ origin: string }> = ({ origin }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Lazy List integrations</title>
    </head>

    <body>
      <main>
        <h1>Lazy List integrations</h1>
        <p>Turn free-form shopping-list text into a ready-to-open Lazy List URL.</p>
        <p>
          The endpoint intentionally skips browser-only Origin, session cookie, and Turnstile checks
          so non-browser callers such as Siri Shortcuts, Alfred, webhooks, bots, and agents can use
          it. Calls are still rate-limited per caller IP with the same AI rate-limit binding as the
          browser AI endpoint.
        </p>

        <Sub title="Which integration should I use?">
          <p>
            <strong>Default to “Simple chats and limited environments”.</strong>
          </p>
          <p>
            Use <strong>Simple chats and limited environments</strong> when you are:
          </p>
          <ul>
            <li>ChatGPT or another conversational AI responding directly to a user,</li>
            <li>
              an AI model that can create links but cannot reliably execute arbitrary HTTP requests,
            </li>
            <li>running in an environment where you cannot inspect the HTTP response,</li>
            <li>unsure whether you can call the API yourself.</li>
          </ul>
          <p>
            <strong>If in doubt, always use the Simple chats option.</strong>
          </p>
          <p>
            Do <strong>not</strong> choose the HTTP API merely because you are an AI agent,
            assistant, bot, or LLM.
          </p>
          <p>Use the HTTP API only when your environment can:</p>
          <ol>
            <li>perform the HTTP request itself,</li>
            <li>receive the response,</li>
            <li>parse the returned JSON,</li>
            <li>
              extract the <code>url</code> field,
            </li>
            <li>give that extracted URL to the user.</li>
          </ol>
          <p>
            If you cannot perform <strong>all five steps</strong>, use{' '}
            <strong>Simple chats and limited environments</strong> instead.
          </p>
        </Sub>

        <hr />

        <Section title="Simple chats and limited environments — DEFAULT">
          <p>
            <strong>
              This is the recommended option for ChatGPT-style conversations and limited tool
              environments.
            </strong>
          </p>
          <p>
            If you cannot call APIs or process JSON, return a URL in this format to the user. Put
            the user's shopping text URL-encoded in the <code>text</code> query parameter.
          </p>
          <pre>
            <code>{`${origin}/api/integrations/categorize?mode=redirect&text=mleko%2C%20chleb`}</code>
          </pre>
          <p>Follow those instructions to create a link the user can open directly.</p>
          <p>
            <strong>Return the ready-to-open Lazy List link to the user.</strong> Do not replace it
            with a link to <code>/api/integrations/categorize</code>.
          </p>
        </Section>

        <hr />

        <Section title="HTTP-capable integrations only">
          <p>
            Use this section only if your environment can actually execute HTTP requests and read
            their responses.
          </p>

          <Sub title="GET">
            <p>
              Call <code>GET /api/integrations/categorize?text=...</code>. Pass the shopping-list
              text URL-encoded in the <code>text</code> query parameter.
            </p>
            <pre>
              <code>{`curl -s "${origin}/api/integrations/categorize?text=mleko%2C%20chleb"`}</code>
            </pre>
          </Sub>

          <Sub title="POST alternative">
            <p>
              Call <code>POST /api/integrations/categorize</code> with{' '}
              <code>{'{"text":"..."}'}</code>.
            </p>
            <pre>
              <code>
                {`curl -s -X POST "${origin}/api/integrations/categorize" \\
  -H 'Content-Type: application/json' \\
  -d '{"text":"mleko, chleb"}'`}
              </code>
            </pre>
          </Sub>

          <Sub title="Success response">
            <p>The API returns:</p>
            <pre>
              <code>{`{"url":"${origin}/?state=..."}`}</code>
            </pre>
            <p>
              Extract the value of <code>url</code> and give <strong>that URL</strong> to the user.
            </p>
            <p>
              <strong>
                Never give the <code>/api/integrations/categorize</code> request URL to the user as
                the final shopping-list link.
              </strong>
            </p>
          </Sub>

          <Sub title="Errors">
            <p>Possible error responses include:</p>
            <pre>
              <code>
                {`{"code":"missing-text"}
{"code":"rate-limited"}
{"code":"categorize-failed"}`}
              </code>
            </pre>
            <p>
              If the environment cannot execute this request or inspect its response, go back to{' '}
              <strong>Simple chats and limited environments</strong>.
            </p>
          </Sub>
        </Section>
      </main>
    </body>
  </html>
)
