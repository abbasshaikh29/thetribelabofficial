"use client";
import React from "react";
import { Button } from "@/components/ui/moving-border";

export default function MovingBorderDemo() {
  return (
    <div className="flex justify-center items-center w-full py-10">
      <Button
        borderRadius="1.75rem"
        className="bg-white dark:bg-slate-900 text-black dark:text-white border-neutral-200 dark:border-slate-800"
      >
        Borders are cool
      </Button>
    </div>
  );
} 