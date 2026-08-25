import type { BuilderActionIconType } from "@form-engine-ts/react";
import {
  Add,
  ArrowDownward,
  ArrowUpward,
  Close,
  Delete,
  DragHandle,
  Edit,
  Settings,
  Translate
} from "@mui/icons-material";
import type { ReactNode } from "react";

export function muiDefaultIconResolver(actionType: BuilderActionIconType): ReactNode {
  switch (actionType) {
    case "moveUp":
      return <ArrowUpward fontSize="small" />;
    case "moveDown":
      return <ArrowDownward fontSize="small" />;
    case "delete":
      return <Delete fontSize="small" />;
    case "add":
      return <Add fontSize="small" />;
    case "edit":
      return <Edit fontSize="small" />;
    case "settings":
      return <Settings fontSize="small" />;
    case "translate":
      return <Translate fontSize="small" />;
    case "close":
      return <Close fontSize="small" />;
    case "dragHandle":
      return <DragHandle fontSize="small" />;
  }
}
