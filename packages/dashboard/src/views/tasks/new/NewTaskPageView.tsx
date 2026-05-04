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
import {
  NewTaskPageProvider,
  useNewTaskPageGet,
  useNewTaskPageSet,
} from "./hooks/useNewTaskPage";

const NewTaskPageViewInner = () => {
  const get = useNewTaskPageGet();
  const set = useNewTaskPageSet();
  const CreateFunnelRender = get.createFunnel.Render;

  return (
    <div className="space-y-4 max-w-3xl mx-auto pb-[300px]">
      <NewTaskPageHeader />

      <NewTaskCreationRecoveryBanner />

      <TabGroup value={get.intakeTab} onValueChange={set.setIntakeTab}>
        <TabList aria-label="태스크 작성 방식">
          <Tab value="create" icon={Pencil}>
            직접 작성
          </Tab>
          <Tab value="suggest" icon={Sparkles} tone="highlight">
            추천받기
          </Tab>
        </TabList>
        <TabPanel value="create">
          <CreateFunnelRender
            draft={() => <InputForm />}
            review={() => <NewTaskPreviewSection />}
          />
        </TabPanel>
        <TabPanel value="suggest">
          <SuggestionsTab />
        </TabPanel>
      </TabGroup>
    </div>
  );
};

const NewTaskPageView = () => (
  <NewTaskPageProvider>
    <NewTaskPageViewInner />
  </NewTaskPageProvider>
);

export default NewTaskPageView;
