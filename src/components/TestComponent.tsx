"use client";

import { useEffect } from "react";

export default function TestComponent() {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log('TestComponent running on client');
    }
  }, []);

  return <div>Test Component</div>;
}
