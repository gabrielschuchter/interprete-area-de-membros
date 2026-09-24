import { SignIn as ClerkSignIn } from "@clerk/nextjs";

export const SignIn = () => (
  <ClerkSignIn
    appearance={{
      elements: {
        card: "border-0 bg-transparent p-0 shadow-none",
        footerActionLink: "text-brand-structural hover:text-brand-depth",
        formButtonPrimary: "bg-brand-structural hover:bg-brand-depth",
        header: "hidden",
      },
    }}
  />
);
