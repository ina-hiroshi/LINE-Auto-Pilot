import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

// Load environment variables
config({ path: 'frontend/.env' })

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function checkStores() {
  console.log('Checking stores table...')
  
  const { count, error } = await supabase
    .from('stores')
    .select('*', { count: 'exact', head: true })

  if (error) {
    console.error('Error fetching stores:', error)
    return
  }

  console.log(`Total stores in DB: ${count}`)
  
  // 試しに数件取得
  const { data: stores } = await supabase
    .from('stores')
    .select('id, name, user_id')
    .limit(5)
    
  console.log('Sample stores:', stores)
}

checkStores()
