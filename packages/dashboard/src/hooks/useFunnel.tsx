"use client";

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

/** One frame in the in-memory funnel stack (no URL / router). */
export type FunnelFrame<S extends string, C extends object> = {
  step: S;
  context: C;
};

export type UseFunnelOptions<S extends string, C extends object> = {
  initialStep: S;
  initialContext: C;
};

export type FunnelHistoryApi<S extends string, C extends object> = {
  push: (step: S, contextUpdate?: Partial<C>) => void;
  replace: (step: S, contextUpdate?: Partial<C>) => void;
  back: () => void;
};

export type FunnelRenderArgs<S extends string, C extends object> = {
  context: C;
  history: FunnelHistoryApi<S, C>;
  /** Pops this funnel step (same as `history.back()` when stacked). */
  close: () => void;
};

export type FunnelStepRenderer<S extends string, C extends object> = (
  args: FunnelRenderArgs<S, C>,
) => ReactNode;

export type FunnelOverlayConfig<S extends string, C extends object> = {
  __funnelOverlay: true;
  render: FunnelStepRenderer<S, C>;
};

export type FunnelStepProp<S extends string, C extends object> =
  | FunnelStepRenderer<S, C>
  | FunnelOverlayConfig<S, C>;

export type FunnelRenderProps<S extends string, C extends object> = Partial<
  Record<S, FunnelStepProp<S, C>>
>;

function isOverlay<S extends string, C extends object>(
  v: FunnelStepProp<S, C>,
): v is FunnelOverlayConfig<S, C> {
  return (
    typeof v === "object" &&
    v !== null &&
    "__funnelOverlay" in v &&
    (v as FunnelOverlayConfig<S, C>).__funnelOverlay === true
  );
}

export function funnelRenderOverlay<S extends string, C extends object>(opts: {
  render: FunnelStepRenderer<S, C>;
}): FunnelOverlayConfig<S, C> {
  return { __funnelOverlay: true, render: opts.render };
}

type FunnelSnapshot<S extends string, C extends object> = {
  step: S;
  context: C;
} & FunnelHistoryApi<S, C>;

export type UseFunnelReturn<S extends string, C extends object> = {
  step: S;
  context: C;
  depth: number;
  canBack: boolean;
  push: (step: S, contextUpdate?: Partial<C>) => void;
  replace: (step: S, contextUpdate?: Partial<C>) => void;
  back: () => void;
  reset: (step?: S, context?: C) => void;
  /** Declarative step → UI (`Render.overlay({ render })` for modal-style steps). */
  Render: ((
    props: FunnelRenderProps<S, C>,
  ) => ReactElement | null) & {
    overlay: (opts: {
      render: FunnelStepRenderer<S, C>;
    }) => FunnelOverlayConfig<S, C>;
  };
};

/**
 * In-memory step/context stack + `<Render draft={…} review={…} />` mapping.
 * No Next.js router or search params.
 */
export function useFunnel<S extends string, C extends object>(
  options: UseFunnelOptions<S, C>,
): UseFunnelReturn<S, C> {
  const { initialStep, initialContext } = options;
  const [stack, setStack] = useState<FunnelFrame<S, C>[]>(() => [
    { step: initialStep, context: initialContext },
  ]);

  const head = stack[stack.length - 1];

  const push = useCallback((step: S, contextUpdate?: Partial<C>) => {
    setStack((prev) => {
      const prevHead = prev[prev.length - 1];
      const nextContext = contextUpdate
        ? ({ ...prevHead.context, ...contextUpdate } as C)
        : prevHead.context;
      return [...prev, { step, context: nextContext }];
    });
  }, []);

  const replace = useCallback((step: S, contextUpdate?: Partial<C>) => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const prevHead = prev[prev.length - 1];
      const nextContext = contextUpdate
        ? ({ ...prevHead.context, ...contextUpdate } as C)
        : prevHead.context;
      return [...prev.slice(0, -1), { step, context: nextContext }];
    });
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback(
    (step: S = initialStep, context: C = initialContext) => {
      setStack([{ step, context }]);
    },
    [initialContext, initialStep],
  );

  const snapshotRef = useRef<FunnelSnapshot<S, C>>({
    step: head.step,
    context: head.context,
    push,
    replace,
    back,
  });

  snapshotRef.current = {
    step: head.step,
    context: head.context,
    push,
    replace,
    back,
  };

  const Render = useMemo(() => {
    const Comp = (props: FunnelRenderProps<S, C>) => {
      const snap = snapshotRef.current;
      const spec = props[snap.step];
      if (spec == null) return null;

      const history: FunnelHistoryApi<S, C> = {
        push: snap.push,
        replace: snap.replace,
        back: snap.back,
      };
      const close = () => snap.back();
      const args: FunnelRenderArgs<S, C> = {
        context: snap.context,
        history,
        close,
      };

      if (isOverlay(spec)) {
        const node = spec.render(args);
        return (
          <Dialog
            open
            onOpenChange={(open) => {
              if (!open) close();
            }}
          >
            <DialogContent
              className="max-h-[90vh] overflow-y-auto max-w-3xl w-full"
              showCloseButton
            >
              {node}
            </DialogContent>
          </Dialog>
        );
      }

      return <>{spec(args)}</>;
    };
    Comp.displayName = "FunnelRender";
    const bound = Comp as unknown as UseFunnelReturn<S, C>["Render"];
    bound.overlay = funnelRenderOverlay<S, C>;
    return bound;
  }, []);

  return useMemo(
    () => ({
      step: head.step,
      context: head.context,
      depth: stack.length - 1,
      canBack: stack.length > 1,
      push,
      replace,
      back,
      reset,
      Render,
    }),
    [
      Render,
      back,
      head.context,
      head.step,
      push,
      replace,
      reset,
      stack.length,
    ],
  );
}
