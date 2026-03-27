"use client";

import * as React from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const COLLAPSED_MAX_HEIGHT = 450; // px

interface ExpandableTextareaProps
  extends React.ComponentProps<typeof Textarea> {
  expandLabel?: string;
  collapseLabel?: string;
}

function ExpandableTextarea({
  className,
  expandLabel = "Expandir",
  collapseLabel = "Recolher",
  value,
  onChange,
  ...props
}: ExpandableTextareaProps) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const checkOverflow = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > COLLAPSED_MAX_HEIGHT);
  }, []);

  useEffect(() => {
    checkOverflow();
  }, [value, checkOverflow]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkOverflow]);

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        className={cn(
          "text-sm resize-none transition-[max-height] duration-200",
          !expanded && overflows && "overflow-hidden",
          className
        )}
        style={{
          maxHeight: !expanded && overflows ? COLLAPSED_MAX_HEIGHT : undefined,
        }}
        {...props}
      />
      {!expanded && overflows && (
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-10 rounded-b-md bg-gradient-to-t from-background/90 to-transparent" />
      )}
      {overflows && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 h-6 w-full text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded((prev) => !prev)}
        >
          <ChevronsUpDown className="h-3 w-3 mr-1" />
          {expanded ? collapseLabel : expandLabel}
        </Button>
      )}
    </div>
  );
}

export { ExpandableTextarea };
