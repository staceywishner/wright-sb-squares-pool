# Wright SB Squares Pool — build plan

Firebase project ID: `wright-sb-squares-pool` → guest link `wright-sb-squares-pool.web.app`
Organizer (only account that can change the board): david.wright333@gmail.com
Firebase: Firestore (nam5), Auth: Anonymous + Google enabled. Free Spark plan.

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
- Quarter winners + payouts automatic, each with its own Winner and Reverse Winner box. $25/square, $2,500 total:
  1st Q $250 / rev $50 · Halftime $500 / rev $100 · 3rd Q $250 / rev $50 · Final $1,000 / rev $300.
  Overtime: end-of-regulation winner $250 / rev $50; final-score winner $750 / rev $250.
- "Find my squares" and live party chat with cheer buttons.

## Build steps
1. Firebase project — done
2. GitHub repo connected — done
3. Build the app
   - 3a. Guest board (example data) — done, awaiting approval
   - 3b. Shared online board (Firebase) — code + security rules written; rules to be published
   - 3c. Live ESPN score
   - 3d. Guests reserve squares + pay buttons
   - 3e. Organizer screen
   - 3f. Party chat
4. Link GitHub → Firebase so it deploys automatically — workflow added (.github/workflows/deploy.yml)
5. Test on phone and on regular NFL Sundays
