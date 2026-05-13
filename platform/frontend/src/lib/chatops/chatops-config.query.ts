import { archestraApiSdk, type archestraApiTypes } from "@shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { handleApiError } from "@/lib/utils";

export function useUpdateChatOpsConfigInQuickstart() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      body: archestraApiTypes.UpdateChatOpsConfigInQuickstartData["body"],
    ) => {
      const { data, error } =
        await archestraApiSdk.updateChatOpsConfigInQuickstart({
          body,
        });
      if (error) {
        handleApiError(error);
        return null;
      }
      if (data?.success) {
        await archestraApiSdk
          .refreshChatOpsChannelDiscovery({ body: { provider: "ms-teams" } })
          .catch(() => {});
      }
      return data ?? null;
    },
    onSuccess: (data) => {
      if (!data?.success) {
        return;
      }
      toast.success("MS Teams configuration updated");
      queryClient.invalidateQueries({ queryKey: ["chatops", "status"] });
      queryClient.invalidateQueries({ queryKey: ["chatops", "bindings"] });
    },
    onError: (error) => {
      // Keep a defensive fallback for unexpected runtime errors.
      console.error("ChatOps config update error:", error);
      toast.error("Failed to update MS Teams configuration");
    },
  });
}

export function useUpdateSlackChatOpsConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      body: NonNullable<archestraApiTypes.UpdateSlackChatOpsConfigData["body"]>,
    ) => {
      const { data, error } = await archestraApiSdk.updateSlackChatOpsConfig({
        body,
      });
      if (error) {
        handleApiError(error);
        return null;
      }
      if (data?.success) {
        // Trigger channel discovery (awaits completion on backend)
        // so channels are available when the UI refreshes bindings
        await archestraApiSdk
          .refreshChatOpsChannelDiscovery({ body: { provider: "slack" } })
          .catch(() => {});
      }
      return data ?? null;
    },
    onSuccess: (data) => {
      if (!data?.success) {
        return;
      }
      toast.success("Slack configuration updated");
      queryClient.invalidateQueries({ queryKey: ["chatops", "status"] });
      queryClient.invalidateQueries({ queryKey: ["chatops", "bindings"] });
    },
    onError: (error) => {
      console.error("Slack config update error:", error);
      toast.error("Failed to update Slack configuration");
    },
  });
}

export function useUpdateWhatsAppChatOpsConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      body: NonNullable<
        archestraApiTypes.UpdateWhatsAppChatOpsConfigData["body"]
      >,
    ) => {
      const { data, error } = await archestraApiSdk.updateWhatsAppChatOpsConfig(
        { body },
      );
      if (error) {
        handleApiError(error);
        return null;
      }
      return data ?? null;
    },
    onSuccess: (data) => {
      if (!data?.success) return;
      toast.success("WhatsApp configuration updated");
      queryClient.invalidateQueries({ queryKey: ["chatops", "status"] });
      queryClient.invalidateQueries({
        queryKey: ["chatops", "whatsapp", "qr"],
      });
    },
    onError: (error) => {
      console.error("WhatsApp config update error:", error);
      toast.error("Failed to update WhatsApp configuration");
    },
  });
}

export function useWhatsAppQr(enabled: boolean) {
  return useQuery({
    queryKey: ["chatops", "whatsapp", "qr"],
    enabled,
    refetchInterval: (query) => {
      // Poll every 3s while waiting for QR; stop polling once connected
      if (query.state.data?.connected) return false;
      return 3000;
    },
    queryFn: async () => {
      const { data, error } = await archestraApiSdk.getWhatsAppQr();
      if (error) {
        handleApiError(error);
        return null;
      }
      return data ?? null;
    },
  });
}

export function useDeleteWhatsAppSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await archestraApiSdk.deleteWhatsAppSession();
      if (error) {
        handleApiError(error);
        return null;
      }
      return data ?? null;
    },
    onSuccess: () => {
      toast.success("WhatsApp disconnected");
      queryClient.invalidateQueries({ queryKey: ["chatops", "status"] });
      queryClient.invalidateQueries({
        queryKey: ["chatops", "whatsapp", "qr"],
      });
    },
    onError: () => {
      toast.error("Failed to disconnect WhatsApp");
    },
  });
}
