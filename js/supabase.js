/* ============================================================
   supabase.js - the connection to the Whisk Diary database.

   These two values are meant to be public. The publishable key
   only ever grants what Row Level Security allows, and in this
   project that is: read everything, write nothing, except your
   own profile row. There is no policy that lets the browser add
   a review, a follow or a matcha house - which is what keeps the site a
   reading room. The secret service key is NOT here and must
   never be put in front-end code.
   ============================================================ */
const SUPABASE_URL = 'https://wiugnudhbhbicoprfria.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Jcymd4nYrhsVnfzJ2bWuQA_dp3l58bC';

/* the CDN script exposes window.supabase; this is our client */
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
