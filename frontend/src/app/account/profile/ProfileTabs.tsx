"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { PersonalInfoSection } from "./PersonalInfoSection";
import { AddressesSection } from "./AddressesSection";
import { SupportSection } from "./SupportSection";
import { LoyaltySection } from "./LoyaltySection";

export default function ProfileTabs() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = ["profile", "addresses", "loyalty", "support"].includes(searchParams.get("tab") ?? "")
    ? (searchParams.get("tab") as string)
    : "profile";

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login?callbackUrl=/account/profile");
  }, [loading, user, router]);

  if (loading || !user) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm text-foreground/50">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-3xl">My profile</h1>
      <p className="mt-2 text-sm text-foreground/60">Personal details, delivery addresses and support — all in one place.</p>

      <Tabs defaultValue={initialTab} className="mt-8">
        <TabsList>
          <TabsTrigger value="profile">Personal info</TabsTrigger>
          <TabsTrigger value="addresses">Addresses</TabsTrigger>
          <TabsTrigger value="loyalty">Loyalty points</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>
        <TabsContent value="profile">
          <PersonalInfoSection />
        </TabsContent>
        <TabsContent value="addresses">
          <AddressesSection />
        </TabsContent>
        <TabsContent value="loyalty">
          <LoyaltySection />
        </TabsContent>
        <TabsContent value="support">
          <SupportSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}
