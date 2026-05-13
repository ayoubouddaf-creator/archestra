"use client";

import { Loader2, Smartphone } from "lucide-react";
import Divider from "@/components/divider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useChatOpsStatus } from "@/lib/chatops/chatops.query";
import {
  useDeleteWhatsAppSession,
  useUpdateWhatsAppChatOpsConfig,
  useWhatsAppQr,
} from "@/lib/chatops/chatops-config.query";
import { useConfig } from "@/lib/config/config.query";
import { useAppName } from "@/lib/hooks/use-app-name";
import { CollapsibleSetupSection } from "../_components/collapsible-setup-section";
import { LlmKeySetupStep } from "../_components/llm-key-setup-step";
import { SetupStep } from "../_components/setup-step";
import { useTriggerStatuses } from "../_components/use-trigger-statuses";

export default function WhatsAppPage() {
  const appName = useAppName();
  const { data: chatOpsProviders, isLoading: statusLoading } =
    useChatOpsStatus();
  const { isLoading: featuresLoading } = useConfig();

  const whatsapp = chatOpsProviders?.find((p) => p.id === "whatsapp");
  const isEnabled = !!whatsapp?.configured;

  const enableMutation = useUpdateWhatsAppChatOpsConfig();
  const disconnectMutation = useDeleteWhatsAppSession();

  // Poll for QR/connected status only when WhatsApp is enabled
  const { data: qrData } = useWhatsAppQr(isEnabled);
  const isConnected = qrData?.connected ?? false;
  const qrCode = qrData?.qr ?? null;

  const setupDataLoading = statusLoading || featuresLoading;
  const { whatsapp: allStepsCompleted } = useTriggerStatuses();

  const handleEnable = async () => {
    await enableMutation.mutateAsync({ enabled: true });
  };

  const handleDisconnect = async () => {
    await disconnectMutation.mutateAsync();
    // Also disable so it doesn't auto-reconnect
    await enableMutation.mutateAsync({ enabled: false });
  };

  return (
    <div className="flex flex-col gap-4">
      <CollapsibleSetupSection
        allStepsCompleted={allStepsCompleted}
        isLoading={setupDataLoading}
        providerLabel="WhatsApp"
        docsUrl={null}
      >
        <LlmKeySetupStep />
        <SetupStep
          title="Connect WhatsApp"
          description={`Scan a QR code to link a WhatsApp account to ${appName}`}
          done={isConnected}
          ctaLabel={isEnabled ? undefined : "Enable WhatsApp"}
          onAction={isEnabled ? undefined : handleEnable}
          doneActionLabel={isConnected ? "Disconnect" : undefined}
          onDoneAction={isConnected ? handleDisconnect : undefined}
        >
          {!isEnabled && (
            <p className="text-sm text-muted-foreground">
              Click "Enable WhatsApp" to start the QR pairing flow. You will
              need to scan the QR code with a WhatsApp-registered phone.
            </p>
          )}
          {isEnabled && !isConnected && (
            <QrPairingPanel
              qrCode={qrCode}
              onDisconnect={handleDisconnect}
              isDisconnecting={disconnectMutation.isPending}
            />
          )}
          {isConnected && (
            <div className="flex items-center gap-2">
              <Badge
                variant="secondary"
                className="bg-green-500/10 text-green-600 border-green-500/70"
              >
                <Smartphone className="size-3 mr-1" />
                Connected
              </Badge>
              <span className="text-sm text-muted-foreground">
                WhatsApp is active. Users can message this number to interact
                with agents.
              </span>
            </div>
          )}
        </SetupStep>
      </CollapsibleSetupSection>

      {allStepsCompleted && (
        <>
          <Divider />
          <WhatsAppUsageGuide appName={appName} />
        </>
      )}
    </div>
  );
}

function QrPairingPanel({
  qrCode,
  onDisconnect,
  isDisconnecting,
}: {
  qrCode: string | null;
  onDisconnect: () => void;
  isDisconnecting: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-6">
        <div className="flex-shrink-0 w-[220px] h-[220px] border rounded-lg flex items-center justify-center bg-white">
          {qrCode ? (
            <img
              src={qrCode}
              alt="WhatsApp QR code"
              width={220}
              height={220}
              className="rounded"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="text-xs">Generating QR…</span>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 pt-2">
          <p className="text-sm font-medium">Scan with WhatsApp</p>
          <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Open WhatsApp on your phone</li>
            <li>
              Tap{" "}
              <span className="font-medium text-foreground">
                Settings → Linked Devices
              </span>
            </li>
            <li>
              Tap{" "}
              <span className="font-medium text-foreground">Link a Device</span>
            </li>
            <li>Scan this QR code</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            The QR code refreshes automatically every 60 seconds.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={onDisconnect}
            disabled={isDisconnecting}
            className="w-fit mt-1"
          >
            {isDisconnecting ? "Cancelling…" : "Cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function WhatsAppUsageGuide({ appName }: { appName: string }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Using WhatsApp</h2>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">
        <p>
          Users can message the connected WhatsApp number to interact with{" "}
          {appName} agents. Before they can start, they need to link their
          WhatsApp number to their {appName} account.
        </p>
        <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
          <p className="font-medium text-foreground text-xs uppercase tracking-wide">
            User onboarding
          </p>
          <ol className="text-sm space-y-1.5 list-decimal list-inside">
            <li>
              User sends{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                /identify their@email.com
              </code>{" "}
              to link their number
            </li>
            <li>
              User replies with a number to pick an agent (e.g.{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">1</code>)
            </li>
            <li>
              For approval requests, reply{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                approve
              </code>{" "}
              or{" "}
              <code className="bg-muted px-1 py-0.5 rounded text-xs">
                reject
              </code>{" "}
              (or 👍 / 👎)
            </li>
          </ol>
        </div>
      </div>
    </section>
  );
}
