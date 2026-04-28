import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://vvpiohqoxqvadpfvqbsc.supabase.co'
const supabaseKey = 'sb_publishable_cakL0I9Q1NYrrCkIlnqO9Q_DScoOuRE'

export const supabase = createClient(supabaseUrl, supabaseKey)
