import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  "https://giivnkxttzkcpglokbjf.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpaXZua3h0dHprY3BnbG9rYmpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5ODQ4NzEsImV4cCI6MjA4OTU2MDg3MX0.tV0iNfseGJ3L0mm6CxflSrBQH6QmGBL-KFHy1-sLwXE"
)