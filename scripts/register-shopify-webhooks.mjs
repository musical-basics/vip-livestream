// Register Shopify webhooks that auto-provision livestream members.
//
// Subscribes ORDERS_CREATE + ORDERS_PAID to this app's webhook endpoint so new
// livestream purchases create a member in real time (no manual sync needed).
//
// Usage:
//   node --env-file=.env.local scripts/register-shopify-webhooks.mjs
//
// Required env: SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_API_TOKEN, SHOPIFY_API_VERSION
// Optional:     WEBHOOK_CALLBACK_BASE_URL (defaults to NEXT_PUBLIC_APP_URL or vip domain)
//
// IMPORTANT: webhooks registered via the Admin API are HMAC-signed with the
// app's CLIENT SECRET. Set SHOPIFY_WEBHOOK_SECRET=<that client secret> in this
// app's env (.env.local + Vercel) so the endpoint can verify signatures.

const domain = process.env.SHOPIFY_STORE_DOMAIN
const token = process.env.SHOPIFY_ADMIN_API_TOKEN
const version = process.env.SHOPIFY_API_VERSION || '2025-10'
const BASE =
  process.env.WEBHOOK_CALLBACK_BASE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://vip.musicalbasics.com'
const CALLBACK = `${BASE.replace(/\/$/, '')}/api/webhooks/shopify/orders`

const TOPICS = ['ORDERS_CREATE', 'ORDERS_PAID']

if (!domain || !token) {
  console.error('missing env: SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_API_TOKEN')
  process.exit(1)
}

async function gql(query, variables = {}) {
  const res = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': token },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json)}`)
  if (json.errors) throw new Error(`GraphQL errors: ${JSON.stringify(json.errors, null, 2)}`)
  return json.data
}

console.log(`store:    ${domain}`)
console.log(`callback: ${CALLBACK}`)
console.log(`topics:   ${TOPICS.join(', ')}\n`)

// 1. Existing subscriptions to this callback, to avoid duplicates.
const existing = await gql(`{
  webhookSubscriptions(first: 100) {
    edges { node { id topic endpoint { __typename ... on WebhookHttpEndpoint { callbackUrl } } } }
  }
}`)

const have = new Map()
for (const edge of existing.webhookSubscriptions.edges) {
  const cb = edge.node.endpoint?.callbackUrl
  if (cb === CALLBACK) have.set(edge.node.topic, edge.node.id)
}

// 2. Create any missing ones.
for (const topic of TOPICS) {
  if (have.has(topic)) {
    console.log(`✓ ${topic} already registered (${have.get(topic)})`)
    continue
  }
  const res = await gql(
    `mutation create($topic: WebhookSubscriptionTopic!, $sub: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $sub) {
        webhookSubscription { id topic }
        userErrors { field message }
      }
    }`,
    { topic, sub: { callbackUrl: CALLBACK, format: 'JSON' } }
  )
  const out = res.webhookSubscriptionCreate
  if (out.userErrors.length > 0) {
    console.error(`✗ ${topic} failed:`, out.userErrors)
    process.exit(1)
  }
  console.log(`+ ${topic} registered (${out.webhookSubscription.id})`)
}

console.log('\nNext steps:')
console.log('1. Ensure SHOPIFY_WEBHOOK_SECRET=<app client secret> is set in Vercel (Production + Preview).')
console.log('2. Redeploy so the endpoint can verify incoming webhook signatures.')
