export interface TaskOption {
  id: string;
  title: string;
  status: string;
}

export interface DependsOnSelectorProps {
  selected: string[];
  onChange: (ids: string[]) => void;
  tasks: TaskOption[];
  placeholder?: string;
  className?: string;
}
