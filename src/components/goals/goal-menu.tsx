import { Ellipsis } from "lucide-react";
import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Goal } from "@/lib/domain";

export default function GoalMenu({
  goal,
  canUndo = false,
  onEdit,
  onUndo,
  onArchive,
}: {
  goal: Goal;
  canUndo?: boolean;
  onEdit: (goal: Goal) => void;
  onUndo?: (goal: Goal) => void;
  onArchive: (goal: Goal) => void;
}) {
  const edit = useCallback(() => onEdit(goal), [onEdit, goal]);
  const undo = useCallback(() => onUndo?.(goal), [onUndo, goal]);
  const archive = useCallback(() => onArchive(goal), [onArchive, goal]);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label={`Options for ${goal.title}`} size="icon" type="button" variant="ghost">
          <Ellipsis className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={edit}>Edit</DropdownMenuItem>
        {canUndo && onUndo ? (
          <DropdownMenuItem onSelect={undo}>Take back my last paw</DropdownMenuItem>
        ) : null}
        <DropdownMenuItem onSelect={archive}>Tuck away (archive)</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
