# Yahoo Finance local experiment

This work lives on the local branch `experiment/yahoo-finance-local` (committed, not
pushed) in the sibling worktree:

`C:\Users\User\OneDrive - Universidad Nacional de la Matanza\Escritorio\Personal\Findash-yahoo-finance-local`

The original worktree and branch remain unchanged. The pre-existing local changes
were preserved in the Git stash entry named `backup before Yahoo Finance local
experiment`. Nothing was committed or pushed.

## Run locally

1. Start the local Supabase stack from this worktree:

   ```powershell
   npx supabase start
   npx supabase status
   ```

2. Create `.env.local` in the worktree root with the local API URL and anon/publishable
   key reported by `supabase status`:

   ```dotenv
   VITE_SUPABASE_URL=http://127.0.0.1:54321
   VITE_SUPABASE_PUBLISHABLE_KEY=<local-anon-key>
   ```

3. In a terminal at the worktree root, serve the Yahoo proxy locally:

   ```powershell
   npx supabase functions serve yahoo-finance-proxy
   ```

4. In another terminal at the worktree root, start the app:

   ```powershell
   npm run dev
   ```

These commands do not deploy or push anything. The local Edge Function makes the
Yahoo Finance requests; FMP is not used by the app's active market-data flows.
Yahoo Finance endpoints are unofficial and may throttle or change their responses.

Without Docker, the proxy alone can run with Deno (no Supabase cache):

```powershell
cd supabase/functions/yahoo-finance-proxy
$env:SEC_USER_AGENT = "FinDash <contact email>"
deno run --allow-net --allow-env index.ts   # http://localhost:8000
deno test calc.test.ts
```

The economic calendar has no free equivalent and stays unavailable. Missing Yahoo
metrics are `null` and shown as unavailable, not as real zeroes. See
`docs/MIGRACION-FMP-YAHOO.md` for the full endpoint mapping and deployment steps.

## Return to the original version

Stop the local dev server and Supabase processes, then open the original worktree:

`C:\Users\User\OneDrive - Universidad Nacional de la Matanza\Escritorio\Personal\Findash`

It remains on `publish/financial-analysis-pdf-fixes` with the original working
tree unchanged. The experimental worktree and its uncommitted edits remain
available for comparison until explicitly removed. Do not apply or drop the
`backup before Yahoo Finance local experiment` stash unless you intend to restore
those pre-existing local changes.
