/* ============================================================
   supabase.js - the connection to the Whisk Diary database.

   These two values are meant to be public. The publishable key
   only ever grants what Row Level Security allows, and in this
   project that is: read everything public, and write only as
   yourself. Every write policy is keyed on my_profile_id(), so
   author_id and sender_id cannot be forged from the browser no
   matter what this code sends. Messages are readable only by the
   two people in them. The secret service key is NOT here and must
   never be put in front-end code.
   ============================================================ */
const SUPABASE_URL = 'https://wiugnudhbhbicoprfria.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Jcymd4nYrhsVnfzJ2bWuQA_dp3l58bC';

/* the CDN script exposes window.supabase; this is our client */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
