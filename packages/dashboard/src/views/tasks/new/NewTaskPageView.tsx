"use client";

import { Pencil, Sparkles } from "lucide-react";
import { InputForm } from "@/app/tasks/new/InputForm";
import { SuggestionsTab } from "@/app/tasks/new/SuggestionsTab";
import { TabGroup, TabList, Tab, TabPanel } from "@/components/ui/tab-group";
import {
  NewTaskCreationRecoveryBanner,
  NewTaskPageHeader,
  NewTaskPreviewSection,
} from "./components";
import { useNewTaskPage } from "./hooks/useNewTaskPage";

const NewTaskPageView = () => {
  const vm = useNewTaskPage();

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-[300px]">
      <NewTaskPageHeader />

      {vm.creationRecovery ? (
        <NewTaskCreationRecoveryBanner
          variant={vm.creationRecovery.variant}
          items={vm.creationRecovery.items}
          message={vm.creationRecovery.message}
          onDismiss={vm.creationRecovery.onDismiss}
          onGoToTasks={vm.goToTasks}
        />
      ) : null}

      <TabGroup value={vm.intakeTab} onValueChange={vm.setIntakeTab}>
        <TabList aria-label="태스크 작성 방식">
          <Tab value="create" icon={Pencil}>
            직접 작성
          </Tab>
          <Tab value="suggest" icon={Sparkles} tone="highlight">
            추천받기
          </Tab>
        </TabList>
        <TabPanel value="create">
          {vm.phase === "draft" ? (
            <InputForm
              title={vm.title}
              description={vm.description}
              analyzing={vm.analyzing}
              analyzeError={vm.analyzeError}
              inputExternalDeps={vm.inputExternalDeps}
              existingTasks={vm.existingTasks}
              onTitleChange={vm.setTitle}
              onDescriptionChange={vm.setDescription}
              onExternalDepsChange={vm.setInputExternalDeps}
              onAnalyze={vm.handleAnalyze}
              onCancel={vm.goToTasks}
            />
          ) : (
            <NewTaskPreviewSection
              title={vm.title}
              description={vm.description}
              tasks={vm.tasks}
              editingIdx={vm.editingIdx}
              analyzeError={vm.analyzeError}
              confirming={vm.confirming}
              canConfirm={vm.canConfirm}
              existingTasks={vm.existingTasks}
              availableRoles={vm.availableRoles}
              onReturnToDraft={() => vm.setPhase("draft")}
              onGoToTasks={vm.goToTasks}
              onEditToggle={(idx) =>
                vm.setEditingIdx(vm.editingIdx === idx ? null : idx)
              }
              onTaskUpdate={vm.updateTask}
              onTaskRemove={vm.removeTask}
              onAddTask={vm.addTask}
              onConfirm={vm.handleConfirm}
            />
          )}
        </TabPanel>
        <TabPanel value="suggest">
          {vm.phase === "draft" ? (
            <SuggestionsTab
              suggestions={vm.suggestions}
              suggestLoading={vm.suggestLoading}
              suggestError={vm.suggestError}
              selectedSuggestions={vm.selectedSuggestions}
              creatingSuggestions={vm.creatingSuggestions}
              onSuggest={vm.handleSuggest}
              onToggle={vm.toggleSuggestion}
              onSelectAll={vm.selectAll}
              onDeselectAll={vm.deselectAll}
              onCreateFromSuggestions={vm.createFromSuggestions}
            />
          ) : null}
        </TabPanel>
      </TabGroup>
    </div>
  );
};

export default NewTaskPageView;
