import { setGlobalOptions } from "firebase-functions/v2"
import { initializeApp, getApps } from "firebase-admin/app"

if (getApps().length === 0) initializeApp()

setGlobalOptions({ region: "asia-south1", maxInstances: 5 })

export { beforeUserSignedIn } from "./setUserClaims"
export { agentSweep } from "./agentSweep"
export { modelUpdateCheck } from "./modelUpdateCheck"
