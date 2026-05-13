#!/bin/bash
# Run this from the platform/ directory to commit the #3787 implementation
set -e

cd "$(dirname "$0")"

git add \
  frontend/src/components/schedule-section.tsx \
  frontend/src/components/chat/convert-to-scheduled-task-dialog.tsx \
  frontend/src/app/scheduled-tasks/schedule-triggers-client.tsx \
  frontend/src/app/chat/page.tsx

git commit -m "feat: add 'Save as scheduled task' button to chat header

Implements #3787 — users can now convert any chat conversation into a
scheduled recurring task directly from the chat UI.

- Add Schedule button to chat header (desktop) and 3-dot menu (mobile)
  visible when the user has scheduledTask:create permission and a
  conversation is open
- ConvertToScheduledTaskDialog pre-fills agent, last user message, and
  auto-generates a name; lets user configure the cron schedule
- Extract ScheduleSection, parseCronToMode, buildCronFromSchedule into
  shared components/schedule-section.tsx to avoid duplication
- Update schedule-triggers-client.tsx to import from the shared file"

echo "Done! Run 'git push' to push."
