"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ScheduleSection } from "@/components/schedule-section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogForm,
  DialogHeader,
  DialogStickyFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionButton } from "@/components/ui/permission-button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Textarea } from "@/components/ui/textarea";
import { useProfiles } from "@/lib/agent.query";
import { useCreateScheduleTrigger } from "@/lib/schedule-trigger.query";

const DEFAULT_CRON = "0 9 * * 1-5";
const DEFAULT_TIMEZONE =
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function ConvertToScheduledTaskDialog({
  open,
  onOpenChange,
  agentId,
  initialMessage,
  agentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string | null;
  initialMessage: string;
  agentName: string | undefined;
}) {
  const router = useRouter();
  const createMutation = useCreateScheduleTrigger();
  const { data: agents = [], isLoading: agentsLoading } = useProfiles({
    filters: { agentType: "agent" },
    enabled: open,
  });

  const agentOptions = agents.map((agent) => ({
    value: agent.id,
    label: agent.name || "Untitled agent",
    description:
      agent.scope === "personal" ? "Personal agent" : `${agent.scope} agent`,
  }));

  const [name, setName] = useState(
    agentName ? `${agentName} - Scheduled Task` : "Scheduled Task",
  );
  const [selectedAgentId, setSelectedAgentId] = useState(agentId ?? "");
  const [messageTemplate, setMessageTemplate] = useState(initialMessage);
  const [cronExpression, setCronExpression] = useState(DEFAULT_CRON);
  const timezone = DEFAULT_TIMEZONE;

  // Sync form state when dialog opens with fresh conversation data
  useEffect(() => {
    if (open) {
      setName(agentName ? `${agentName} - Scheduled Task` : "Scheduled Task");
      setSelectedAgentId(agentId ?? "");
      setMessageTemplate(initialMessage);
      setCronExpression(DEFAULT_CRON);
    }
  }, [open, agentId, agentName, initialMessage]);

  const isFormValid =
    name.trim().length > 0 &&
    selectedAgentId.length > 0 &&
    messageTemplate.trim().length > 0 &&
    cronExpression.trim().length > 0;

  const handleClose = useCallback(
    (value: boolean) => {
      onOpenChange(value);
    },
    [onOpenChange],
  );

  const handleSubmit = async () => {
    if (!isFormValid || createMutation.isPending) return;

    const result = await createMutation.mutateAsync({
      name: name.trim(),
      agentId: selectedAgentId,
      messageTemplate: messageTemplate.trim(),
      cronExpression: cronExpression.trim(),
      timezone,
    });

    if (result) {
      handleClose(false);
      router.push(`/scheduled-tasks/${result.id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>Save as scheduled task</DialogTitle>
        </DialogHeader>

        <DialogForm
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={handleSubmit}
        >
          <DialogBody className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-task-name">Name</Label>
              <Input
                id="schedule-task-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Daily summary"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-task-agent">Agent</Label>
              <SearchableSelect
                value={selectedAgentId}
                onValueChange={setSelectedAgentId}
                items={agentOptions}
                placeholder="Select agent"
                searchPlaceholder="Search agents..."
                disabled={agentsLoading || agentOptions.length === 0}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="schedule-task-prompt">Task Prompt</Label>
              <Textarea
                id="schedule-task-prompt"
                value={messageTemplate}
                onChange={(e) => setMessageTemplate(e.target.value)}
                placeholder="Ask the agent to do something on every run."
                className="min-h-[80px] resize-y"
              />
            </div>

            <ScheduleSection
              cronExpression={cronExpression}
              onCronExpressionChange={setCronExpression}
            />
          </DialogBody>

          <DialogStickyFooter className="mt-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleClose(false)}
            >
              Cancel
            </Button>
            <PermissionButton
              permissions={{ scheduledTask: ["create"] }}
              type="submit"
              disabled={createMutation.isPending || !isFormValid}
            >
              {createMutation.isPending && (
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              )}
              Create task
            </PermissionButton>
          </DialogStickyFooter>
        </DialogForm>
      </DialogContent>
    </Dialog>
  );
}
