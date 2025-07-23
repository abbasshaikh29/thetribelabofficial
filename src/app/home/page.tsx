"use client";
import Header from "@/components/Header";
import { useSession } from "next-auth/react";
import ConditionalHero from "@/components/ConditionalHero";
import Link from "next/link";
import Hero from "@/components/Hero";
import SecondSection from "@/components/SecondSection";
import PageFooter from "@/components/PageFooter";

export default function Home() {
  const { data: session } = useSession();

  return (
    <main className="flex flex-col flex-grow" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <Header />
      <Hero />
      <SecondSection />
      <PageFooter />
    </main>
  );
}
