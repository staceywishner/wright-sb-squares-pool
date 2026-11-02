# Wright SB Squares Pool — build plan

Firebase project ID: `wright-sb-squares-pool` → guest link `wright-sb-squares-pool.web.app`

## Approved features
- Guest link: any phone/computer browser, no downloads, no accounts.
- Live shared 10x10 board: names/initials, team names, edge numbers.
- Guests reserve their own squares (name + initials), max 10 per guest; squares show "Pending" until the organizer marks them paid.
- Two payment deadlines, both set by the organizer (payment window starts at 48 hours; final cutoff before kickoff).
- Pay buttons: Venmo, Cash App, PayPal (amount + note prefilled); Zelle info shown to copy; cash marked paid by organizer. App never handles money.
- Private organizer screen (Google sign-in): mark paid, remove/move squares, set price, prizes, team names, payment handles, deadlines; lock board; draw edge numbers after board is full; manual score backup.
- (Removed at Stacey's request: "Find my squares")
- Live ESPN score for everyone, ~30–60s behind TV.
- Highlighting matches the Excel sheet: current winner, reverse winner, next FG/TD for each team.
- Quarter winners + payouts automatic (1st Q, Half, 3rd Q, Final; OT counts toward Final).
- "Find my squares" and live party chat with cheer buttons.

## Build steps
1. Firebase project — done
2. GitHub repo connected — done
3. Build the app
   - 3a. Guest board (example data) — done, awaiting approval
   - 3b. Shared online board (Firebase)
   - 3c. Live ESPN score
   - 3d. Guests reserve squares + pay buttons
   - 3e. Organizer screen
   - 3f. Party chat
4. Link GitHub → Firebase so it deploys automatically
5. Test on phone and on regular NFL Sundays
