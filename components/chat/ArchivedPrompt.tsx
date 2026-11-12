import { UserPlus } from "lucide-react";
import { ButtonLink } from "@/components/fb";

export function ArchivedPrompt({ partyId }: { partyId: string }) {
  return (
    <ButtonLink href={`/squad/${partyId}/connect`} variant="primary" block data-testid="stay-in-touch" icon={<UserPlus size={16} />}>
      Add your squad as friends
    </ButtonLink>
  );
}
