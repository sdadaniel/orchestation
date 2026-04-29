import type * as React from "react";
import type { VariantProps } from "class-variance-authority";
import type { buttonVariants } from "../button";
import type { inputVariants } from "../input";
import type { textareaVariants } from "../textarea";
import type { selectVariants } from "../select";
import type { labelVariants } from "../label";
import type { badgeVariants } from "../badge";

export interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export interface InputProps
  extends
    Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    VariantProps<typeof inputVariants> {}

export interface TextareaProps
  extends
    React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    VariantProps<typeof textareaVariants> {}

export interface SelectProps
  extends
    Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size">,
    VariantProps<typeof selectVariants> {}

export interface CheckboxProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export interface ToggleProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}

export interface SliderProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "onChange" | "size"
  > {
  value?: number;
  onChange?: (value: number) => void;
  showRange?: boolean;
}

export interface LabelProps
  extends
    React.LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelVariants> {}

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export interface DatePickerProps {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export interface FieldRowProps {
  label: string;
  htmlFor?: string;
  description?: string;
  children: React.ReactNode;
}

export interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

export interface PageLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export interface PageHeaderProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
}

export type ToastVariant = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  variant: ToastVariant;
}

export interface ToastActions {
  addToast: (message: string, variant?: ToastVariant) => void;
  removeToast: (id: string) => void;
}

export interface ToastStateValue {
  toasts: Toast[];
}
