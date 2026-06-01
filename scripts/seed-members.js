#!/usr/bin/env node
/**
 * Member Seed Script
 * Usage: node scripts/seed-members.js
 *
 * Edit the MEMBERS array below with real names and emails.
 * Each member gets a unique password_token (UUID).
 * The script outputs the invitation links to share.
 */

const { createClient } = require('@supabase/supabase-js')
const crypto = require('crypto')

// ─── Configure these ────────────────────────────────────────
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://vip.musicalbasics.com'

const MEMBERS = [
  // { name: 'Jane Doe', email: 'jane@example.com', is_moderator: false },
  // { name: 'John Smith', email: 'john@example.com', is_moderator: true },
  // Add your members here...
]
// ────────────────────────────────────────────────────────────

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment')
    process.exit(1)
  }

  if (MEMBERS.length === 0) {
    console.log('⚠️  No members configured. Edit the MEMBERS array in this script.')
    process.exit(0)
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`\n🎹 Seeding ${MEMBERS.length} members...\n`)

  const results = []

  for (const member of MEMBERS) {
    const token = crypto.randomUUID()
    const { data, error } = await supabase
      .from('members')
      .upsert(
        {
          name: member.name,
          email: member.email,
          password_token: token,
          display_name: member.name,
          is_moderator: member.is_moderator ?? false,
        },
        { onConflict: 'email', ignoreDuplicates: false }
      )
      .select()
      .single()

    if (error) {
      console.error(`❌ Failed to add ${member.name} (${member.email}):`, error.message)
    } else {
      const link = `${APP_URL}?password=${data.password_token}`
      results.push({ name: member.name, email: member.email, link })
      console.log(`✅ ${member.name} (${member.email})`)
      console.log(`   🔗 ${link}\n`)
    }
  }

  console.log('\n─────────────────────────────────────')
  console.log('Invitation links ready to send:')
  console.log('─────────────────────────────────────')
  results.forEach(({ name, email, link }) => {
    console.log(`${name} <${email}>`)
    console.log(`  ${link}`)
  })
}

main().catch(console.error)
