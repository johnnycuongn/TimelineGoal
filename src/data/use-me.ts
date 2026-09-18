import useSWR from "swr";
import { useAuth } from "@/auth/auth-provider";
import { fetchMe, type Me } from "./queries";

export function useMe() {
  const { userId } = useAuth();
  const swr = useSWR<Me>(userId ? ["me", userId] : null, () => fetchMe(userId ?? ""), {
    revalidateOnFocus: true,
  });
  return { me: swr.data, error: swr.error, isLoading: swr.isLoading, refresh: swr.mutate };
}
