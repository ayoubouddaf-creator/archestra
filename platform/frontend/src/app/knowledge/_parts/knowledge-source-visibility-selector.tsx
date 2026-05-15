"use client";

import { Globe, ShieldCheck, Users } from "lucide-react";
import { Label } from "@/components/ui/label";
import { MultiSelectCombobox } from "@/components/ui/multi-select-combobox";
import {
  VisibilitySelector as SharedVisibilitySelector,
  type VisibilityOption,
} from "@/components/visibility-selector";
import { useEnterpriseFeature } from "@/lib/config/config.query";
import { useTeams } from "@/lib/teams/team.query";

export type KnowledgeSourceVisibility =
  | "org-wide"
  | "team-scoped"
  | "auto-sync-permissions";

const VISIBILITY_OPTIONS: Record<
  KnowledgeSourceVisibility,
  VisibilityOption<KnowledgeSourceVisibility>
> = {
  "org-wide": {
    value: "org-wide",
    label: "Organization",
    description: "Anyone in your org can access this knowledge source",
    icon: Globe,
  },
  "team-scoped": {
    value: "team-scoped",
    label: "Teams",
    description: "Share this knowledge source with selected teams",
    icon: Users,
  },
  "auto-sync-permissions": {
    value: "auto-sync-permissions",
    label: "Auto Sync Permissions",
    description:
      "Access is controlled by permissions from the source system (e.g. Jira project roles, Confluence page restrictions). Users only see documents they can access upstream.",
    icon: ShieldCheck,
  },
};

const visibilityEntries = Object.entries(VISIBILITY_OPTIONS) as [
  KnowledgeSourceVisibility,
  VisibilityOption<KnowledgeSourceVisibility>,
][];

export function KnowledgeSourceVisibilitySelector({
  visibility,
  onVisibilityChange,
  teamIds,
  onTeamIdsChange,
  showTeamRequired,
  connectorType,
}: {
  visibility: KnowledgeSourceVisibility;
  onVisibilityChange: (visibility: KnowledgeSourceVisibility) => void;
  teamIds: string[];
  onTeamIdsChange: (ids: string[]) => void;
  showTeamRequired?: boolean;
  /** When provided, only shows "auto-sync-permissions" for supported connector types */
  connectorType?: string;
}) {
  const { data: teams } = useTeams();
  const knowledgeBaseEnterprise = useEnterpriseFeature("knowledgeBase");

  const autoSyncSupported =
    connectorType === "jira" || connectorType === "confluence";

  const options = visibilityEntries
    .filter(([value]) => {
      if (value === "team-scoped") {
        return knowledgeBaseEnterprise || visibility === "team-scoped";
      }
      if (value === "auto-sync-permissions") {
        // Only show for supported connectors (Jira, Confluence) with enterprise license
        return (
          (knowledgeBaseEnterprise && autoSyncSupported) ||
          visibility === "auto-sync-permissions"
        );
      }
      return true;
    })
    .map(([value, option]) => ({
      ...option,
      value,
      disabled: value === "team-scoped" && (teams ?? []).length === 0,
      disabledLabel:
        value === "team-scoped" && (teams ?? []).length === 0
          ? "No teams available"
          : undefined,
    }));

  return (
    <SharedVisibilitySelector
      value={visibility}
      options={options}
      onValueChange={onVisibilityChange}
    >
      {visibility === "team-scoped" && (
        <div className="space-y-2">
          <Label>
            Teams
            {showTeamRequired && (
              <span className="text-destructive ml-1">(required)</span>
            )}
          </Label>
          <MultiSelectCombobox
            options={
              teams?.map((team) => ({
                value: team.id,
                label: team.name,
              })) || []
            }
            value={teamIds}
            onChange={onTeamIdsChange}
            placeholder={
              teams?.length === 0 ? "No teams available" : "Search teams..."
            }
            emptyMessage="No teams found."
          />
        </div>
      )}
    </SharedVisibilitySelector>
  );
}
