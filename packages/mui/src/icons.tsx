import type { BuilderActionIconType, QuestionType } from "@form-engine-ts/react";
import {
  Add,
  ArrowDownward,
  ArrowDropDown,
  ArrowUpward,
  CheckBox,
  Close,
  Delete,
  DragHandle,
  Edit,
  Numbers,
  RadioButtonChecked,
  Settings,
  Star,
  Subject,
  TextFields,
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

export function muiDefaultFieldTypeIcon(type: QuestionType): ReactNode {
  switch (type) {
    case "text":
      return <TextFields fontSize="small" />;
    case "textarea":
      return <Subject fontSize="small" />;
    case "number":
      return <Numbers fontSize="small" />;
    case "rating":
      return <Star fontSize="small" />;
    case "select":
      return <ArrowDropDown fontSize="small" />;
    case "multi-select":
      return <CheckBox fontSize="small" />;
    case "checkbox":
      return <CheckBox fontSize="small" />;
    case "radio":
      return <RadioButtonChecked fontSize="small" />;
  }
}
