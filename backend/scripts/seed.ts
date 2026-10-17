// Creates or refreshes the sample members (all ids start with "demo-") and their mock Luma events.
// The deployed API does this by itself when someone taps "Demo events", so running it by hand is optional.
// Local:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 npm run seed
// Cloud:  GOOGLE_CLOUD_PROJECT=<id> npm run seed   (uses your gcloud ADC login)
import { DEMO_PEOPLE } from "../src/lib/demoPeople.js";
import { ensureDemoPeople } from "../src/services/demo.js";

await ensureDemoPeople();
console.log(`Done: ${DEMO_PEOPLE.length} demo members`);
process.exit(0);
