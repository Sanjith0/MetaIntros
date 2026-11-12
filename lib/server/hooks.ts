/** Registers every post-party-confirmation step, in order. Imported once by the queue service. */
import { onPartyConfirmed } from "./pipeline";
import { createSquadChat } from "./squadChat";
import { postHostWelcome } from "./host";

onPartyConfirmed(async (partyId) => {
  await createSquadChat(partyId);
  await postHostWelcome(partyId);
});
